import {
  getDefaultNavbarBrandSettings,
  normalizeNavbarBrandSettings,
  sanitizeBrandColor,
} from "@/lib/siteBrand";
import {
  getDefaultSiteThemeKey,
  getSiteThemeCssVariables,
  sanitizeSiteThemeKey,
} from "@/lib/siteTheme";

const DEFAULT_CHROME_STYLE_MODE = "theme";
const DEFAULT_TEXT_STYLE_MODE = "theme";
const DEFAULT_NAVBAR_FILL_STYLE = "solid";
const DEFAULT_NAVBAR_BACKGROUND_COLOR = "#F6F6F3";
const DEFAULT_NAVBAR_GRADIENT_COLOR = "#D8D0C5";
const DEFAULT_NAVBAR_TEXT_COLOR = "#111111";
const DEFAULT_NAVBAR_OPACITY = 94;
const DEFAULT_FOOTER_BACKGROUND_COLOR = "#FFFFFF";
const DEFAULT_FOOTER_TEXT_COLOR = "#111111";
const DEFAULT_FOOTER_OPACITY = 82;
const DEFAULT_GLOBAL_TEXT_COLOR = "#111111";
const DEFAULT_TEXT_SCALE_KEY = "default";

export const TEXT_SCALE_OPTIONS = [
  { key: "default", label: "Refined", rootFontSize: "16px", note: "Keeps the current editorial rhythm." },
  { key: "comfortable", label: "Comfortable", rootFontSize: "17px", note: "A little easier to read everywhere." },
  { key: "large", label: "Large", rootFontSize: "18px", note: "The strongest reading size without crowding the layout." },
];

function sanitizeChromeStyleMode(value) {
  return value === "custom" ? "custom" : DEFAULT_CHROME_STYLE_MODE;
}

function sanitizeTextStyleMode(value) {
  return value === "custom" ? "custom" : DEFAULT_TEXT_STYLE_MODE;
}

function sanitizeNavbarFillStyle(value) {
  return value === "gradient" ? "gradient" : DEFAULT_NAVBAR_FILL_STYLE;
}

