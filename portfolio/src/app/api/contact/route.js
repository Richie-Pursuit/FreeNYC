import { NextResponse } from "next/server";

const rateLimitState = new Map();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 6;

function getClientIp(request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return request.headers.get("x-real-ip") || "unknown";
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitState.get(ip);

  if (!entry || now - entry.startedAt > RATE_LIMIT_WINDOW_MS) {
    rateLimitState.set(ip, { count: 1, startedAt: now });
    return false;
  }

  entry.count += 1;
  rateLimitState.set(ip, entry);
  return entry.count > RATE_LIMIT_MAX_REQUESTS;
}

async function parseResendResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.error?.message || data?.message || "Email provider error.";
    throw new Error(detail);
  }
  return data;
}

export async function POST(request) {
  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many messages. Please try again in a few minutes." },
      { status: 429 },
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = normalizeString(payload?.name);
  const email = normalizeString(payload?.email);
  const message = normalizeString(payload?.message);
  const website = normalizeString(payload?.website);

  if (website) {
    return NextResponse.json({ message: "Message sent." }, { status: 200 });
  }

  if (name.length < 2 || name.length > 80) {
    return NextResponse.json({ error: "Please enter a valid name." }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  if (message.length < 10 || message.length > 3000) {
    return NextResponse.json(
      { error: "Message must be between 10 and 3000 characters." },
      { status: 400 },
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Email service is not configured yet (missing RESEND_API_KEY)." },
      { status: 500 },
    );
  }

  const toEmail =
    process.env.CONTACT_TO_EMAIL ||
    process.env.ADMIN_EMAIL ||
    "richiecarrasco@pursuit.org";
  const fromEmail = process.env.CONTACT_FROM_EMAIL || "Free NYC <onboarding@resend.dev>";
  const replyTo = email;

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br/>");

  const subject = `New Contact Message - ${name}`;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        reply_to: replyTo,
        subject,
        text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
            <h2 style="margin: 0 0 12px;">New Contact Form Message</h2>
            <p><strong>Name:</strong> ${safeName}</p>
            <p><strong>Email:</strong> ${safeEmail}</p>
            <p><strong>Message:</strong><br/>${safeMessage}</p>
          </div>
        `,
      }),
    }).then(parseResendResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Unable to send email right now." },
      { status: 502 },
    );
  }

  return NextResponse.json({ message: "Thanks, your message was sent." });
}
