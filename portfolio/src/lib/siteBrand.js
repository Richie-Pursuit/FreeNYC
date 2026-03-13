const SITE_NAME = "Free NYC";
const DEFAULT_TEXT_COLOR = "#111111";
const DEFAULT_LOGO_COLOR = "#111111";
const DEFAULT_FONT_KEY = "marker";
const DEFAULT_LOGO_MODE = "default";
export const MAX_CUSTOM_LOGO_DATA_URL_LENGTH = 1_500_000;

export const siteBrand = {
  name: SITE_NAME,
  portfolioTitle: "Street Photography Portfolio",
  description: "Minimalist Leica-style digital gallery exhibition.",
  keywords: [
    "street photography",
    "nyc photography",
    "photo portfolio",
    "leica style",
    SITE_NAME.toLowerCase(),
  ],
  aboutHeadline: SITE_NAME,
  aboutSupportingLine: `${SITE_NAME} is my ongoing visual diary of New York street life, built from patience, instinct, and respect for everyday people.`,
  contactFromName: SITE_NAME,
};

export const NAVBAR_BRAND_FONT_OPTIONS = [
  {
    key: "marker",
    label: "Marker",
    note: "Bold handwritten gallery signature",
    group: "core",
    style: {
      fontFamily: "var(--font-logo), 'Permanent Marker', cursive",
      fontWeight: 400,
      letterSpacing: "-0.02em",
    },
  },
  {
    key: "editorial",
    label: "Editorial Serif",
    note: "Magazine-style and refined",
    group: "core",
    style: {
      fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
      fontWeight: 700,
      letterSpacing: "-0.03em",
    },
  },
  {
    key: "didot",
    label: "Didot Display",
    note: "Fashion-forward high contrast",
    group: "core",
    style: {
      fontFamily: 'Didot, "Bodoni MT", "Times New Roman", serif',
      fontWeight: 700,
      letterSpacing: "-0.03em",
    },
  },
  {
    key: "modern",
    label: "Modern Sans",
    note: "Clean and contemporary",
    group: "core",
    style: {
      fontFamily: '"Avenir Next", Avenir, "Helvetica Neue", Arial, sans-serif',
      fontWeight: 700,
      letterSpacing: "-0.03em",
    },
  },
  {
    key: "grotesk",
    label: "Grotesk",
    note: "Sharp studio-style sans",
    group: "core",
    style: {
      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      fontWeight: 800,
      letterSpacing: "-0.04em",
    },
  },
  {
    key: "humanist",
    label: "Humanist",
    note: "Warm and approachable",
    group: "core",
    style: {
      fontFamily: '"Gill Sans", "Trebuchet MS", sans-serif',
      fontWeight: 700,
      letterSpacing: "-0.025em",
    },
  },
  {
    key: "typewriter",
    label: "Typewriter",
    note: "Poetic and archival",
    group: "core",
    style: {
      fontFamily: '"Courier Prime", "Courier New", monospace',
      fontWeight: 700,
      letterSpacing: "-0.02em",
    },
  },
  {
    key: "condensed",
    label: "Condensed",
    note: "Poster-like and punchy",
    group: "core",
    style: {
      fontFamily: '"Arial Narrow", "Franklin Gothic Medium", Arial, sans-serif',
      fontWeight: 700,
      letterSpacing: "-0.04em",
    },
  },
  {
    key: "elegant",
    label: "Elegant Script",
    note: "Soft and expressive",
    group: "core",
    style: {
      fontFamily: '"Snell Roundhand", "Segoe Script", "Brush Script MT", cursive',
      fontWeight: 600,
      letterSpacing: "-0.01em",
    },
  },
  {
    key: "block-party",
    label: "Block Party",
    note: "Big borough flyer energy",
    group: "extended",
    style: {
      fontFamily: "var(--font-bungee), 'Bungee', sans-serif",
      fontWeight: 400,
      letterSpacing: "0.01em",
    },
  },
  {
    key: "mixtape",
    label: "Mixtape",
    note: "Tall rap-poster headline",
    group: "extended",
    style: {
      fontFamily: "var(--font-bebas), 'Bebas Neue', sans-serif",
      fontWeight: 400,
      letterSpacing: "0.02em",
    },
  },
  {
    key: "stencil",
    label: "Stencil",
    note: "Hard-edged street statement",
    group: "extended",
    style: {
      fontFamily: "var(--font-black-ops), 'Black Ops One', sans-serif",
      fontWeight: 400,
      letterSpacing: "0.015em",
    },
  },
  {
    key: "club",
    label: "Club Neon",
    note: "Late-night venue and radio-show feel",
    group: "extended",
    style: {
      fontFamily: "var(--font-righteous), 'Righteous', sans-serif",
      fontWeight: 400,
      letterSpacing: "0.005em",
    },
  },
];

export const NAVBAR_BRAND_COLOR_OPTIONS = [
  { label: "Ink", value: "#111111" },
  { label: "Charcoal", value: "#2F3437" },
  { label: "Gallery Red", value: "#A33A2B" },
  { label: "Cobalt", value: "#2957C8" },
  { label: "Forest", value: "#1F6A52" },
  { label: "Teal", value: "#146E7A" },
  { label: "Plum", value: "#5C3D7A" },
  { label: "Amber", value: "#B16A0A" },
  { label: "Rosewood", value: "#8C3141" },
  { label: "Steel", value: "#4B647A" },
];

