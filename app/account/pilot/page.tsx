import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";
import { macroPilotConfig } from "@/lib/pilot-config";
import { loadMacroGrant } from "@/lib/pilot-store";
import { OperatorForms, RedeemForm } from "./forms";

async function Pilot() {
  const session = await auth();
  if (!session.userId) return session.redirectToSignIn({ returnBackUrl: "/account/pilot" });
  const config = macroPilotConfig();
  if (!config || session.sessionClaims.iss !== config.issuer) {
    return <p>The Macro pilot is unavailable in this environment.</p>;
  }
  const subject = session.userId;
  const grant = loadMacroGrant(config.path, config.issuer, subject);
  return (
    <div className="pilot">
      <h1>Macro Goblin pilot</h1>
      {grant ? (
        <section>
          <h2>Connect your assistant</h2>
          <p>Add this MCP URL using the pilot’s approved OAuth client.</p>
          <p><code>{config.resource}</code></p>
          <p>Account time zone {grant.time_zone}</p>
        </section>
      ) : (
        <section>
          <p>Redeem the code issued to your verified primary email and confirm your IANA time zone.</p>
          <RedeemForm />
        </section>
      )}
      {config.operators.has(subject) && <OperatorForms />}
    </div>
  );
}

export default function PilotPage() {
  return <Suspense fallback={<p>Checking your session…</p>}><Pilot /></Suspense>;
}
