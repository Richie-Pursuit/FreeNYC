import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { isAllowedAdminEmail } from "@/lib/auth-policy";

function hasAdminGate(request) {
  return request.cookies.get("admin_gate")?.value === "1";
}

export default async function proxy(request) {
  const pathname = request.nextUrl.pathname;
  const isLoginRoute = pathname === "/login";
  const isAdminRoute = pathname.startsWith("/admin");

  if (!isLoginRoute && !isAdminRoute) {
    return NextResponse.next();
  }

  if (!hasAdminGate(request)) {
    const homeUrl = new URL("/", request.url);
    homeUrl.searchParams.set("admin", "locked");
    return NextResponse.redirect(homeUrl);
  }

  if (!isAdminRoute) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  });

  const email = typeof token?.email === "string" ? token.email : "";
  if (!isAllowedAdminEmail(email)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.href);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
