"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import BrandLogoMark from "@/components/BrandLogoMark";
import {
  getNavbarBrandTextClass,
  getNavbarBrandTextStyle,
} from "@/lib/siteBrand";
import { getDefaultSiteSettingsValues, normalizeSiteSettings } from "@/lib/siteSettings";

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

function toNavbarLiveSettings(input = null) {
  const normalized = normalizeSiteSettings(input || getDefaultSiteSettingsValues());

  return {
    brandName: normalized.brandName,
    fontKey: normalized.fontKey,
    textColor: normalized.textColor,
    logoColor: normalized.logoColor,
    logoMode: normalized.logoMode,
    customLogoDataUrl: normalized.customLogoDataUrl,
    themeKey: normalized.themeKey,
    navbarColorMode: normalized.navbarColorMode,
    navbarFillStyle: normalized.navbarFillStyle,
    navbarBackgroundColor: normalized.navbarBackgroundColor,
    navbarGradientColor: normalized.navbarGradientColor,
    navbarOpacity: normalized.navbarOpacity,
    navbarTextColor: normalized.navbarTextColor,
  };
}

function areNavbarSettingsEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export default function Navbar({ initialSettings = null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [brandSettings, setBrandSettings] = useState(() => toNavbarLiveSettings(initialSettings));

  useEffect(() => {
    const nextSettings = toNavbarLiveSettings(initialSettings);
    setBrandSettings((current) => (areNavbarSettingsEqual(current, nextSettings) ? current : nextSettings));
  }, [initialSettings]);

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

  useEffect(() => {
    let isActive = true;

    const loadSiteBranding = async () => {
      try {
        const response = await fetch("/api/site-settings", { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        const nextSettings = toNavbarLiveSettings(data?.settings || {});

        if (isActive) {
          setBrandSettings((current) => (areNavbarSettingsEqual(current, nextSettings) ? current : nextSettings));
        }
      } catch {
        if (isActive) {
          const fallbackSettings = toNavbarLiveSettings(getDefaultSiteSettingsValues());
          setBrandSettings((current) =>
            areNavbarSettingsEqual(current, fallbackSettings) ? current : fallbackSettings,
          );
        }
      }
    };

    const handleSiteSettingsUpdated = (event) => {
      const nextSettings = toNavbarLiveSettings(event?.detail || {});
      setBrandSettings((current) => (areNavbarSettingsEqual(current, nextSettings) ? current : nextSettings));
    };

    loadSiteBranding();
    window.addEventListener("site-settings-updated", handleSiteSettingsUpdated);

    return () => {
      isActive = false;
      window.removeEventListener("site-settings-updated", handleSiteSettingsUpdated);
    };
  }, []);

  const brandTextClass = getNavbarBrandTextClass(brandSettings.brandName);
  const brandTextStyle = getNavbarBrandTextStyle(brandSettings);

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
      className={`theme-surface absolute right-0 top-[calc(100%+0.55rem)] z-50 w-[min(260px,calc(100vw-1.5rem))] rounded-xl border p-3 transition-all ${
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
          className="theme-field w-full border px-3 py-2 text-sm outline-none"
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
          className="theme-primary-button w-full border px-3 py-2 text-[10px] tracking-[0.14em] uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
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
    <header className="theme-header-shell sticky top-0 z-40 border-b px-3 pt-[calc(env(safe-area-inset-top)+0.55rem)] pb-2.5 backdrop-blur-md sm:px-6 sm:pt-[calc(env(safe-area-inset-top)+1rem)] sm:pb-3 lg:px-12 lg:pt-[calc(env(safe-area-inset-top)+1.15rem)] lg:pb-4">
      <div className="mx-auto w-full max-w-[1800px]">
        <div className="flex items-center justify-between gap-2.5 sm:gap-3">
          <Link
            href="/"
            className="group relative inline-flex max-w-[calc(100vw-8.75rem)] items-center gap-1.5 rounded-md px-1 py-0.5 sm:max-w-none sm:gap-2.5"
            aria-label={brandSettings.brandName}
          >
            <BrandLogoMark settings={brandSettings} className="h-7 w-9 sm:h-9 sm:w-11" />
            <span
              className={`logo-font relative z-10 block whitespace-normal text-balance text-zinc-950 transition-transform duration-300 group-hover:scale-[1.015] ${brandTextClass}`}
              style={brandTextStyle}
            >
              {brandSettings.brandName}
            </span>
          </Link>

          <div className="flex items-center gap-2.5 sm:gap-4">
            <nav className="hidden items-center gap-6 lg:gap-8 md:flex" aria-label="Primary">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  className={`border-b-2 px-0 py-1.5 text-[16px] font-semibold tracking-[0.08em] uppercase transition-all ${
                    isActive(link.href)
                      ? "border-[color:var(--header-ink)] text-[color:var(--header-ink)]"
                      : "border-transparent text-[color:var(--header-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--header-ink)]"
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
                className="theme-secondary-button inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors sm:h-11 sm:w-11"
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
              className="theme-secondary-button flex h-10 w-10 items-center justify-center rounded-xl border transition-colors md:hidden sm:h-11 sm:w-11"
              aria-label="Toggle menu"
              aria-expanded={mobileNavOpen}
            >
              <MenuIcon open={mobileNavOpen} />
            </button>
          </div>
        </div>

        {mobileNavOpen ? (
          <div className="mt-2.5 grid gap-1.5 border-t border-line pt-2.5 md:hidden">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={`border-b px-2 py-2.5 text-[14px] font-semibold tracking-[0.07em] uppercase transition-colors ${
                  isActive(link.href)
                    ? "border-[color:var(--header-ink)] text-[color:var(--header-ink)]"
                    : "border-transparent text-[color:var(--header-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--header-ink)]"
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
