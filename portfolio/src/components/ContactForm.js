"use client";

import { useState } from "react";

const defaultForm = {
  name: "",
  email: "",
  message: "",
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
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
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
          message: form.message,
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
      className="mt-8 space-y-5 border border-foreground/20 bg-white/70 p-4 shadow-[0_14px_40px_rgba(0,0,0,0.05)] backdrop-blur-sm sm:mt-10 sm:p-6"
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

      <label className="block text-xs tracking-[0.16em] text-foreground/80 uppercase">
        Name
        <input
          type="text"
          name="name"
          value={form.name}
          onChange={handleChange}
          className="mt-2 w-full border border-foreground/30 bg-white px-4 py-3 text-sm text-foreground placeholder:text-foreground/45 outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/15"
          placeholder="Your name"
          required
          minLength={2}
          maxLength={80}
          disabled={isSending}
        />
      </label>

      <label className="block text-xs tracking-[0.16em] text-foreground/80 uppercase">
        Email
        <input
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          className="mt-2 w-full border border-foreground/30 bg-white px-4 py-3 text-sm text-foreground placeholder:text-foreground/45 outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/15"
          placeholder="you@example.com"
          required
          maxLength={160}
          disabled={isSending}
        />
      </label>

      <label className="block text-xs tracking-[0.16em] text-foreground/80 uppercase">
        Message
        <textarea
          rows={6}
          name="message"
          value={form.message}
          onChange={handleChange}
          className="mt-2 w-full border border-foreground/30 bg-white px-4 py-3 text-sm text-foreground placeholder:text-foreground/45 outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/15"
          placeholder="Tell me about your project"
          required
          minLength={10}
          maxLength={3000}
          disabled={isSending}
        />
      </label>

      <button
        type="submit"
        className="w-full border border-foreground bg-foreground px-6 py-3 text-[11px] tracking-[0.18em] text-background uppercase transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:py-2"
        disabled={isSending}
      >
        {isSending ? "Sending..." : "Send"}
      </button>

      {message ? (
        <p className={`text-sm ${status === "error" ? "text-red-700" : "text-foreground/75"}`}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
