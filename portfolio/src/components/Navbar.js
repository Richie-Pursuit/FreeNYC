"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

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
  const [adminError, setAdminError] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [adminGateOpen, setAdminGateOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
    setAdminGateOpen(false);
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
      className={`absolute right-0 top-12 z-50 w-[min(260px,calc(100vw-1.5rem))] rounded-xl border border-foreground/15 bg-white/95 p-3 shadow-[0_12px_28px_rgba(0,0,0,0.12)] transition-all ${
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
          type="password"
          value={adminPassword}
          onChange={(event) => setAdminPassword(event.target.value)}
          placeholder="Enter password"
          className="w-full border border-foreground/25 bg-white px-3 py-2 text-sm text-foreground placeholder:text-foreground/45 outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/15"
        />
        <button
          type="submit"
          className="w-full border border-foreground bg-foreground px-3 py-2 text-[10px] tracking-[0.14em] text-background uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
          disabled={isUnlocking}
        >
          {isUnlocking ? "Checking..." : "Unlock"}
        </button>
      </form>
      {adminError ? <p className="mt-2 text-xs text-red-700">{adminError}</p> : null}
    </div>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-foreground/10 bg-background/92 px-3 py-3 backdrop-blur-md sm:px-6 lg:px-12">
      <div className="mx-auto w-full max-w-[1800px]">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/"
            className="display-font rounded-md px-2 py-1 text-base tracking-[0.1em] text-foreground uppercase transition-opacity hover:opacity-80 sm:text-xl sm:tracking-[0.14em]"
          >
            Free NYC
          </Link>

          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-1 rounded-full border border-foreground/15 bg-white/80 p-1 shadow-[0_8px_26px_rgba(0,0,0,0.07)] md:flex">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-3 py-2 text-[11px] tracking-[0.16em] uppercase transition-colors sm:px-4 ${
                    isActive(link.href)
                      ? "bg-foreground text-background"
                      : "text-foreground/72 hover:bg-foreground/8 hover:text-foreground"
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
                  setAdminError("");
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground/20 bg-white/80 text-foreground/85 shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-colors hover:bg-white hover:text-foreground"
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
              className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground/20 bg-white/80 text-foreground/85 shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-colors hover:bg-white hover:text-foreground md:hidden"
              aria-label="Toggle menu"
              aria-expanded={mobileNavOpen}
            >
              <MenuIcon open={mobileNavOpen} />
            </button>
          </div>
        </div>

        {mobileNavOpen ? (
          <div className="mt-3 grid gap-2 rounded-2xl border border-foreground/15 bg-white/85 p-2 shadow-[0_10px_24px_rgba(0,0,0,0.08)] md:hidden">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-xl px-4 py-3 text-xs tracking-[0.14em] uppercase transition-colors ${
                  isActive(link.href)
                    ? "bg-foreground text-background"
                    : "text-foreground/80 hover:bg-foreground/8 hover:text-foreground"
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