export const NAVBAR_LOGO_SOURCE_OPTIONS = [
  { key: "default", label: "Original Mark" },
  { key: "custom", label: "PNG Logo" },
];

function clampChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function normalizeHexPair(value) {
  return value.length === 1 ? `${value}${value}` : value;
}

function hexToRgb(hex) {
  const cleaned = String(hex || "")
    .trim()
    .replace(/^#/, "")
    .toLowerCase();

  if (cleaned.length !== 3 && cleaned.length !== 6) {
    return null;
  }

  const normalized =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map(normalizeHexPair)
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

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

function mixColors(hexA, hexB, ratio) {
  const colorA = hexToRgb(hexA);
  const colorB = hexToRgb(hexB);
  if (!colorA || !colorB) {
    return DEFAULT_TEXT_COLOR;
  }

  const mix = {
    r: colorA.r + (colorB.r - colorA.r) * ratio,
    g: colorA.g + (colorB.g - colorA.g) * ratio,
    b: colorA.b + (colorB.b - colorA.b) * ratio,
  };

  return rgbToHex(mix);
}

export function sanitizeBrandColor(value, fallback = DEFAULT_TEXT_COLOR) {
  const match = String(value || "")
    .trim()
    .match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);

  if (!match) {
    return fallback;
  }

  const normalized = match[1].length === 3
    ? match[1]
        .split("")
        .map(normalizeHexPair)
        .join("")
    : match[1];

  return `#${normalized.toUpperCase()}`;
}

export function getDefaultNavbarBrandSettings() {
  return {
    brandName: siteBrand.name,
    fontKey: DEFAULT_FONT_KEY,
    textColor: DEFAULT_TEXT_COLOR,
    logoColor: DEFAULT_LOGO_COLOR,
    logoMode: DEFAULT_LOGO_MODE,
    customLogoDataUrl: "",
  };
}

export function getNavbarBrandTextClass(name = siteBrand.name) {
  const length = String(name || "").trim().length;

  if (length > 20) {
    return "max-w-[10ch] text-[1.2rem] leading-[0.92] sm:max-w-[13ch] sm:text-[1.65rem] lg:text-[1.95rem]";
  }

  if (length > 12) {
    return "max-w-[11ch] text-[1.45rem] leading-[0.94] sm:max-w-[14ch] sm:text-[2rem] lg:text-[2.2rem]";
  }

  return "text-[1.86rem] leading-none sm:text-[2.5rem]";
}

export function getNavbarBrandFontOption(fontKey) {
  return (
    NAVBAR_BRAND_FONT_OPTIONS.find((option) => option.key === fontKey) ||
    NAVBAR_BRAND_FONT_OPTIONS.find((option) => option.key === DEFAULT_FONT_KEY) ||
    NAVBAR_BRAND_FONT_OPTIONS[0]
  );
}

export function sanitizeBrandFontKey(fontKey) {
  return getNavbarBrandFontOption(fontKey).key;
}

export function sanitizeBrandLogoDataUrl(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    return "";
  }

  if (!/^data:image\/png;base64,[a-z0-9+/=]+$/i.test(normalized)) {
    return "";
  }

  if (normalized.length > MAX_CUSTOM_LOGO_DATA_URL_LENGTH) {
    return "";
  }

  return normalized;
}

export function sanitizeBrandLogoMode(value, hasCustomLogo = false) {
  if (value === "custom" && hasCustomLogo) {
    return "custom";
  }

  return DEFAULT_LOGO_MODE;
}

export function hasCustomNavbarLogo(settings = {}) {
  return Boolean(sanitizeBrandLogoDataUrl(settings?.customLogoDataUrl));
}

export function normalizeNavbarBrandSettings(input = {}) {
  const defaults = getDefaultNavbarBrandSettings();
  const customLogoDataUrl = sanitizeBrandLogoDataUrl(input?.customLogoDataUrl);

  return {
    brandName:
      typeof input?.brandName === "string" && input.brandName.trim()
        ? input.brandName.trim().slice(0, 48)
        : defaults.brandName,
    fontKey: sanitizeBrandFontKey(input?.fontKey),
    textColor: sanitizeBrandColor(input?.textColor, defaults.textColor),
    logoColor: sanitizeBrandColor(input?.logoColor, defaults.logoColor),
    logoMode: sanitizeBrandLogoMode(input?.logoMode, Boolean(customLogoDataUrl)),
    customLogoDataUrl,
  };
}

export function getNavbarBrandTextStyle(settings = {}) {
  const normalized = normalizeNavbarBrandSettings(settings);
  const fontOption = getNavbarBrandFontOption(normalized.fontKey);

  return {
    ...fontOption.style,
    color: normalized.textColor,
  };
}

export function getNavbarLogoColors(color) {
  const logoColor = sanitizeBrandColor(color, DEFAULT_LOGO_COLOR);

  return {
    fill: mixColors(logoColor, "#F5F5F0", 0.82),
    split: logoColor,
    stroke: mixColors(logoColor, "#050505", 0.35),
  };
}
