import { isPilotProduct, pilotConfig, pilotProducts } from "@/lib/pilot-config";

export async function GET(_request: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  const product = filename.match(/^(macro|iron)-openclaw\.json$/)?.[1];
  const config = isPilotProduct(product) ? pilotConfig(product) : undefined;
  if (!config || !isPilotProduct(product)) {
    return new Response(null, { status: 404 });
  }
  return Response.json({
    client_id: config.clientId,
    client_name: `${pilotProducts[product].name} Staging – OpenClaw`,
    redirect_uris: ["http://127.0.0.1:8989/oauth/callback"],
    grant_types: ["authorization_code"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  }, { headers: { "Cache-Control": "public, max-age=300" } });
}
