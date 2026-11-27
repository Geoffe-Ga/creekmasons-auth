"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { macroPilotConfig } from "@/lib/pilot-config";
import { issueMacroInvite, redeemMacroInvite, revokeMacroInvite, withPilotStore } from "@/lib/pilot-store";

export type Result = { message: string; invite?: { id: string; code: string } };
const unavailable = { message: "The request could not be completed." };

async function signedInPilot() {
  const config = macroPilotConfig();
  if (!config) return;
  const { userId, sessionClaims } = await auth();
  if (userId && sessionClaims?.iss === config.issuer) return { config, userId };
}

export async function redeem(_previous: Result, form: FormData): Promise<Result> {
  const session = await signedInPilot();
  const code = form.get("code");
  const timeZone = form.get("timeZone");
  if (!session || typeof code !== "string" || !/^[\w-]{43}$/.test(code.trim())
    || typeof timeZone !== "string" || timeZone.length > 128) return unavailable;
  const { config, userId } = session;
  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const email = user.primaryEmailAddress;
    if (email?.verification?.status !== "verified") return unavailable;
    const redeemed = withPilotStore(config.path, (db) => redeemMacroInvite(db, {
      issuer: config.issuer, subject: userId, verifiedEmail: email.emailAddress,
    }, code.trim(), timeZone.trim(), config.recipientKey, Math.floor(Date.now() / 1000)));
    if (!redeemed) return unavailable;
  } catch {
    return unavailable;
  }
  revalidatePath("/account/pilot");
  return { message: "Macro pilot access granted. Connect your assistant below." };
}

export async function issue(_previous: Result, form: FormData): Promise<Result> {
  const session = await signedInPilot();
  const email = form.get("email");
  if (!session || !session.config.operators.has(session.userId) || typeof email !== "string"
    || email.length > 320 || !/^[^\s@]+@[^\s@]+$/.test(email.trim())) return unavailable;
  const { config } = session;
  try {
    const invite = withPilotStore(config.path, (db) => issueMacroInvite(
      db, email, config.recipientKey, Math.floor(Date.now() / 1000),
    ));
    return { message: "Invite created. Share the code privately. Keep its ID for revocation.", invite };
  } catch {
    return unavailable;
  }
}

export async function revoke(_previous: Result, form: FormData): Promise<Result> {
  const session = await signedInPilot();
  const id = form.get("id");
  if (!session || !session.config.operators.has(session.userId) || typeof id !== "string"
    || !/^[a-f0-9-]{36}$/.test(id)) return unavailable;
  try {
    const revoked = withPilotStore(session.config.path, (db) => revokeMacroInvite(db, id));
    if (!revoked) return unavailable;
  } catch {
    return unavailable;
  }
  revalidatePath("/account/pilot");
  return { message: "Invite and any associated Macro access revoked." };
}
