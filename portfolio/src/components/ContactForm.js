"use client";

import Link from "next/link";
import { useState } from "react";

const defaultForm = {
  name: "",
  email: "",
  subject: "",
  message: "",
  consent: false,
  website: "",
};

async function parseJsonResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || "Unable to send message.");
  }
  return data;
}

export default function ContactForm() {
  const [form, setForm] = useState(defaultForm);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const isSending = status === "sending";

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("sending");
    setMessage("");

    try {
      const result = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          subject: form.subject,
          message: form.message,
          consent: form.consent,
          website: form.website,
        }),
      }).then(parseJsonResponse);

      setStatus("success");
      setMessage(result.message || "Message sent.");
      setForm(defaultForm);
    } catch (error) {
      setStatus("error");
      setMessage(error.message || "Unable to send message.");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 space-y-5 border border-foreground/20 bg-white/80 p-4 shadow-[0_14px_40px_rgba(0,0,0,0.05)] backdrop-blur-sm sm:mt-10 sm:space-y-6 sm:p-6"
    >
      <input
        type="text"
        name="website"
        value={form.website}
        onChange={handleChange}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />

      <label className="block text-sm font-semibold tracking-[0.08em] text-foreground/90 uppercase">
        Name
        <input
          type="text"
          name="name"
          value={form.name}
          onChange={handleChange}
          autoComplete="name"
          className="mt-2 w-full rounded-md border border-foreground/35 bg-white px-4 py-3 text-base text-foreground placeholder:text-foreground/50 outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/25"
          placeholder="Your name"
          required
          minLength={2}
          maxLength={80}
          disabled={isSending}
        />
      </label>

      <label className="block text-sm font-semibold tracking-[0.08em] text-foreground/90 uppercase">
        Email
        <input
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          autoComplete="email"
          inputMode="email"
          className="mt-2 w-full rounded-md border border-foreground/35 bg-white px-4 py-3 text-base text-foreground placeholder:text-foreground/50 outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/25"
          placeholder="you@example.com"
          required
          maxLength={160}
          disabled={isSending}
        />
      </label>

      <label className="block text-sm font-semibold tracking-[0.08em] text-foreground/90 uppercase">
        Subject
        <input
          type="text"
          name="subject"
          value={form.subject}
          onChange={handleChange}
          autoComplete="off"
          className="mt-2 w-full rounded-md border border-foreground/35 bg-white px-4 py-3 text-base text-foreground placeholder:text-foreground/50 outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/25"
          placeholder="Subject"
          required
          minLength={3}
          maxLength={180}
          disabled={isSending}
        />
      </label>

      <label className="block text-sm font-semibold tracking-[0.08em] text-foreground/90 uppercase">
        Message
        <textarea
          rows={6}
          name="message"
          value={form.message}
          onChange={handleChange}
          autoComplete="off"
          className="mt-2 w-full rounded-md border border-foreground/35 bg-white px-4 py-3 text-base leading-7 text-foreground placeholder:text-foreground/50 outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/25"
          placeholder="Tell me about your project"
          required
          minLength={10}
          maxLength={3000}
          disabled={isSending}
        />
      </label>

      <label className="flex items-start gap-3 rounded-md border border-foreground/25 bg-white/85 p-3 text-[12px] tracking-[0.02em] text-foreground/85 sm:text-sm">
        <input
          type="checkbox"
          name="consent"
          checked={form.consent}
          onChange={handleChange}
          className="mt-0.5 h-4 w-4 accent-foreground"
          required
          disabled={isSending}
        />
        <span>
          I agree to the{" "}
          <Link href="/privacy" className="underline decoration-foreground/45">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/terms" className="underline decoration-foreground/45">
            Terms of Use
          </Link>
          .
        </span>
      </label>

      <button
        type="submit"
        className="min-h-11 w-full border border-foreground bg-foreground px-6 py-3 text-[12px] font-semibold tracking-[0.16em] text-background uppercase transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        disabled={isSending}
      >
        {isSending ? "Sending..." : "Send"}
      </button>

      {message ? (
        <p
          role="status"
          aria-live="polite"
          className={`text-sm ${status === "error" ? "text-red-700" : "text-foreground/75"}`}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
