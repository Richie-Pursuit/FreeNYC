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
      className="theme-surface-muted mt-8 space-y-5 border p-4 backdrop-blur-sm sm:mt-10 sm:space-y-6 sm:p-6"
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
          className="theme-field mt-2 w-full rounded-md border px-4 py-3 text-base outline-none"
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
          className="theme-field mt-2 w-full rounded-md border px-4 py-3 text-base outline-none"
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
          className="theme-field mt-2 w-full rounded-md border px-4 py-3 text-base outline-none"
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
          className="theme-field mt-2 w-full rounded-md border px-4 py-3 text-base leading-7 outline-none"
          placeholder="Tell me about your project"
          required
          minLength={10}
          maxLength={3000}
          disabled={isSending}
        />
      </label>

      <label className="theme-surface-muted flex items-start gap-3 rounded-md border p-3 text-[12px] tracking-[0.02em] text-foreground/85 sm:text-sm">
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
          <Link href="/privacy" className="theme-link underline">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/terms" className="theme-link underline">
            Terms of Use
          </Link>
          .
        </span>
      </label>

      <button
        type="submit"
        className="theme-primary-button min-h-11 w-full border px-6 py-3 text-[12px] font-semibold tracking-[0.16em] uppercase transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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
