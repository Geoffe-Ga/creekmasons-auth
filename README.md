# Creekmasons Auth

Shared Next.js sign-in and account shell for Creekmasons products. It is the starting point for Iron Goblin, Macro Goblin, Grocery Butler, and future apps.

Clerk authenticates the shared identity. Each product owns its access grants and records. An authenticated browser session alone grants no product access. The downstream product connection, product invites, and product service enforcement need their own integration. Existing product accounts and sign-in flows should be reviewed before any migration.

## Local development

Use Node.js 24 LTS and npm. From the project root:

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). With no Clerk keys the public page explains that sign-in is unavailable. Sign-in, sign-up, and account routes return HTTP 503.

To enable sign-in, authenticate the Clerk CLI on your host and link the existing Creekmasons development application. Copy the application ID from the Clerk Dashboard when prompted.

```bash
npx -y clerk@latest auth login
read -r -p 'Existing Creekmasons Clerk application ID: ' CREEKMASONS_CLERK_APP_ID
npx -y clerk@latest link --app "${CREEKMASONS_CLERK_APP_ID:?}"
npx -y clerk@latest env pull
npx -y clerk@latest doctor
npm run dev
```

You can also put the selected Development instance’s publishable and secret keys in a local copy of `.env.example` named `.env.local`. Keep that file out of Git. After loading the keys, visit `/sign-in` using an existing approved development account and verify that `/account` opens only with an authenticated session.

## Verification

```bash
npm run lint
npm run build
```

`GET /healthz` reports whether keys are configured. It checks local configuration. A real sign-in is the end-to-end check of the Clerk instance.

[Clerk Next.js quickstart](https://clerk.com/docs/nextjs/getting-started/quickstart) · [Clerk CLI](https://clerk.com/docs/cli)

## Macro staging

Enable this flow only on the isolated staging auth service using a Clerk Development
instance. Mount a persistent volume and point `PILOT_STATE_PATH` to an absolute path on
it, such as `/data/pilot.sqlite3`. Run a single replica. The existing public sign-in keeps
working when these optional variables are absent.

- `PILOT_CLERK_ISSUER`: Exact Development issuer. The code checks it against the
  publishable key and the signed-in browser session.
- `PILOT_MACRO_RESOURCE_URL`: Approved public HTTPS Macro URL ending in `/macro-goblin`.
- `PILOT_MACRO_CLIENT_ID`: The client ID of one approved assistant in this staging test.
- `PILOT_OPERATOR_SUBJECTS`: Comma-separated Clerk user IDs for pilot operators.
- `PILOT_RECIPIENT_KEY`: A random secret for matching verified invite recipients.
- `CREEKMASONS_MACRO_SERVICE_KEY`: A different random secret shared with the
  private Macro service. Generate each secret independently, for example with
  `openssl rand -hex 32`.

An operator can issue and revoke codes on `/account/pilot`. Deliver each code privately
to the address it was issued to. A signed-in tester redeems it with the same verified
primary email and confirms their time zone. Keep the invite ID for revocation.

This initial staging path uses a fresh opaque Clerk access token with the exact Macro
audience, approved client ID and granted `nutrition:read` / `nutrition:write` scopes.
The private Macro service calls `/api/internal/pilot/macro/authorize` over Railway private
networking for each request. The auth service verifies the token online before checking
its current grant and consent. Revocation blocks subsequent operations and retries.
The first verified access token is pinned for this invite. The first trial uses
OpenClaw on a single-tester profile and its documented loopback callback. Refresh
and automatic reconnect are outside this staging slice. A previously connected
client identity remains blocked for an account after revocation, including if an
old refresh grant mints a new token. Repeat the test with a fresh staging account,
or use a separately registered client and a new invite.

Run `npm test` for the disposable invitation and consent rehearsal. Verify a real
assistant's opaque-token audience and scopes on staging before opening the route for
testers. Keep the existing deployment and all production settings separate.

[Clerk token verifier](https://clerk.com/docs/guides/configure/auth-strategies/oauth/verify-oauth-tokens)

For the Iron rehearsal, configure the corresponding `PILOT_IRON_RESOURCE_URL`
and `PILOT_IRON_CLIENT_ID` ending in `/oauth/clients/iron-openclaw.json`. Use a
different `CREEKMASONS_IRON_SERVICE_KEY`, shared only with the private Iron
service. Both invite flows use the same account and store. Grants, connections,
scopes and revocation remain product-specific.
