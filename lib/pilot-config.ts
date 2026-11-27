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

export function macroPilotConfig() {
  const {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: publishableKey,
    PILOT_STATE_PATH: path,
    PILOT_RECIPIENT_KEY: recipientKey,
    PILOT_CLERK_ISSUER: issuer,
    PILOT_MACRO_RESOURCE_URL: resource,
    PILOT_MACRO_CLIENT_ID: clientId,
    CREEKMASONS_MACRO_SERVICE_KEY: serviceKey,
    PILOT_OPERATOR_SUBJECTS: operators,
    CLERK_SECRET_KEY: clerkSecret,
  } = process.env;
  if (!path || !recipientKey || recipientKey.length < 32 || !issuer
    || !isHttpsUrl(issuer, "/") || !resource || !isHttpsUrl(resource, "/macro-goblin")
    || !clientId || !serviceKey || serviceKey.length < 32 || recipientKey === serviceKey
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
