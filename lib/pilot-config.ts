export const pilotProducts = {
  macro: { name: "Macro Goblin", scopes: ["nutrition:read", "nutrition:write"] },
  iron: { name: "Iron Goblin", scopes: ["workouts:read", "workouts:write"] },
} as const;

export type PilotProduct = keyof typeof pilotProducts;

export function isPilotProduct(value: unknown): value is PilotProduct {
  return value === "macro" || value === "iron";
}

function isHttpsUrl(value: string, path: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      && !url.search && !url.hash && url.pathname === path
      && value === (path === "/" ? url.origin : url.href);
  } catch {
    return false;
  }
}

export function pilotConfig(product: PilotProduct) {
  const {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: publishableKey,
    PILOT_STATE_PATH: path,
    PILOT_RECIPIENT_KEY: recipientKey,
    PILOT_CLERK_ISSUER: issuer,
    PILOT_OPERATOR_SUBJECTS: operators,
    CLERK_SECRET_KEY: clerkSecret,
  } = process.env;
  const name = product.toUpperCase();
  const resource = process.env[`PILOT_${name}_RESOURCE_URL`];
  const clientId = process.env[`PILOT_${name}_CLIENT_ID`];
  const serviceKey = process.env[`CREEKMASONS_${name}_SERVICE_KEY`];
  if (!path || !recipientKey || recipientKey.length < 32 || !issuer
    || !isHttpsUrl(issuer, "/") || !resource || !isHttpsUrl(resource, `/${product}-goblin`)
    || !clientId || !isHttpsUrl(clientId, `/oauth/clients/${product}-openclaw.json`)
    || !serviceKey || serviceKey.length < 32 || recipientKey === serviceKey
    || !operators || !clerkSecret?.startsWith("sk_test_")) {
    return;
  }
  const frontend = publishableKey?.startsWith("pk_test_")
    ? Buffer.from(publishableKey.slice(8), "base64").toString("utf8")
    : "";
  if (frontend !== `${new URL(issuer).host}$`) return;
  return { path, recipientKey, issuer, resource, clientId, serviceKey,
    operators: new Set(operators.split(",").map((subject) => subject.trim()).filter(Boolean)) };
}
