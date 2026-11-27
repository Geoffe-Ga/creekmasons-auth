import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignInPage() {
  return (
    <div className="auth-form">
      <Suspense fallback={<p>Loading sign-in…</p>}>
        <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
      </Suspense>
    </div>
  );
}
