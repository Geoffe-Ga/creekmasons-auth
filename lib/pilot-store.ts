import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pilotProducts, type PilotProduct } from "./pilot-config.ts";

const schema = `
  CREATE TABLE IF NOT EXISTS pilot_accounts (
    issuer TEXT NOT NULL,
    subject TEXT NOT NULL,
    id TEXT NOT NULL UNIQUE,
    time_zone TEXT NOT NULL,
    PRIMARY KEY (issuer, subject)
  );
  CREATE TABLE IF NOT EXISTS pilot_invites (
    id TEXT PRIMARY KEY,
    token_digest TEXT NOT NULL UNIQUE,
    recipient_digest TEXT NOT NULL,
    product TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    redeemed_at INTEGER,
    revoked INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS pilot_grants (
    account_id TEXT NOT NULL REFERENCES pilot_accounts(id),
    product TEXT NOT NULL,
    invite_id TEXT NOT NULL REFERENCES pilot_invites(id),
    PRIMARY KEY (account_id, product)
  );
  CREATE TABLE IF NOT EXISTS pilot_connections (
    id TEXT PRIMARY KEY,
    invite_id TEXT NOT NULL REFERENCES pilot_invites(id),
    account_id TEXT NOT NULL REFERENCES pilot_accounts(id),
    client_id TEXT NOT NULL,
    token_digest TEXT NOT NULL UNIQUE,
    consent_mask INTEGER NOT NULL,
    UNIQUE (invite_id, client_id)
  );
`;

type Invite = { id: string; expires_at: number; redeemed_at: number | null; revoked: number };
type AccountGrant = {
  account_id: string;
  time_zone: string;
  invite_id: string;
  redeemed_at: number;
};
export type Identity = { issuer: string; subject: string; verifiedEmail: string };
export type VerifiedPilotToken = {
  issuer: string;
  subject: string;
  clientId: string;
  id: string;
  createdAt: number;
  expiresAt: number;
  scopes: string[];
};

function tokenDigest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function recipientDigest(email: string, key: string) {
  return createHmac("sha256", key).update(email.trim().toLowerCase()).digest("hex");
}

export function withPilotStore<T>(path: string, callback: (db: DatabaseSync) => T): T {
  if (!isAbsolute(path)) {
    throw new Error("Pilot state requires an absolute database path.");
  }
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path, { timeout: 3000 });
  try {
    db.exec(schema);
    return callback(db);
  } finally {
    db.close();
  }
}

function transaction<T>(db: DatabaseSync, callback: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = callback();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function issueInvite(db: DatabaseSync, product: PilotProduct, recipient: string, key: string, now: number) {
  const id = randomUUID();
  const code = randomBytes(32).toString("base64url");
  const expiresAt = now + 24 * 60 * 60;
  db.prepare(`
    INSERT INTO pilot_invites (id, token_digest, recipient_digest, product, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, tokenDigest(code), recipientDigest(recipient, key), product, expiresAt);
  return { id, code, expiresAt };
}

export function redeemInvite(
  db: DatabaseSync,
  product: PilotProduct,
  identity: Identity,
  code: string,
  timeZone: string,
  key: string,
  now: number,
) {
  let confirmedZone: string;
  try {
    confirmedZone = new Intl.DateTimeFormat("en", { timeZone }).resolvedOptions().timeZone;
    // Intl also accepts fixed offsets. The account contract requires an IANA zone.
    if (timeZone.startsWith("+") || timeZone.startsWith("-")) return false;
  } catch (error) {
    if (error instanceof RangeError) return false;
    throw error;
  }

  return transaction(db, () => {
    const invite = db.prepare(`
      SELECT id, expires_at, redeemed_at, revoked FROM pilot_invites
      WHERE token_digest = ? AND recipient_digest = ? AND product = ?
    `).get(tokenDigest(code), recipientDigest(identity.verifiedEmail, key), product) as Invite | undefined;
    if (!invite || invite.expires_at <= now || invite.redeemed_at !== null || invite.revoked) {
      return false;
    }
    if (findGrant(db, product, identity.issuer, identity.subject)) return false;
    const account = db.prepare(`
      INSERT INTO pilot_accounts (issuer, subject, id, time_zone) VALUES (?, ?, ?, ?)
      ON CONFLICT (issuer, subject) DO UPDATE SET time_zone = excluded.time_zone
      RETURNING id
    `).get(identity.issuer, identity.subject, randomUUID(), confirmedZone) as { id: string };
    db.prepare("UPDATE pilot_invites SET redeemed_at = ? WHERE id = ?").run(now, invite.id);
    db.prepare(`
      INSERT INTO pilot_grants (account_id, product, invite_id)
      VALUES (?, ?, ?)
      ON CONFLICT (account_id, product) DO UPDATE SET invite_id = excluded.invite_id
    `).run(account.id, product, invite.id);
    return true;
  });
}

export function findGrant(db: DatabaseSync, product: PilotProduct, issuer: string, subject: string) {
  return db.prepare(`
    SELECT a.id AS account_id, a.time_zone, i.id AS invite_id, i.redeemed_at
    FROM pilot_accounts a JOIN pilot_grants g ON a.id = g.account_id
    JOIN pilot_invites i ON i.id = g.invite_id
    WHERE a.issuer = ? AND a.subject = ? AND g.product = ?
      AND i.revoked = 0
  `).get(issuer, subject, product) as AccountGrant | undefined;
}

export function revokeInvite(db: DatabaseSync, product: PilotProduct, id: string) {
  return db.prepare("UPDATE pilot_invites SET revoked = 1 WHERE id = ? AND product = ?")
    .run(id, product).changes === 1;
}

export function authorizeProduct(db: DatabaseSync, product: PilotProduct, token: VerifiedPilotToken, now: number) {
  const productScopes: readonly string[] = pilotProducts[product].scopes;
  const consentMask = productScopes.reduce(
    (mask, scope, index) => token.scopes.includes(scope) ? mask | (1 << index) : mask, 0,
  );
  if (!consentMask || token.expiresAt <= now || token.createdAt > now) return;
  return transaction(db, () => {
    const grant = findGrant(db, product, token.issuer, token.subject);
    if (!grant || token.createdAt <= grant.redeemed_at) return;
    const priorConnection = db.prepare(`
      SELECT 1 FROM pilot_connections
      WHERE account_id = ? AND client_id = ? AND invite_id <> ?
    `).get(grant.account_id, token.clientId, grant.invite_id);
    // An older refresh grant could mint a fresh token. A revoked client identity
    // stays blocked for this account until a separately registered client is used.
    if (priorConnection) return;
    const fingerprint = tokenDigest(token.id);
    db.prepare(`
      INSERT INTO pilot_connections (id, invite_id, account_id, client_id, token_digest, consent_mask)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT DO NOTHING
    `).run(randomUUID(), grant.invite_id, grant.account_id, token.clientId, fingerprint, consentMask);
    const current = db.prepare(`
      SELECT consent_mask FROM pilot_connections WHERE invite_id = ? AND client_id = ? AND token_digest = ?
    `).get(grant.invite_id, token.clientId, fingerprint) as { consent_mask: number } | undefined;
    if (current) {
      const scopes = productScopes.filter((_, index) =>
        (consentMask & current.consent_mask & (1 << index)) !== 0);
      return { account_id: grant.account_id, time_zone: grant.time_zone, scopes };
    }
  });
}

export function loadGrant(path: string, product: PilotProduct, issuer: string, subject: string) {
  return withPilotStore(path, (db) => findGrant(db, product, issuer, subject));
}
