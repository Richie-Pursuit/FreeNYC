import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { CSRF_COOKIE_NAME, createCsrfToken, setCsrfCookie } from "@/lib/csrf";

export const dynamic = "force-dynamic";
const CSRF_TOKEN_REGEX = /^[a-f0-9]{64}$/i;

export async function GET(request) {
  const authResult = await requireApiAuth();
  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }

  const existingToken = request.cookies.get(CSRF_COOKIE_NAME)?.value || "";
  const token = CSRF_TOKEN_REGEX.test(existingToken)
    ? existingToken
    : createCsrfToken();
  const response = NextResponse.json({ csrfToken: token });
  if (!CSRF_TOKEN_REGEX.test(existingToken)) {
    setCsrfCookie(response, token);
  }
  return response;
}
