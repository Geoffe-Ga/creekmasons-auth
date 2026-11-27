"use client";

import { useActionState } from "react";
import { pilotProducts, type PilotProduct } from "@/lib/pilot-config";
import { issue, redeem, revoke, type Result } from "./actions";

const initial: Result = { message: "" };

export function RedeemForm({ product }: { product: PilotProduct }) {
  const [state, action, pending] = useActionState(redeem, initial);
  return (
    <form action={action}>
        <input type="hidden" name="product" value={product} />
      <label>Invite code<input name="code" required maxLength={43} autoComplete="off" /></label>
      <label>Time zone<input name="timeZone" required placeholder="America/Los_Angeles" maxLength={128} /></label>
      <button disabled={pending}>Redeem invite</button>
      <p role="status">{state.message}</p>
    </form>
  );
}

export function OperatorForms({ product }: { product: PilotProduct }) {
  const [issued, issueAction, issuing] = useActionState(issue, initial);
  const [revoked, revokeAction, revoking] = useActionState(revoke, initial);
  return (
    <section>
      <h3>Manage {pilotProducts[product].name} invites</h3>
      <form action={issueAction}>
        <input type="hidden" name="product" value={product} />
        <label>Tester’s verified email<input name="email" type="email" required maxLength={320} /></label>
        <button disabled={issuing}>Issue invite</button>
        <p role="status">{issued.message}</p>
        {issued.invite && <dl>
          <dt>Invite code</dt><dd><code>{issued.invite.code}</code></dd>
          <dt>Invite ID</dt><dd><code>{issued.invite.id}</code></dd>
        </dl>}
      </form>
      <form action={revokeAction}>
        <input type="hidden" name="product" value={product} />
        <label>Invite ID<input name="id" required maxLength={36} /></label>
        <button disabled={revoking}>Revoke invite and access</button>
        <p role="status">{revoked.message}</p>
      </form>
    </section>
  );
}
