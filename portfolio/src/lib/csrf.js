import { randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const CSRF_COOKIE_NAME = "admin_csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_TOKEN_BYTES = 32;
const CSRF_MAX_AGE_SECONDS = 60 * 60;

function safeCompare(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function isAllowedOrigin(request, originHeader) {
  if (!originHeader) {
    return true;
  }

  try {
    const requestOrigin = request.nextUrl?.origin || "";
    const origin = new URL(originHeader).origin;
    return origin === requestOrigin;
  } catch {
    return false;
  }
}

function isSafeFetchSite(request) {
  const fetchSite = (request.headers.get("sec-fetch-site") || "").toLowerCase();
  if (!fetchSite) {
    return true;
  }

  return fetchSite === "same-origin" || fetchSite === "same-site" || fetchSite === "none";
}

export function createCsrfToken() {
  return randomBytes(CSRF_TOKEN_BYTES).toString("hex");
}

export function setCsrfCookie(response, token) {
  response.cookies.set({
    name: CSRF_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: CSRF_MAX_AGE_SECONDS,
    path: "/",
  });
}

export function csrfErrorResponse(message = "Invalid CSRF token.") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function verifyCsrfRequest(request) {
  if (!isSafeFetchSite(request)) {
    return {
      ok: false,
      errorResponse: csrfErrorResponse("Cross-site request blocked."),
    };
  }

  const originHeader = request.headers.get("origin");
  if (!isAllowedOrigin(request, originHeader)) {
    return {
      ok: false,
      errorResponse: csrfErrorResponse("Origin check failed."),
    };
  }

  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value || "";
  const headerToken = request.headers.get(CSRF_HEADER_NAME) || "";
  if (!cookieToken || !headerToken) {
    return {
      ok: false,
      errorResponse: csrfErrorResponse("Missing CSRF token."),
    };
  }

  if (!safeCompare(cookieToken, headerToken)) {
    return {
      ok: false,
      errorResponse: csrfErrorResponse(),
    };
  }

  return { ok: true };
}
