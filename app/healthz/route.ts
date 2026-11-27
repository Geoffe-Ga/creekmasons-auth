import { hasClerkConfiguration } from "@/lib/clerk-config";

export function GET() {
  const configured = hasClerkConfiguration();

  return Response.json(
    { status: configured ? "ready" : "unconfigured" },
    { status: configured ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
