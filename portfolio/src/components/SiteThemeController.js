"use client";

import { useEffect, useLayoutEffect } from "react";
import { applySiteSettingsToDocument, normalizeSiteSettings } from "@/lib/siteSettings";

export default function SiteThemeController({ initialSettings }) {
  useLayoutEffect(() => {
    applySiteSettingsToDocument(normalizeSiteSettings(initialSettings || {}));
  }, [initialSettings]);

  useEffect(() => {
    const handleSiteSettingsUpdated = (event) => {
      applySiteSettingsToDocument(normalizeSiteSettings(event?.detail || {}));
    };

    window.addEventListener("site-settings-updated", handleSiteSettingsUpdated);

    return () => {
      window.removeEventListener("site-settings-updated", handleSiteSettingsUpdated);
    };
  }, []);

  return null;
}
