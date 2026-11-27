import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { hasClerkConfiguration } from "./lib/clerk-config";

const isAccountRoute = createRouteMatcher(["/account(.*)"]);
const isClerkRoute = createRouteMatcher(["/account(.*)", "/sign-in(.*)", "/sign-up(.*)"]);

const authenticate = clerkMiddleware(
  async (auth, request) => {
    if (isAccountRoute(request)) {
      await auth.protect();
    }
  },
  { signInUrl: "/sign-in", signUpUrl: "/sign-up" },
);

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (hasClerkConfiguration()) {
    return authenticate(request, event);
  }

  if (isClerkRoute(request)) {
    return new NextResponse("Creekmasons sign-in is unavailable.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/account/:path*", "/sign-in/:path*", "/sign-up/:path*"],
};
