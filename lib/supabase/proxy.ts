import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
