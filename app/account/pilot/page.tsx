import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";
import { pilotConfig, pilotProducts, type PilotProduct } from "@/lib/pilot-config";
import { loadGrant } from "@/lib/pilot-store";
import { OperatorForms, RedeemForm } from "./forms";

async function Pilot() {
  const session = await auth();
  if (!session.userId) return session.redirectToSignIn({ returnBackUrl: "/account/pilot" });
  const { userId, sessionClaims } = session;
  const enabled = (Object.keys(pilotProducts) as PilotProduct[]).flatMap((product) => {
    const config = pilotConfig(product);
    return config && sessionClaims.iss === config.issuer ? [{ product, config }] : [];
  });
  if (!enabled.length) return <p>Pilot access is unavailable in this environment.</p>;

  return (
    <div className="pilot">
      <h1>Goblin staging pilots</h1>
      {enabled.map(({ product, config }) => {
        const grant = loadGrant(config.path, product, config.issuer, userId);
        return (
          <section key={product}>
            <h2>{pilotProducts[product].name}</h2>
            {grant ? (
              <div>
                <p>Add this MCP URL using the pilot’s approved OAuth client.</p>
                <p><code>{config.resource}</code></p>
                <p>Account time zone {grant.time_zone}</p>
              </div>
            ) : (
              <div>
                <p>Redeem the code issued to your verified primary email and confirm your IANA time zone.</p>
                <RedeemForm product={product} />
              </div>
            )}
            {config.operators.has(userId) && <OperatorForms product={product} />}
          </section>
        );
      })}
    </div>
  );
}

export default function PilotPage() {
  return <Suspense fallback={<p>Checking your session…</p>}><Pilot /></Suspense>;
}
