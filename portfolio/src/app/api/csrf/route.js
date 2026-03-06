import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { createCsrfToken, setCsrfCookie } from "@/lib/csrf";

export const dynamic = "force-dynamic";

export async function GET() {
  const authResult = await requireApiAuth();
  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }

  const token = createCsrfToken();
  const response = NextResponse.json({ csrfToken: token });
  setCsrfCookie(response, token);
  return response;
}
