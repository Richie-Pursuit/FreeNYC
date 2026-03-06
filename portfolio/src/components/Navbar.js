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
    <header className="sticky top-0 z-40 border-b border-foreground/15 bg-[linear-gradient(180deg,rgba(246,246,243,0.97)_0%,rgba(246,246,243,0.91)_100%)] px-3 py-3 backdrop-blur-md sm:px-6 lg:px-12">
      <div className="mx-auto w-full max-w-[1800px]">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/"
            className="group relative inline-flex rounded-md px-2 py-1"
          >
            <span className="logo-font relative z-10 text-lg leading-none text-foreground uppercase transition-transform duration-300 group-hover:scale-[1.02] sm:text-[1.7rem]">
              Free NYC
            </span>
            <span className="pointer-events-none absolute right-1 bottom-1 left-1 h-2 -skew-x-12 rounded-sm bg-foreground/14 transition-colors duration-300 group-hover:bg-foreground/22 sm:h-2.5" />
          </Link>

          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-1.5 rounded-[1.1rem] border border-foreground/25 bg-white/92 p-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.08)] md:flex">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-[0.9rem] px-3 py-2 text-[11px] tracking-[0.16em] uppercase transition-colors sm:px-4 ${
                    isActive(link.href)
                      ? "bg-foreground text-background shadow-[inset_0_-2px_0_rgba(255,255,255,0.24)]"
                      : "text-foreground/78 hover:bg-foreground/10 hover:text-foreground"
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
                className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground/25 bg-white/92 text-foreground/90 shadow-[0_8px_24px_rgba(0,0,0,0.07)] transition-colors hover:bg-white hover:text-foreground"
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
              className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground/25 bg-white/92 text-foreground/90 shadow-[0_8px_24px_rgba(0,0,0,0.07)] transition-colors hover:bg-white hover:text-foreground md:hidden"
              aria-label="Toggle menu"
              aria-expanded={mobileNavOpen}
            >
              <MenuIcon open={mobileNavOpen} />
            </button>
          </div>
        </div>

        {mobileNavOpen ? (
          <div className="mt-3 grid gap-2 rounded-2xl border border-foreground/20 bg-white/92 p-2 shadow-[0_10px_24px_rgba(0,0,0,0.08)] md:hidden">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-xl px-4 py-3 text-xs tracking-[0.14em] uppercase transition-colors ${
                  isActive(link.href)
                    ? "bg-foreground text-background"
                    : "text-foreground/80 hover:bg-foreground/10 hover:text-foreground"
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
