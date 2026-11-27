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
