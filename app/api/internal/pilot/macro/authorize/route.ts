import { clerkClient } from "@clerk/nextjs/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { macroPilotConfig } from "@/lib/pilot-config";
import { authorizeMacro, withPilotStore } from "@/lib/pilot-store";

function denial(status: number) {
  return Response.json({}, { status, headers: { "Cache-Control": "no-store" } });
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function epochSeconds(timestamp: number) {
  return timestamp > 100_000_000_000 ? Math.floor(timestamp / 1000) : timestamp;
}

export async function POST(request: Request) {
  const config = macroPilotConfig();
  const serviceKey = request.headers.get("X-Creekmasons-Service-Key");
  if (!config || !serviceKey || !timingSafeEqual(digest(serviceKey), digest(config.serviceKey))) {
    return denial(404);
  }
  const authorization = request.headers.get("Authorization") ?? "";
  const match = /^Bearer (oat_[^\s]+)$/i.exec(authorization);
  if (!match || authorization.length > 4096) {
    return denial(401);
  }

  try {
    const clerk = await clerkClient();
    // The configured Development instance verifies the opaque token online.
    // Require its verified audience even when the token has a valid Clerk identity.
    const token = await clerk.idPOAuthAccessToken.verify(match[1]);
    const expiration = token.expiration;
    if (token.revoked || token.expired || !expiration || !token.id || !token.subject
      || !Number.isSafeInteger(token.createdAt) || !Number.isSafeInteger(expiration)
      || token.aud?.length !== 1 || token.aud[0] !== config.resource || token.act) {
      return denial(401);
    }
    if (token.clientId !== config.clientId) {
      return denial(403);
    }
    const now = Math.floor(Date.now() / 1000);
    const result = withPilotStore(config.path, (db) => authorizeMacro(db, {
      issuer: config.issuer,
      subject: token.subject,
      clientId: token.clientId,
      id: token.id,
      createdAt: epochSeconds(token.createdAt),
      expiresAt: epochSeconds(expiration),
      scopes: token.scopes,
    }, now));
    return result
      ? Response.json(result, { headers: { "Cache-Control": "no-store" } })
      : denial(403);
  } catch (error) {
    if (error && typeof error === "object" && "status" in error &&
      (error.status === 400 || error.status === 401 || error.status === 404)) {
      return denial(401);
    }
    return denial(503);
  }
}
