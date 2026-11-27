import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";
import { hasClerkConfiguration } from "@/lib/clerk-config";

export default function Home() {
  return (
    <div className="welcome">
      <div>
        <h1>Your Creekmasons account</h1>
        <p>One sign-in for Creekmasons products. Product access is managed separately.</p>
        {hasClerkConfiguration() ? (
          <Suspense>
            <Show when="signed-out">
              <nav aria-label="Account" className="actions">
                <Link className="button" href="/sign-in">Sign in</Link>
                <Link href="/sign-up">Create an account</Link>
              </nav>
            </Show>
            <Show when="signed-in">
              <nav aria-label="Account" className="actions">
                <Link className="button" href="/account">Your account</Link>
                <UserButton />
              </nav>
            </Show>
          </Suspense>
        ) : (
          <p className="notice">Sign-in is unavailable until this environment is connected to Clerk.</p>
        )}
      </div>
    </div>
  );
}
