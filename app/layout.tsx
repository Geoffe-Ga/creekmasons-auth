import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { hasClerkConfiguration } from "@/lib/clerk-config";
import "./globals.css";

export const metadata: Metadata = {
  title: "Creekmasons Account",
  description: "Sign in to your Creekmasons account.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const content = (
    <div className="shell">
      <header>
        <Link href="/" className="brand">Creekmasons</Link>
      </header>
      <main>{children}</main>
    </div>
  );

  return (
    <html lang="en">
      <body>
        {hasClerkConfiguration() ? (
          <ClerkProvider
            signInUrl="/sign-in"
            signUpUrl="/sign-up"
            signInForceRedirectUrl="/account"
            signUpForceRedirectUrl="/account"
          >
            {content}
          </ClerkProvider>
        ) : content}
      </body>
    </html>
  );
}
