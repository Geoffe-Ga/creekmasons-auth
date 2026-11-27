import { macroPilotConfig } from "@/lib/pilot-config";

export function GET() {
  const config = macroPilotConfig();
  if (!config || !config.clientId.endsWith("/oauth/clients/macro-openclaw.json")) {
    return new Response(null, { status: 404 });
  }
  return Response.json({
    client_id: config.clientId,
    client_name: "Creekmasons Macro Staging – OpenClaw",
    redirect_uris: ["http://127.0.0.1:8989/oauth/callback"],
    grant_types: ["authorization_code"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  }, { headers: { "Cache-Control": "public, max-age=300" } });
}
