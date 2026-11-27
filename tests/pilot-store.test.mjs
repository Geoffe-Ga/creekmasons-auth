import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  authorizeMacro,
  issueMacroInvite,
  redeemMacroInvite,
  revokeMacroInvite,
  withPilotStore,
} from "../lib/pilot-store.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const identity = {
  issuer: "https://identity.example.test",
  subject: "user_tester",
  verifiedEmail: "tester@example.test",
};
const key = "disposable fixture key";

test("verified invite binds one tenant and one scoped OAuth token until revocation", () => {
  const now = 100_000;
  const directory = mkdtempSync(join(tmpdir(), "creekmasons-pilot-"));
  const path = join(directory, "state.sqlite3");
  const access = {
    issuer: identity.issuer,
    subject: identity.subject,
    clientId: "fixture-client",
    id: "verified-token-id",
    createdAt: now + 1,
    expiresAt: now + 60,
    scopes: ["nutrition:read"],
  };

  try {
    const result = withPilotStore(path, (db) => {
      const invite = issueMacroInvite(db, "TESTER@example.test", key, now);
      assert.equal(redeemMacroInvite(db, { ...identity, verifiedEmail: "other@example.test" },
        invite.code, "America/Los_Angeles", key, now), false);
      assert.equal(redeemMacroInvite(db, identity, invite.code, "+01:00", key, now), false);
      assert.equal(redeemMacroInvite(db, identity, invite.code, "Europe/London", key, now), true);
      assert.equal(redeemMacroInvite(db, identity, invite.code, "Europe/London", key, now), false);
      assert.equal(authorizeMacro(db, { ...access, createdAt: now - 1 }, now + 1), undefined);
      assert.equal(authorizeMacro(db, { ...access, subject: "other" }, now + 1), undefined);
      const granted = authorizeMacro(db, access, now + 1);
      assert.ok(granted);
      assert.equal(granted.time_zone, "Europe/London");
      assert.deepEqual(granted.scopes, ["nutrition:read"]);
      assert.equal(authorizeMacro(db, { ...access, id: "fresh-token" }, now + 2), undefined);
      assert.deepEqual(
        authorizeMacro(db, { ...access, scopes: ["nutrition:read", "nutrition:write"] }, now + 2),
        granted,
      );
      assert.equal(revokeMacroInvite(db, invite.id), true);
      assert.equal(authorizeMacro(db, access, now + 2), undefined);

      const next = issueMacroInvite(db, identity.verifiedEmail, key, now + 2);
      assert.equal(redeemMacroInvite(db, identity, next.code, "UTC", key, now + 2), true);
      assert.equal(authorizeMacro(db, access, now + 3), undefined);
      assert.equal(authorizeMacro(db, { ...access, id: "new-refresh", createdAt: now + 3 }, now + 3), undefined);
      const reconnected = authorizeMacro(db, {
        ...access, id: "fresh-token", clientId: "replaced-client", createdAt: now + 3, scopes: ["nutrition:write"],
      }, now + 3);
      assert.ok(reconnected);
      assert.equal(reconnected.account_id, granted.account_id);
      assert.deepEqual(reconnected.scopes, ["nutrition:write"]);
      const expired = issueMacroInvite(db, "second@example.test", key, now);
      assert.equal(redeemMacroInvite(db, { ...identity, subject: "other",
        verifiedEmail: "second@example.test" }, expired.code, "UTC", key, expired.expiresAt), false);
      const revoked = issueMacroInvite(db, "second@example.test", key, now);
      revokeMacroInvite(db, revoked.id);
      assert.equal(redeemMacroInvite(db, { ...identity, subject: "other",
        verifiedEmail: "second@example.test" }, revoked.code, "UTC", key, now + 2), false);
      return reconnected.account_id;
    });
    const db = new DatabaseSync(path, { readOnly: true });
    try {
      assert.equal(db.prepare("SELECT id FROM pilot_accounts").get().id, result);
      assert.equal(db.prepare("SELECT COUNT(*) AS total FROM pilot_connections").get().total, 2);
    } finally {
      db.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
