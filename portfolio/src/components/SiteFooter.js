"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  getDefaultSiteSettingsValues,
  normalizeSiteSettings,
} from "@/lib/siteSettings";

export default function SiteFooter({ initialSettings = null }) {
  const [liveSiteSettings, setLiveSiteSettings] = useState(null);
  const siteSettings = useMemo(
    () =>
      normalizeSiteSettings(
        liveSiteSettings || initialSettings || getDefaultSiteSettingsValues(),
      ),
    [initialSettings, liveSiteSettings],
  );

  useEffect(() => {
    const handleSiteSettingsUpdated = (event) => {
      setLiveSiteSettings(event?.detail || {});
    };

    window.addEventListener("site-settings-updated", handleSiteSettingsUpdated);
    window.addEventListener("site-brand-updated", handleSiteSettingsUpdated);

    return () => {
      window.removeEventListener("site-settings-updated", handleSiteSettingsUpdated);
      window.removeEventListener("site-brand-updated", handleSiteSettingsUpdated);
    };
  }, []);

  return (
    <footer className="theme-footer-shell border-t px-4 py-7 sm:px-8 lg:px-12">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col items-start gap-3 text-[11px] tracking-[0.16em] uppercase sm:flex-row sm:items-center sm:justify-between sm:tracking-[0.18em]">
        <a
          href="https://instagram.com"
          target="_blank"
          rel="noreferrer"
          className="theme-footer-link"
        >
          Instagram
        </a>
        <div
          className="flex flex-wrap items-center gap-3"
          style={{ color: "var(--footer-muted)" }}
        >
          <Link href="/contact" className="theme-footer-link">
            Contact
          </Link>
          <Link href="/privacy" className="theme-footer-link">
            Privacy
          </Link>
          <Link href="/terms" className="theme-footer-link">
            Terms
          </Link>
        </div>
        <p style={{ color: "var(--footer-muted)" }}>
          © {new Date().getFullYear()} {siteSettings.brandName}
        </p>
      </div>
    </footer>
  );
}
