import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";

async function AccountContent() {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) {
    return redirectToSignIn({ returnBackUrl: "/account" });
  }

  return (
    <div className="welcome">
      <div>
        <h1>Your account</h1>
        <p>You’re signed in to Creekmasons. Use the account menu to manage your profile or sign out.</p>
        <UserButton showName />
      </div>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<p>Checking your session…</p>}>
      <AccountContent />
    </Suspense>
  );
}
