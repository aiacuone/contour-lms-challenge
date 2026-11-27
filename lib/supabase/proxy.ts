import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { apiRateLimit } from "@/lib/api/rate-limit";
import type { ErrorBody } from "@/lib/api/errors";

// Copied from the official with-supabase example. Changes: no env-var bypass,
// logged-out visitors are sent to log in from every page except /auth/*, and
// logged-in users are sent from the auth pages to the dashboard.

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const path = request.nextUrl.pathname;
  const isAuthPage = path.startsWith("/auth");

  // Too many API calls from one user (or one IP when logged out) get a 429.
  if (path.startsWith("/api")) {
    const key = user?.sub ?? clientIp(request);
    const limit = apiRateLimit(key);
    if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);
  }

  // API routes answer for themselves (401 as JSON), so they are not redirected.
  if (!user && !isAuthPage && !path.startsWith("/api")) {
    return redirectKeepingCookies(request, supabaseResponse, "/auth/login");
  }

  if (user && isAuthPage) {
    return redirectKeepingCookies(request, supabaseResponse, "/dashboard");
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is, or copy
  // its cookies onto any new response, or the browser and server can go out
  // of sync and end the user's session early.
  return supabaseResponse;
}

function redirectKeepingCookies(
  request: NextRequest,
  supabaseResponse: NextResponse,
  pathname: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  supabaseResponse.cookies
    .getAll()
    .forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

// The first address in x-forwarded-for, as set by the hosting proxy.
function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json<ErrorBody>(
    {
      error: {
        code: "rate_limited",
        message: "Too many requests. Try again in a minute.",
      },
    },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}
