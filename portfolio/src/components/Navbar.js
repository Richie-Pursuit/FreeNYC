"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import BrandStarSymbol from "@/components/BrandStarSymbol";

const navLinks = [
  { label: "Gallery", href: "/gallery" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

async function parseJsonResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || "Unable to unlock admin access.");
  }

  return data;
}

function KeyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <circle cx="8" cy="12" r="4" />
      <path d="M12 12h9" />
      <path d="M18 12v3" />
      <path d="M21 12v2" />
    </svg>
  );
}

function MenuIcon({ open = false }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      {open ? (
        <>
          <path d="M6 6 18 18" />
          <path d="M18 6 6 18" />
        </>
      ) : (
        <>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </>
      )}
    </svg>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [adminGateOpen, setAdminGateOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
    setAdminGateOpen(false);
    setShowAdminPassword(false);
    setAdminError("");
  }, [pathname]);

  const isActive = (href) => {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const handleUnlock = async (event) => {
    event.preventDefault();
    if (!adminPassword.trim()) {
      setAdminError("Enter password");
      return;
    }

    setIsUnlocking(true);
    setAdminError("");

    try {
      await fetch("/api/admin-gate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: adminPassword }),
      }).then(parseJsonResponse);

      setAdminPassword("");
      setShowAdminPassword(false);
      setAdminGateOpen(false);
      router.push("/login?callbackUrl=/admin");
    } catch (error) {
      setAdminError(error.message || "Invalid password");
    } finally {
      setIsUnlocking(false);
    }
  };

  const gatePanel = (
    <div
      className={`absolute right-0 top-[calc(100%+0.55rem)] z-50 w-[min(260px,calc(100vw-1.5rem))] rounded-xl border border-foreground/15 bg-white/95 p-3 shadow-[0_12px_28px_rgba(0,0,0,0.12)] transition-all ${
        adminGateOpen
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none translate-y-1 opacity-0"
      }`}
    >
      <p className="text-[10px] tracking-[0.14em] text-foreground/70 uppercase">
        Admin Password
      </p>
      <form onSubmit={handleUnlock} className="mt-2 space-y-2">
        <input
          type={showAdminPassword ? "text" : "password"}
          value={adminPassword}
          onChange={(event) => setAdminPassword(event.target.value)}
          placeholder="Enter password"
          className="w-full border border-foreground/25 bg-white px-3 py-2 text-sm text-foreground placeholder:text-foreground/45 outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/15"
        />
        <label className="flex items-center gap-2 text-[10px] tracking-[0.12em] text-foreground/70 uppercase">
          <input
            type="checkbox"
            checked={showAdminPassword}
            onChange={(event) => setShowAdminPassword(event.target.checked)}
            className="h-3.5 w-3.5 accent-foreground"
          />
          Show Password
        </label>
        <button
          type="submit"
          className="w-full border border-foreground bg-foreground px-3 py-2 text-[10px] tracking-[0.14em] text-background uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
          disabled={isUnlocking}
        >
          {isUnlocking ? "Checking..." : "Unlock"}
        </button>
      </form>
      <p className="mt-2 text-[10px] leading-4 text-foreground/60">
        Step 1: unlock with password. Step 2: continue with Google sign-in.
      </p>
      {adminError ? <p className="mt-2 text-xs text-red-700">{adminError}</p> : null}
    </div>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-300/75 bg-[linear-gradient(180deg,rgba(249,249,247,0.98)_0%,rgba(249,249,247,0.93)_100%)] px-3 pt-[calc(env(safe-area-inset-top)+0.9rem)] pb-3 backdrop-blur-md shadow-[0_1px_0_rgba(0,0,0,0.04)] sm:px-6 sm:pt-[calc(env(safe-area-inset-top)+1rem)] sm:pb-3 lg:px-12 lg:pt-[calc(env(safe-area-inset-top)+1.15rem)] lg:pb-4">
      <div className="mx-auto w-full max-w-[1800px]">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="group relative inline-flex items-center gap-2 rounded-md px-1 py-0.5 sm:gap-2.5"
          >
            <BrandStarSymbol
              className="h-8 w-8 shrink-0 sm:h-9 sm:w-9"
              fill="#F5F5F0"
              split="#0A0A0A"
              stroke="#111111"
            />
            <span className="logo-font relative z-10 text-[1.86rem] leading-none text-zinc-950 uppercase transition-transform duration-300 group-hover:scale-[1.015] sm:text-[2.5rem]">
              Free NYC
            </span>
          </Link>

          <div className="flex items-center gap-3 sm:gap-4">
            <nav className="hidden items-center gap-6 lg:gap-8 md:flex" aria-label="Primary">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  className={`border-b-2 px-0 py-1.5 text-[16px] font-semibold tracking-[0.08em] uppercase transition-all ${
                    isActive(link.href)
                      ? "border-zinc-900 text-zinc-900"
                      : "border-transparent text-zinc-700/88 hover:border-zinc-500/45 hover:text-zinc-900"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setAdminGateOpen((open) => !open);
                  setShowAdminPassword(false);
                  setAdminError("");
                }}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-800 shadow-[0_6px_18px_rgba(0,0,0,0.06)] transition-colors hover:border-zinc-900/40 hover:text-zinc-900"
                aria-label="Admin access"
                aria-expanded={adminGateOpen}
              >
                <KeyIcon />
              </button>
              {gatePanel}
            </div>

            <button
              type="button"
              onClick={() => setMobileNavOpen((open) => !open)}
              className="flex h-11 w-11 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-800 shadow-[0_6px_18px_rgba(0,0,0,0.06)] transition-colors hover:border-zinc-900/45 hover:text-zinc-900 md:hidden"
              aria-label="Toggle menu"
              aria-expanded={mobileNavOpen}
            >
              <MenuIcon open={mobileNavOpen} />
            </button>
          </div>
        </div>

        {mobileNavOpen ? (
          <div className="mt-3 grid gap-2 border-t border-zinc-300/65 pt-3 md:hidden">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={`border-b px-2 py-3 text-[15px] font-semibold tracking-[0.07em] uppercase transition-colors ${
                  isActive(link.href)
                    ? "border-zinc-900 text-zinc-900"
                    : "border-transparent text-zinc-700/90 hover:border-zinc-500/45 hover:text-zinc-900"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </header>
  );
}