function sanitizeOpacity(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function hexToRgb(hex) {
  const cleaned = String(hex || "")
    .trim()
    .replace(/^#/, "");

  if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(cleaned)) {
    return null;
  }

  const normalized =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : cleaned;

  const parsed = Number.parseInt(normalized, 16);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
}

function withOpacity(hex, opacityPercent, fallback) {
  const color = hexToRgb(hex) || hexToRgb(fallback);
  if (!color) {
    return fallback;
  }

  return `rgba(${color.r}, ${color.g}, ${color.b}, ${sanitizeOpacity(opacityPercent, 100) / 100})`;
}

function getTextScaleOption(scaleKey) {
  return (
    TEXT_SCALE_OPTIONS.find((option) => option.key === scaleKey) ||
    TEXT_SCALE_OPTIONS.find((option) => option.key === DEFAULT_TEXT_SCALE_KEY) ||
    TEXT_SCALE_OPTIONS[0]
  );
}

function sanitizeTextScaleKey(scaleKey) {
  return getTextScaleOption(scaleKey).key;
}

export function getDefaultSiteSettingsValues() {
  return {
    ...getDefaultNavbarBrandSettings(),
    themeKey: getDefaultSiteThemeKey(),
    navbarColorMode: DEFAULT_CHROME_STYLE_MODE,
    navbarFillStyle: DEFAULT_NAVBAR_FILL_STYLE,
    navbarBackgroundColor: DEFAULT_NAVBAR_BACKGROUND_COLOR,
    navbarGradientColor: DEFAULT_NAVBAR_GRADIENT_COLOR,
    navbarOpacity: DEFAULT_NAVBAR_OPACITY,
    navbarTextColor: DEFAULT_NAVBAR_TEXT_COLOR,
    footerColorMode: DEFAULT_CHROME_STYLE_MODE,
    footerBackgroundColor: DEFAULT_FOOTER_BACKGROUND_COLOR,
    footerOpacity: DEFAULT_FOOTER_OPACITY,
    footerTextColor: DEFAULT_FOOTER_TEXT_COLOR,
    textColorMode: DEFAULT_TEXT_STYLE_MODE,
    globalTextColor: DEFAULT_GLOBAL_TEXT_COLOR,
    textScaleKey: DEFAULT_TEXT_SCALE_KEY,
  };
}

export function normalizeSiteSettings(input = {}) {
  const defaults = getDefaultSiteSettingsValues();

  return {
    ...normalizeNavbarBrandSettings(input),
    themeKey: sanitizeSiteThemeKey(input?.themeKey),
    navbarColorMode: sanitizeChromeStyleMode(input?.navbarColorMode),
    navbarFillStyle: sanitizeNavbarFillStyle(input?.navbarFillStyle),
    navbarBackgroundColor: sanitizeBrandColor(
      input?.navbarBackgroundColor,
      defaults.navbarBackgroundColor,
    ),
    navbarGradientColor: sanitizeBrandColor(
      input?.navbarGradientColor,
      defaults.navbarGradientColor,
    ),
    navbarOpacity: sanitizeOpacity(input?.navbarOpacity, defaults.navbarOpacity),
    navbarTextColor: sanitizeBrandColor(input?.navbarTextColor, defaults.navbarTextColor),
    footerColorMode: sanitizeChromeStyleMode(input?.footerColorMode),
    footerBackgroundColor: sanitizeBrandColor(
      input?.footerBackgroundColor,
      defaults.footerBackgroundColor,
    ),
    footerOpacity: sanitizeOpacity(input?.footerOpacity, defaults.footerOpacity),
    footerTextColor: sanitizeBrandColor(input?.footerTextColor, defaults.footerTextColor),
    textColorMode: sanitizeTextStyleMode(input?.textColorMode),
    globalTextColor: sanitizeBrandColor(input?.globalTextColor, defaults.globalTextColor),
    textScaleKey: sanitizeTextScaleKey(input?.textScaleKey),
  };
}

export function getSiteSettingsCssVariables(input = {}) {
  const settings = normalizeSiteSettings(input);
  const variables = getSiteThemeCssVariables(settings.themeKey);

  if (settings.navbarColorMode === "custom") {
    variables["--header-bg"] =
      settings.navbarFillStyle === "gradient"
        ? `linear-gradient(135deg, ${withOpacity(
            settings.navbarBackgroundColor,
            settings.navbarOpacity,
            DEFAULT_NAVBAR_BACKGROUND_COLOR,
          )} 0%, ${withOpacity(
            settings.navbarGradientColor,
            settings.navbarOpacity,
            DEFAULT_NAVBAR_GRADIENT_COLOR,
          )} 100%)`
        : withOpacity(
            settings.navbarBackgroundColor,
            settings.navbarOpacity,
            DEFAULT_NAVBAR_BACKGROUND_COLOR,
          );
    variables["--header-border"] = withOpacity(
      settings.navbarTextColor,
      18,
      DEFAULT_NAVBAR_TEXT_COLOR,
    );
    variables["--header-ink"] = settings.navbarTextColor;
    variables["--header-muted"] = withOpacity(
      settings.navbarTextColor,
      72,
      DEFAULT_NAVBAR_TEXT_COLOR,
    );
  }

  if (settings.footerColorMode === "custom") {
    variables["--footer-bg"] = withOpacity(
      settings.footerBackgroundColor,
      settings.footerOpacity,
      DEFAULT_FOOTER_BACKGROUND_COLOR,
    );
    variables["--footer-border"] = withOpacity(
      settings.footerTextColor,
      16,
      DEFAULT_FOOTER_TEXT_COLOR,
    );
    variables["--footer-ink"] = settings.footerTextColor;
    variables["--footer-muted"] = withOpacity(
      settings.footerTextColor,
      76,
      DEFAULT_FOOTER_TEXT_COLOR,
    );
    variables["--footer-link"] = settings.footerTextColor;
    variables["--footer-link-hover"] = settings.footerTextColor;
  }

  variables["--root-font-size"] = getTextScaleOption(settings.textScaleKey).rootFontSize;

  if (settings.textColorMode === "custom") {
    variables["--ink"] = settings.globalTextColor;
    variables["--muted"] = withOpacity(
      settings.globalTextColor,
      70,
      DEFAULT_GLOBAL_TEXT_COLOR,
    );
    variables["--focus"] = settings.globalTextColor;
  }

  return variables;
}

export function applySiteSettingsToDocument(input = {}) {
  if (typeof document === "undefined") {
    return;
  }

  const settings = normalizeSiteSettings(input);
  const variables = getSiteSettingsCssVariables(settings);
  const root = document.documentElement;

  Object.entries(variables).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  root.dataset.siteTheme = settings.themeKey;
}
