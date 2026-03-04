import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const ATTEMPT_STORE_KEY = "__admin_gate_attempts__";
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_STORE_ENTRIES = 10000;

function getAttemptStore() {
  if (!globalThis[ATTEMPT_STORE_KEY]) {
    globalThis[ATTEMPT_STORE_KEY] = new Map();
  }

  return globalThis[ATTEMPT_STORE_KEY];
}

function getGatePassword() {
  return (process.env.ADMIN_GATE_PASSWORD || "").trim();
}

function getClientId(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return "unknown";
}

function getRecord(clientId, now) {
  const store = getAttemptStore();
  const existing = store.get(clientId);

  if (!existing || existing.resetAt <= now) {
    const fresh = { count: 0, resetAt: now + WINDOW_MS };
    store.set(clientId, fresh);
    return fresh;
  }

  return existing;
}

function isRateLimited(clientId, now) {
  pruneAttemptStore(now);
  const record = getRecord(clientId, now);
  return record.count >= MAX_ATTEMPTS;
}

function markFailedAttempt(clientId, now) {
  const record = getRecord(clientId, now);
  record.count += 1;
}

function clearAttempts(clientId) {
  const store = getAttemptStore();
  store.delete(clientId);
}

function pruneAttemptStore(now) {
  const store = getAttemptStore();
  if (store.size === 0) {
    return;
  }

  for (const [key, value] of store.entries()) {
    if (!value || value.resetAt <= now) {
      store.delete(key);
    }
  }

  if (store.size <= MAX_STORE_ENTRIES) {
    return;
  }

  const entries = [...store.entries()].sort(
    (a, b) => (a[1]?.resetAt || 0) - (b[1]?.resetAt || 0),
  );
  const overflowCount = store.size - MAX_STORE_ENTRIES;
  for (let index = 0; index < overflowCount; index += 1) {
    const key = entries[index]?.[0];
    if (key) {
      store.delete(key);
    }
  }
}

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function safeCompare(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

async function parseJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(request) {
  const gatePassword = getGatePassword();
  if (!gatePassword) {
    return NextResponse.json(
      { error: "Admin gate is unavailable." },
      { status: 503 },
    );
  }

  const now = Date.now();
  const clientId = getClientId(request);
  if (isRateLimited(clientId, now)) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429 },
    );
  }

  const body = await parseJson(request);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!password || !safeCompare(password, gatePassword)) {
    markFailedAttempt(clientId, now);
    await delay(250);
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  clearAttempts(clientId);
  const response = NextResponse.json({ ok: true, message: "Admin gate unlocked." });
  response.cookies.set({
    name: "admin_gate",
    value: "1",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 30,
    path: "/",
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: "admin_gate",
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}
