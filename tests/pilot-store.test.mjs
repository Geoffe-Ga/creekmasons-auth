import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  authorizeProduct,
  issueInvite,
  redeemInvite,
  revokeInvite,
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
      const invite = issueInvite(db, "macro", "TESTER@example.test", key, now);
      assert.equal(redeemInvite(db, "macro", { ...identity, verifiedEmail: "other@example.test" },
        invite.code, "America/Los_Angeles", key, now), false);
      assert.equal(redeemInvite(db, "macro", identity, invite.code, "+01:00", key, now), false);
      assert.equal(redeemInvite(db, "macro", identity, invite.code, "Europe/London", key, now), true);
      assert.equal(redeemInvite(db, "macro", identity, invite.code, "Europe/London", key, now), false);
      assert.equal(authorizeProduct(db, "macro", { ...access, createdAt: now - 1 }, now + 1), undefined);
      assert.equal(authorizeProduct(db, "macro", { ...access, subject: "other" }, now + 1), undefined);
      const granted = authorizeProduct(db, "macro", access, now + 1);
      assert.ok(granted);
      assert.equal(granted.time_zone, "Europe/London");
      assert.deepEqual(granted.scopes, ["nutrition:read"]);
      assert.equal(authorizeProduct(db, "macro", { ...access, id: "fresh-token" }, now + 2), undefined);
      assert.deepEqual(
        authorizeProduct(db, "macro", { ...access, scopes: ["nutrition:read", "nutrition:write"] }, now + 2),
        granted,
      );
      assert.equal(revokeInvite(db, "macro", invite.id), true);
      assert.equal(authorizeProduct(db, "macro", access, now + 2), undefined);

      const next = issueInvite(db, "macro", identity.verifiedEmail, key, now + 2);
      assert.equal(redeemInvite(db, "macro", identity, next.code, "UTC", key, now + 2), true);
      assert.equal(authorizeProduct(db, "macro", access, now + 3), undefined);
      assert.equal(authorizeProduct(db, "macro", { ...access, id: "new-refresh", createdAt: now + 3 }, now + 3), undefined);
      const reconnected = authorizeProduct(db, "macro", {
        ...access, id: "fresh-token", clientId: "replaced-client", createdAt: now + 3, scopes: ["nutrition:write"],
      }, now + 3);
      assert.ok(reconnected);
      assert.equal(reconnected.account_id, granted.account_id);
      assert.deepEqual(reconnected.scopes, ["nutrition:write"]);
      const expired = issueInvite(db, "macro", "second@example.test", key, now);
      assert.equal(redeemInvite(db, "macro", { ...identity, subject: "other",
        verifiedEmail: "second@example.test" }, expired.code, "UTC", key, expired.expiresAt), false);
      const revoked = issueInvite(db, "macro", "second@example.test", key, now);
      revokeInvite(db, "macro", revoked.id);
      assert.equal(redeemInvite(db, "macro", { ...identity, subject: "other",
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

test("Iron and Macro grants share an account and revoke independently", () => {
  const now = 200_000;
  const directory = mkdtempSync(join(tmpdir(), "creekmasons-products-"));
  try {
    withPilotStore(join(directory, "state.sqlite3"), (store) => {
      const macro = issueInvite(store, "macro", identity.verifiedEmail, key, now);
      const iron = issueInvite(store, "iron", identity.verifiedEmail, key, now);
      const token = {
        issuer: identity.issuer, subject: identity.subject, clientId: "macro-client",
        id: "macro-token", createdAt: now + 1, expiresAt: now + 60, scopes: ["nutrition:read"],
      };
      assert.equal(redeemInvite(store, "iron", identity, macro.code, "UTC", key, now), false);
      assert.equal(redeemInvite(store, "macro", identity, macro.code, "UTC", key, now), true);
      assert.equal(redeemInvite(store, "iron", identity, iron.code, "UTC", key, now), true);
      assert.equal(authorizeProduct(store, "iron", token, now + 1), undefined);
      const macroOwner = authorizeProduct(store, "macro", token, now + 1);
      const ironToken = {
        ...token, clientId: "iron-client", id: "iron-token", scopes: ["workouts:read"],
      };
      const ironOwner = authorizeProduct(store, "iron", ironToken, now + 1);
      assert.ok(macroOwner && ironOwner);
      assert.equal(macroOwner.account_id, ironOwner.account_id);
      assert.equal(revokeInvite(store, "macro", iron.id), false);
      assert.equal(revokeInvite(store, "iron", iron.id), true);
      assert.equal(authorizeProduct(store, "iron", ironToken, now + 2), undefined);
      assert.deepEqual(authorizeProduct(store, "macro", token, now + 2), macroOwner);
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
