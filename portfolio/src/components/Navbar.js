"use client";

import { useState } from "react";
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

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);

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
      router.push("/login?callbackUrl=/admin");
    } catch (error) {
      setAdminError(error.message || "Invalid password");
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-foreground/10 bg-background/92 px-4 py-4 backdrop-blur-md sm:px-8 lg:px-12">
      <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between gap-4">
        <Link
          href="/"
          className="display-font rounded-md px-2 py-1 text-xl tracking-[0.16em] text-foreground uppercase transition-opacity hover:opacity-80"
        >
          Free NYC
        </Link>

        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-1 rounded-full border border-foreground/15 bg-white/80 p-1 shadow-[0_8px_26px_rgba(0,0,0,0.07)]">
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

          <div className="group relative">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-foreground/20 bg-white/80 text-foreground/80 shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-colors hover:bg-white hover:text-foreground"
              aria-label="Admin access"
            >
              <KeyIcon />
            </button>

            <div className="pointer-events-none absolute top-12 right-0 w-[220px] translate-y-1 rounded-xl border border-foreground/15 bg-white/95 p-3 opacity-0 shadow-[0_12px_28px_rgba(0,0,0,0.12)] transition-all group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100">
              <p className="text-[10px] tracking-[0.14em] text-foreground/65 uppercase">
                Admin Password
              </p>
              <form onSubmit={handleUnlock} className="mt-2 space-y-2">
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                  placeholder="Enter password"
                  className="w-full border border-foreground/25 px-3 py-2 text-sm text-foreground placeholder:text-foreground/45 outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/15"
                />
                <button
                  type="submit"
                  className="w-full border border-foreground bg-foreground px-3 py-2 text-[10px] tracking-[0.14em] text-background uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
                  disabled={isUnlocking}
                >
                  {isUnlocking ? "Checking..." : "Unlock"}
                </button>
              </form>
              {adminError ? (
                <p className="mt-2 text-xs text-red-700">{adminError}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
