"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import BrandLogoMark from "@/components/BrandLogoMark";
import {
  getNavbarBrandFontOption,
  getNavbarBrandTextClass,
  getNavbarBrandTextStyle,
  MAX_CUSTOM_LOGO_DATA_URL_LENGTH,
  NAVBAR_BRAND_COLOR_OPTIONS,
  NAVBAR_BRAND_FONT_OPTIONS,
  NAVBAR_LOGO_SOURCE_OPTIONS,
  sanitizeBrandColor,
  siteBrand,
} from "@/lib/siteBrand";
import {
  getSiteTheme,
  getSiteThemeCssVariables,
  SITE_THEME_PRESETS,
} from "@/lib/siteTheme";
import {
  applySiteSettingsToDocument,
  getDefaultSiteSettingsValues,
  getSiteSettingsCssVariables,
  normalizeSiteSettings,
  TEXT_SCALE_OPTIONS,
} from "@/lib/siteSettings";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const MAX_BRAND_LOGO_UPLOAD_BYTES = 4 * 1024 * 1024;
const NAVBAR_LOGO_MAX_WIDTH = 360;
const NAVBAR_LOGO_MAX_HEIGHT = 180;
const CSRF_HEADER_NAME = "x-csrf-token";
const PAGE_SIZE_OPTIONS = [24, 48, 96];
const HOMEPAGE_MAX_PHOTOS = 100;
const HOMEPAGE_COLLECTION_FILTER = "__homepage__";
const COMPACT_ADMIN_MEDIA_QUERIES = ["(max-width: 767px)", "(pointer: coarse)"];
const DEFAULT_COLLECTION = "City Life";
const CHROME_BACKGROUND_COLOR_OPTIONS = [
  { label: "Ivory", value: "#F6F2EA" },
  { label: "Glass White", value: "#FFFFFF" },
  { label: "Stone", value: "#D8D0C5" },
  { label: "Peach", value: "#F0C8B1" },
  { label: "Blush", value: "#E8C7C5" },
  { label: "Sky Mist", value: "#C9DFF4" },
  { label: "Midnight", value: "#15233F" },
  { label: "Burgundy", value: "#6F2734" },
  { label: "Forest", value: "#204E45" },
  { label: "Charcoal", value: "#1F1F21" },
];
const CHROME_TEXT_COLOR_OPTIONS = [
  { label: "Ink", value: "#111111" },
  { label: "Cloud", value: "#F7F4EC" },
  { label: "Amber", value: "#D8B267" },
  { label: "Rose", value: "#F0D7DA" },
  { label: "Sky", value: "#D8E6FF" },
  { label: "Moss", value: "#D5E8DF" },
  { label: "Stone", value: "#D7D0C5" },
];
const GLOBAL_TEXT_COLOR_OPTIONS = [
  { label: "Ink", value: "#111111" },
  { label: "Slate", value: "#253446" },
  { label: "Espresso", value: "#4B342A" },
  { label: "Bottle", value: "#21473F" },
  { label: "Midnight", value: "#1D2742" },
  { label: "Mulberry", value: "#5D3657" },
];
const LIBRARY_SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "curated", label: "Homepage First" },
  { value: "manual", label: "Manual Order" },
];

const defaultUploadForm = {
  title: "",
  alt: "",
  caption: "",
  poem: "",
  collection: DEFAULT_COLLECTION,
  featured: false,
  published: true,
};

const baseCollections = [
  "Street Portraits",
  "Night Walks",
  "Subway Stories",
  "City Life",
];

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s/_-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 40);
}

function fileBaseName(filename) {
  if (typeof filename !== "string") {
    return "Untitled";
  }

  return filename.replace(/\.[a-z0-9]+$/i, "").trim() || "Untitled";
}

function isPngFile(file) {
  if (!file) {
    return false;
  }

  return file.type === "image/png" || /\.png$/i.test(file.name || "");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string" && reader.result) {
        resolve(reader.result);
        return;
      }

      reject(new Error("Unable to read that PNG."));
    };
    reader.onerror = () => reject(new Error("Unable to read that PNG."));
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to process that PNG."));
    image.src = dataUrl;
  });
}

async function fitBrandLogoToNavbar(file) {
  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await loadImageFromDataUrl(sourceDataUrl);
  const scale = Math.min(
    1,
    NAVBAR_LOGO_MAX_WIDTH / Math.max(image.naturalWidth || 1, 1),
    NAVBAR_LOGO_MAX_HEIGHT / Math.max(image.naturalHeight || 1, 1),
  );
  const targetWidth = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
  const targetHeight = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Your browser could not prepare that PNG.");
  }

  context.clearRect(0, 0, targetWidth, targetHeight);
  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const fittedDataUrl = canvas.toDataURL("image/png");
  if (fittedDataUrl.length > MAX_CUSTOM_LOGO_DATA_URL_LENGTH) {
    throw new Error("That PNG is still too large after fitting. Try a simpler logo.");
  }

  return fittedDataUrl;
}

function mergeCollections(...values) {
  const flat = values
    .flat()
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);

  return [...new Set(flat)].sort((a, b) => a.localeCompare(b));
}

function toDraft(photo) {
  return {
    title: photo?.title || "",
    alt: photo?.alt || "",
    caption: photo?.caption || "",
    poem: photo?.poem || "",
    collection: photo?.collection || DEFAULT_COLLECTION,
    featured: Boolean(photo?.featured),
    published: photo?.published !== false,
  };
}

function buildDraftMap(photos, previousDrafts = {}) {
  const nextDrafts = {};

  for (const photo of photos) {
    nextDrafts[photo.photoId] = previousDrafts[photo.photoId] || toDraft(photo);
  }

  return nextDrafts;
}

function toStringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isDraftDirty(photo, draft) {
  if (!photo || !draft) {
    return false;
  }

  return (
    toStringValue(photo.title) !== toStringValue(draft.title) ||
    toStringValue(photo.alt) !== toStringValue(draft.alt) ||
    toStringValue(photo.caption) !== toStringValue(draft.caption) ||
    toStringValue(photo.poem) !== toStringValue(draft.poem) ||
    toStringValue(photo.collection) !== toStringValue(draft.collection) ||
    Boolean(photo.featured) !== Boolean(draft.featured) ||
    (photo.published !== false) !== Boolean(draft.published)
  );
}

function areDraftValuesEqual(a, b) {
  if (!a || !b) {
    return false;
  }

  return (
    toStringValue(a.title) === toStringValue(b.title) &&
    toStringValue(a.alt) === toStringValue(b.alt) &&
    toStringValue(a.caption) === toStringValue(b.caption) &&
    toStringValue(a.poem) === toStringValue(b.poem) &&
    toStringValue(a.collection) === toStringValue(b.collection) &&
    Boolean(a.featured) === Boolean(b.featured) &&
    Boolean(a.published) === Boolean(b.published)
  );
}

function resizeTextarea(element) {
  if (!element) {
    return;
  }

  element.style.height = "auto";
  element.style.height = `${Math.max(140, element.scrollHeight)}px`;
}

function areOrdersEqual(photoList, referenceIds = []) {
  if (!Array.isArray(photoList) || photoList.length !== referenceIds.length) {
    return false;
  }

  for (let index = 0; index < photoList.length; index += 1) {
    if (photoList[index]?.photoId !== referenceIds[index]) {
      return false;
    }
  }

  return true;
}

function reorderPhotoList(photoList, fromPhotoId, toPhotoId) {
  if (!Array.isArray(photoList) || !fromPhotoId || !toPhotoId || fromPhotoId === toPhotoId) {
    return photoList;
  }

  const fromIndex = photoList.findIndex((item) => item.photoId === fromPhotoId);
  const toIndex = photoList.findIndex((item) => item.photoId === toPhotoId);

  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return photoList;
  }

  const next = [...photoList];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function movePhotoListByOffset(photoList, photoId, offset) {
  if (!Array.isArray(photoList) || !photoId || !Number.isInteger(offset) || offset === 0) {
    return photoList;
  }

  const fromIndex = photoList.findIndex((item) => item.photoId === photoId);
  if (fromIndex < 0) {
    return photoList;
  }

  const toIndex = fromIndex + offset;
  if (toIndex < 0 || toIndex >= photoList.length) {
    return photoList;
  }

  const next = [...photoList];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function subscribeToCompactAdminViewport(callback) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const mediaQueries = COMPACT_ADMIN_MEDIA_QUERIES.map((query) => window.matchMedia(query));
  const handleChange = () => callback();

  mediaQueries.forEach((mediaQuery) => mediaQuery.addEventListener("change", handleChange));

  return () => {
    mediaQueries.forEach((mediaQuery) => mediaQuery.removeEventListener("change", handleChange));
  };
}

function getCompactAdminViewportSnapshot() {
  if (typeof window === "undefined") {
    return false;
  }

  return COMPACT_ADMIN_MEDIA_QUERIES.some((query) => window.matchMedia(query).matches);
}

function getEdgeAutoScrollDelta(pointerY, top, bottom, threshold, minSpeed, maxSpeed) {
  if (
    !Number.isFinite(pointerY) ||
    !Number.isFinite(top) ||
    !Number.isFinite(bottom) ||
    bottom <= top
  ) {
    return 0;
  }

  const topZone = top + threshold;
  const bottomZone = bottom - threshold;

  if (pointerY < topZone) {
    const ratio = Math.min(1, (topZone - pointerY) / threshold);
    const eased = ratio * ratio;
    return -Math.round(minSpeed + (maxSpeed - minSpeed) * eased);
  }

  if (pointerY > bottomZone) {
    const ratio = Math.min(1, (pointerY - bottomZone) / threshold);
    const eased = ratio * ratio;
    return Math.round(minSpeed + (maxSpeed - minSpeed) * eased);
  }

  return 0;
}

function resolveDragPreviewElement(currentTarget) {
  if (currentTarget && typeof currentTarget.closest === "function") {
    const card = currentTarget.closest("article");
    if (card instanceof HTMLElement) {
      return card;
    }
  }

  return currentTarget instanceof HTMLElement ? currentTarget : null;
}

function setCardDragPreview(event) {
  const transfer = event?.dataTransfer;
  if (!transfer) {
    return;
  }

  const previewElement = resolveDragPreviewElement(event.currentTarget);
  if (!previewElement) {
    return;
  }

  const rect = previewElement.getBoundingClientRect();
  const fallbackX = rect.width / 2;
  const fallbackY = rect.height / 2;
  const pointerX = Number.isFinite(event.clientX) ? event.clientX - rect.left : fallbackX;
  const pointerY = Number.isFinite(event.clientY) ? event.clientY - rect.top : fallbackY;
  const offsetX = Math.max(0, Math.min(rect.width - 1, pointerX));
  const offsetY = Math.max(0, Math.min(rect.height - 1, pointerY));

  try {
    transfer.setDragImage(previewElement, offsetX, offsetY);
  } catch {
    // Ignore drag preview failures and allow default behavior.
  }
}

async function parseJsonResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMessage =
      (typeof data.error === "string" && data.error) ||
      (typeof data.error?.message === "string" && data.error.message) ||
      (typeof data.message === "string" && data.message) ||
      "Request failed.";
    throw new Error(errorMessage);
  }

  return data;
}

function PoemToolbar({ onInsert }) {
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onInsert("\n")}
        className="border border-line px-2 py-1 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
      >
        Line Break
      </button>
      <button
        type="button"
        onClick={() => onInsert("\n\n")}
        className="border border-line px-2 py-1 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
      >
        New Stanza
      </button>
      <button
        type="button"
        onClick={() => onInsert("*", "*")}
        className="border border-line px-2 py-1 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
      >
        Italic
      </button>
      <button
        type="button"
        onClick={() => onInsert("**", "**")}
        className="border border-line px-2 py-1 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
      >
        Emphasis
      </button>
    </div>
  );
}

function renderPoemInline(value, keyPrefix = "poem") {
  const text = typeof value === "string" ? value : "";
  const pattern = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  const parts = [];
  let cursor = 0;
  let match;
  let index = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      parts.push(
        <span key={`${keyPrefix}-text-${index}`}>
          {text.slice(cursor, match.index)}
        </span>,
      );
      index += 1;
    }

    if (typeof match[1] === "string") {
      parts.push(
        <strong key={`${keyPrefix}-strong-${index}`} className="font-semibold">
          {match[1]}
        </strong>,
      );
    } else if (typeof match[2] === "string") {
      parts.push(
        <em key={`${keyPrefix}-italic-${index}`} className="italic">
          {match[2]}
        </em>,
      );
    }
    index += 1;
    cursor = pattern.lastIndex;
  }

  if (cursor < text.length) {
    parts.push(
      <span key={`${keyPrefix}-tail-${index}`}>
        {text.slice(cursor)}
      </span>,
    );
  }

  return parts.length ? parts : [text];
}

function PoemLivePreview({ value, emptyText = "Preview will appear here.", className = "" }) {
  const lines = typeof value === "string" ? value.split("\n") : [];
  const hasContent = lines.some((line) => line.trim().length > 0);

  return (
    <div className={`rounded-md border border-line bg-zinc-50/80 px-3 py-2.5 ${className}`}>
      <p className="text-[10px] tracking-[0.12em] text-muted uppercase">Live Preview</p>
      <div className="mt-2 space-y-1 text-sm leading-7 text-foreground/90">
        {hasContent ? (
          lines.map((line, lineIndex) => (
            <p key={`preview-line-${lineIndex}`} className="whitespace-pre-wrap">
              {line.trim().length > 0 ? renderPoemInline(line, `line-${lineIndex}`) : " "}
            </p>
          ))
        ) : (
          <p className="italic text-muted">{emptyText}</p>
        )}
      </div>
    </div>
  );
}

function UndoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M8 8H4V4" />
      <path d="M4 8a8 8 0 1 1-1 4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M9 4h6l1 3H8l1-3Z" />
      <path d="M7 7l1 13h8l1-13" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.2-4.2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M7 7l10 10" />
      <path d="M17 7 7 17" />
    </svg>
  );
}

function ActionsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
      <circle cx="8" cy="7" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="11" cy="17" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TypographyIcon() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-end font-semibold leading-none tracking-[-0.1em]"
    >
      <span className="text-[1.15rem]">A</span>
      <span className="ml-0.5 text-[0.82rem] opacity-80">a</span>
    </span>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 16V6" />
      <path d="m7.5 10.5 4.5-4.5 4.5 4.5" />
      <path d="M5 18.5h14" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="m4 20 4.2-1 9.7-9.7-3.2-3.2L5 15.8 4 20Z" />
      <path d="m13.9 6.1 3.2 3.2" />
    </svg>
  );
}

function CaretDownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="m7 10 5 5 5-5" />
    </svg>
  );
}

function ChipCloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M8 8l8 8" />
      <path d="M16 8l-8 8" />
    </svg>
  );
}

function FilterSelectPill({
  label,
  value,
  onChange,
  disabled = false,
  children,
  displayValue,
  valueClassName = "",
}) {
  return (
    <div
      className={`relative inline-flex h-9 items-center gap-2 rounded-full border border-[#e5e5e5] bg-white px-[14px] py-[6px] text-sm shadow-[0_6px_18px_rgba(0,0,0,0.04)] transition-colors hover:border-zinc-400 focus-within:border-zinc-900/40 focus-within:shadow-[0_0_0_3px_rgba(17,17,17,0.06)] ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <span className="text-[10px] tracking-[0.14em] text-zinc-500 uppercase">{label}</span>
      <div className="min-w-0 flex items-center gap-1.5">
        <span className={`truncate text-[15px] font-medium text-zinc-900 ${valueClassName}`}>
          {displayValue}
        </span>
        <span className="pointer-events-none flex h-4 w-4 items-center justify-center text-zinc-500">
          <CaretDownIcon />
        </span>
      </div>

      <select
        aria-label={`${label} filter`}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer rounded-full border-none bg-transparent p-0 opacity-0 outline-none ring-0 shadow-none appearance-none focus:border-none focus:outline-none focus:ring-0 focus:shadow-none focus-visible:outline-none focus-visible:ring-0"
      >
        {children}
      </select>
    </div>
  );
}

function ColorSwatchButton({
  label,
  value,
  selected = false,
  onClick,
  disabled = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      title={`${label} ${value}`}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[12px] font-medium transition-all ${
        selected
          ? "border-zinc-950 bg-zinc-950 text-white shadow-[0_10px_24px_rgba(17,17,17,0.18)]"
          : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400 hover:bg-zinc-50"
      } disabled:cursor-not-allowed disabled:opacity-45`}
    >
      <span
        className={`h-4 w-4 rounded-full border ${selected ? "border-white/55" : "border-black/10"}`}
        style={{ backgroundColor: value }}
        aria-hidden="true"
      />
      <span>{label}</span>
    </button>
  );
}

function CompactColorChipButton({
  label,
  value,
  selected = false,
  onClick,
  disabled = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      title={`${label} ${value}`}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border bg-white transition-all ${
        selected
          ? "border-zinc-950 shadow-[0_10px_22px_rgba(17,17,17,0.14)] ring-2 ring-zinc-950/18 ring-offset-2 ring-offset-white"
          : "border-zinc-200 hover:border-zinc-400 hover:-translate-y-0.5"
      } disabled:cursor-not-allowed disabled:opacity-45`}
    >
      <span
        className="h-5 w-5 rounded-full border border-black/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]"
        style={{ backgroundColor: value }}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </button>
  );
}

function CustomColorChipButton({
  label = "Custom color",
  value,
  onChange,
  selected = false,
  disabled = false,
}) {
  return (
    <label
      className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full border bg-white transition-all ${
        selected
          ? "border-zinc-950 shadow-[0_10px_22px_rgba(17,17,17,0.14)] ring-2 ring-zinc-950/18 ring-offset-2 ring-offset-white"
          : "border-zinc-200 hover:border-zinc-400 hover:-translate-y-0.5"
      } ${disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer"}`}
      title={label}
    >
      <span
        className="relative flex h-5 w-5 items-center justify-center rounded-full border border-black/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]"
        style={{ backgroundColor: value }}
        aria-hidden="true"
      >
        <span className="absolute inset-0 rounded-full bg-white/32" />
        <span className="relative h-3.5 w-3.5 text-zinc-900">
          <PlusIcon />
        </span>
      </span>
      <input
        type="color"
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="absolute inset-0 h-full w-full cursor-pointer rounded-full opacity-0"
        aria-label={label}
      />
      <span className="sr-only">{label}</span>
    </label>
  );
}

function BrandColorSwatchPalette({
  options,
  value,
  onSelect,
  onCustomChange,
  customLabel,
  disabled = false,
  className = "",
}) {
  const usesPresetColor = hasColorOption(options, value);

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {options.map((option) => (
        <CompactColorChipButton
          key={`${customLabel}-${option.value}`}
          label={option.label}
          value={option.value}
          selected={value === option.value}
          onClick={() => onSelect(option.value)}
          disabled={disabled}
        />
      ))}
      <CustomColorChipButton
        label={customLabel}
        value={value}
        selected={!usesPresetColor}
        onChange={onCustomChange}
        disabled={disabled}
      />
    </div>
  );
}

function getColorOptionLabel(options, value) {
  return options.find((option) => option.value.toLowerCase() === String(value).toLowerCase())?.label || value;
}

function hasColorOption(options, value) {
  return options.some((option) => option.value.toLowerCase() === String(value).toLowerCase());
}

function PanelSelectInput({
  label,
  value,
  displayValue,
  onChange,
  disabled = false,
  children,
  className = "",
}) {
  return (
    <label className={`grid gap-1.5 ${className}`}>
      <span className="text-[11px] tracking-[0.12em] text-zinc-500 uppercase">{label}</span>
      <div
        className={`relative flex h-10 items-center justify-between rounded-2xl border border-zinc-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,248,248,0.96)_100%)] px-4 shadow-[0_8px_22px_rgba(0,0,0,0.05)] transition-colors ${
          disabled
            ? "opacity-60"
            : "hover:border-zinc-300 focus-within:border-zinc-900/35 focus-within:shadow-[0_0_0_3px_rgba(17,17,17,0.05)]"
        }`}
      >
        <span className="truncate text-[14px] font-medium text-zinc-900">{displayValue}</span>
        <span className="pointer-events-none flex h-4 w-4 items-center justify-center text-zinc-500">
          <CaretDownIcon />
        </span>

        <select
          value={value}
          onChange={onChange}
          disabled={disabled}
          className="absolute inset-0 h-full w-full cursor-pointer rounded-xl border-none bg-transparent p-0 opacity-0 outline-none ring-0 shadow-none appearance-none focus:border-none focus:outline-none focus:ring-0 focus:shadow-none focus-visible:outline-none focus-visible:ring-0"
        >
          {children}
        </select>
      </div>
    </label>
  );
}

function LibraryActionButton({
  icon,
  children,
  variant = "secondary",
  className = "",
  ...props
}) {
  const variantClass =
    variant === "primary"
      ? "border-zinc-950 bg-zinc-950 text-white shadow-[0_10px_24px_rgba(17,17,17,0.18)] hover:border-zinc-800 hover:bg-zinc-800"
      : variant === "danger"
        ? "border-red-700 bg-red-600 text-white shadow-[0_10px_24px_rgba(220,38,38,0.22)] hover:border-red-600 hover:bg-red-500"
        : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400 hover:bg-zinc-50";

  return (
    <button
      type="button"
      className={`inline-flex min-h-[46px] items-center justify-start gap-2.5 rounded-2xl border px-4 py-3 text-left text-[13px] font-medium tracking-[0.01em] transition-all disabled:pointer-events-none disabled:opacity-45 ${variantClass} ${className}`}
      {...props}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {icon}
      </span>
      <span>{children}</span>
    </button>
  );
}

function MoveArrowIcon({ direction = "up" }) {
  const rotationClass =
    direction === "down"
      ? "rotate-180"
      : direction === "left"
        ? "-rotate-90"
        : direction === "right"
          ? "rotate-90"
          : "";

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
      className={rotationClass}
    >
      <path d="M12 5v14" />
      <path d="m7 10 5-5 5 5" />
    </svg>
  );
}

function ToggleSwitch({
  label,
  checked,
  onChange,
  disabled = false,
  description = "",
  tone = "default",
}) {
  const surfaceToneClass =
    checked && tone === "homepage"
      ? "border-emerald-200 bg-emerald-50/70"
      : checked && tone === "published"
        ? "border-sky-200 bg-sky-50/70"
        : "border-line bg-white";
  const trackToneClass =
    tone === "homepage"
      ? "peer-checked:bg-emerald-600"
      : tone === "published"
        ? "peer-checked:bg-sky-600"
        : "peer-checked:bg-foreground";

  return (
    <label className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 ${surfaceToneClass}`}>
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
      </div>
      <span className="relative inline-flex h-6 w-11 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="peer sr-only"
          aria-label={label}
        />
        <span
          className={`absolute inset-0 rounded-full bg-zinc-300 transition peer-disabled:opacity-50 ${trackToneClass}`}
        />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5 peer-disabled:opacity-70" />
      </span>
    </label>
  );
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("library");

  const [uploadForm, setUploadForm] = useState(defaultUploadForm);
  const [files, setFiles] = useState([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadResults, setUploadResults] = useState([]);

  const [photos, setPhotos] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [collections, setCollections] = useState(baseCollections);
  const [ready, setReady] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [csrfToken, setCsrfToken] = useState("");
  const [manageStatus, setManageStatus] = useState("idle");
  const [manageMessage, setManageMessage] = useState("");
  const [savedBrandSettings, setSavedBrandSettings] = useState(getDefaultSiteSettingsValues());
  const [brandSettingsDraft, setBrandSettingsDraft] = useState(getDefaultSiteSettingsValues());
  const [brandingStatus, setBrandingStatus] = useState("idle");
  const [brandingMessage, setBrandingMessage] = useState("");
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [isPreparingBrandLogo, setIsPreparingBrandLogo] = useState(false);
  const [canUndoBranding, setCanUndoBranding] = useState(false);
  const [showExtendedBrandFonts, setShowExtendedBrandFonts] = useState(false);
  const [activeChromePanel, setActiveChromePanel] = useState("header");
  const [activeNavbarPaletteTarget, setActiveNavbarPaletteTarget] = useState("start");

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("All");
  const [librarySort, setLibrarySort] = useState("newest");
  const [publishedFilter, setPublishedFilter] = useState("all");
  const [pageSize, setPageSize] = useState(48);
  const [page, setPage] = useState(1);
  const [totalPhotos, setTotalPhotos] = useState(0);

  const [selectedPhotoIds, setSelectedPhotoIds] = useState([]);
  const [bulkMoveCollection, setBulkMoveCollection] = useState(DEFAULT_COLLECTION);
  const [activePhotoId, setActivePhotoId] = useState("");
  const [homepageActivePhotoId, setHomepageActivePhotoId] = useState("");
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const [savingPhotoId, setSavingPhotoId] = useState("");
  const [deletingPhotoId, setDeletingPhotoId] = useState("");
  const [showLibraryToolsMenu, setShowLibraryToolsMenu] = useState(false);
  const [isLibraryEditorOpen, setIsLibraryEditorOpen] = useState(false);
  const [showLibraryPoemFormatting, setShowLibraryPoemFormatting] = useState(false);
  const [showUploadPoemFormatting, setShowUploadPoemFormatting] = useState(false);
  const [showUploadPoemPreview, setShowUploadPoemPreview] = useState(false);
  const [showLibraryPoemPreview, setShowLibraryPoemPreview] = useState(false);
  const [showHomepagePoemPreview, setShowHomepagePoemPreview] = useState(false);
  const [showModalPoemPreview, setShowModalPoemPreview] = useState(false);
  const [homepagePool, setHomepagePool] = useState([]);
  const [homepagePhotoIds, setHomepagePhotoIds] = useState([]);
  const [homepageSearchInput, setHomepageSearchInput] = useState("");
  const [homepageLoading, setHomepageLoading] = useState(false);
  const [homepageStatus, setHomepageStatus] = useState("idle");
  const [homepageMessage, setHomepageMessage] = useState("");
  const [homepageDraggingPhotoId, setHomepageDraggingPhotoId] = useState("");
  const [homepageDragOverPhotoId, setHomepageDragOverPhotoId] = useState("");
  const [isHomepageEditorOpen, setIsHomepageEditorOpen] = useState(false);
  const [isSavingHomepage, setIsSavingHomepage] = useState(false);
  const [hasHomepageChanges, setHasHomepageChanges] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [renameFromCollection, setRenameFromCollection] = useState("");
  const [renameToCollection, setRenameToCollection] = useState("");
  const [deleteCollectionName, setDeleteCollectionName] = useState("");
  const [isUpdatingCollections, setIsUpdatingCollections] = useState(false);
  const [draggingPhotoId, setDraggingPhotoId] = useState("");
  const [dragOverPhotoId, setDragOverPhotoId] = useState("");
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [isAutoSavingHomepageOrder, setIsAutoSavingHomepageOrder] = useState(false);
  const [autoSavingPhotoId, setAutoSavingPhotoId] = useState("");
  const [lastOrderSnapshot, setLastOrderSnapshot] = useState([]);
  const [libraryOriginalSnapshot, setLibraryOriginalSnapshot] = useState({
    photoId: "",
    draft: null,
  });
  const [switchPrompt, setSwitchPrompt] = useState({
    open: false,
    nextPhotoId: "",
  });
  const [libraryExitPrompt, setLibraryExitPrompt] = useState({
    open: false,
  });
  const [reorderConfirmPrompt, setReorderConfirmPrompt] = useState({
    open: false,
    sortLabel: "",
    nextOrderIds: [],
    previousOrderIds: [],
  });
  const [workspaceSwitchPrompt, setWorkspaceSwitchPrompt] = useState({
    open: false,
    nextTab: "",
  });
  const [isSavingBeforeWorkspaceSwitch, setIsSavingBeforeWorkspaceSwitch] = useState(false);

  const [poemModal, setPoemModal] = useState({
    open: false,
    mode: "upload",
    photoId: "",
  });

  const uploadPoemRef = useRef(null);
  const editorPoemRef = useRef(null);
  const modalPoemRef = useRef(null);
  const editorPanelRef = useRef(null);
  const libraryToolsRef = useRef(null);
  const homepageSequenceRef = useRef(null);
  const brandLogoInputRef = useRef(null);
  const brandingAutoSaveTimerRef = useRef(null);
  const latestBrandSettingsDraftRef = useRef(getDefaultSiteSettingsValues());
  const brandingUndoRef = useRef(null);
  const libraryAutoSaveTimerRef = useRef(null);
  const baseOrderRef = useRef([]);
  const baseHomepageOrderRef = useRef([]);
  const skipNextLibraryLoadRef = useRef(false);

  const isUploading = uploadStatus === "uploading";
  const selectedSet = useMemo(() => new Set(selectedPhotoIds), [selectedPhotoIds]);
  const selectedCount = selectedPhotoIds.length;

  const collectionOptions = useMemo(
    () => mergeCollections(collections, photos.map((photo) => photo.collection)),
    [collections, photos],
  );

  const isUploadTab = activeTab === "upload";
  const isHomepageTab = activeTab === "homepage";
  const isBrandingTab = activeTab === "branding";
  const isDraftsTab = activeTab === "drafts";
  const isLibraryTab = activeTab === "library" || isDraftsTab;
  const isCompactAdminViewport = useSyncExternalStore(
    subscribeToCompactAdminViewport,
    getCompactAdminViewportSnapshot,
    () => false,
  );
  const isHomepageCollectionFilter = collectionFilter === HOMEPAGE_COLLECTION_FILTER;
  const canManualReorder = isLibraryTab && !isDraftsTab;
  const supportsDesktopDrag = !isCompactAdminViewport;
  const effectivePublishedFilter = isDraftsTab ? "draft" : publishedFilter;
  const librarySortOptions = useMemo(
    () =>
      isDraftsTab
        ? LIBRARY_SORT_OPTIONS.filter(
            (option) => option.value !== "manual" && option.value !== "curated",
          )
        : LIBRARY_SORT_OPTIONS.filter((option) => option.value !== "manual"),
    [isDraftsTab],
  );

  const activePhoto = useMemo(
    () => photos.find((photo) => photo.photoId === activePhotoId) || null,
    [activePhotoId, photos],
  );

  const activeDraft = useMemo(() => {
    if (!activePhotoId) {
      return null;
    }

    return drafts[activePhotoId] || null;
  }, [activePhotoId, drafts]);

  const activeIsDirty = useMemo(() => {
    if (!activePhoto || !activeDraft) {
      return false;
    }

    return isDraftDirty(activePhoto, activeDraft);
  }, [activeDraft, activePhoto]);
  const hasOriginalSnapshotForActivePhoto = useMemo(
    () => libraryOriginalSnapshot.photoId === activePhotoId && Boolean(libraryOriginalSnapshot.draft),
    [activePhotoId, libraryOriginalSnapshot.draft, libraryOriginalSnapshot.photoId],
  );
  const canRestoreOriginal = useMemo(() => {
    if (!hasOriginalSnapshotForActivePhoto || !activeDraft) {
      return false;
    }
    return isDraftDirty(libraryOriginalSnapshot.draft, activeDraft);
  }, [activeDraft, hasOriginalSnapshotForActivePhoto, libraryOriginalSnapshot.draft]);
  const homepagePhotoMap = useMemo(
    () => new Map(homepagePool.map((photo) => [photo.photoId, photo])),
    [homepagePool],
  );
  const homepageSearchTerm = homepageSearchInput.trim().toLowerCase();
  const homepageSelectedSet = useMemo(() => new Set(homepagePhotoIds), [homepagePhotoIds]);
  const homepageSelectedPhotos = useMemo(
    () =>
      homepagePhotoIds
        .map((photoId) => homepagePhotoMap.get(photoId))
        .filter(Boolean),
    [homepagePhotoIds, homepagePhotoMap],
  );
  const homepageAvailablePhotos = useMemo(
    () => homepagePool.filter((photo) => !homepageSelectedSet.has(photo.photoId)),
    [homepagePool, homepageSelectedSet],
  );
  const homepageActivePhoto = useMemo(() => {
    if (!homepageActivePhotoId) {
      const firstId = homepagePhotoIds[0];
      return firstId ? homepagePhotoMap.get(firstId) || null : null;
    }

    return homepagePhotoMap.get(homepageActivePhotoId) || null;
  }, [homepageActivePhotoId, homepagePhotoIds, homepagePhotoMap]);
  const homepageActiveDraft = useMemo(() => {
    if (!homepageActivePhoto) {
      return null;
    }

    return drafts[homepageActivePhoto.photoId] || toDraft(homepageActivePhoto);
  }, [drafts, homepageActivePhoto]);
  const homepageActiveIsDirty = useMemo(() => {
    if (!homepageActivePhoto || !homepageActiveDraft) {
      return false;
    }

    return isDraftDirty(homepageActivePhoto, homepageActiveDraft);
  }, [homepageActiveDraft, homepageActivePhoto]);

  const dirtyPhotoCount = useMemo(() => {
    const uniquePhotos = new Map();
    for (const photo of photos) {
      uniquePhotos.set(photo.photoId, photo);
    }
    for (const photo of homepagePool) {
      if (!uniquePhotos.has(photo.photoId)) {
        uniquePhotos.set(photo.photoId, photo);
      }
    }

    let count = 0;
    for (const photo of uniquePhotos.values()) {
      if (isDraftDirty(photo, drafts[photo.photoId])) {
        count += 1;
      }
    }
    return count;
  }, [drafts, photos, homepagePool]);

  const hasUnsavedChanges = dirtyPhotoCount > 0;
  const totalPages = Math.max(1, Math.ceil(totalPhotos / pageSize));
  const filteredHomepageSelectedPhotos = useMemo(() => {
    if (!homepageSearchTerm) {
      return homepageSelectedPhotos;
    }

    return homepageSelectedPhotos.filter((photo) => {
      const title = toStringValue(photo.title).toLowerCase();
      const caption = toStringValue(photo.caption).toLowerCase();
      const poem = toStringValue(photo.poem).toLowerCase();
      const collection = toStringValue(photo.collection).toLowerCase();
      return (
        title.includes(homepageSearchTerm) ||
        caption.includes(homepageSearchTerm) ||
        poem.includes(homepageSearchTerm) ||
        collection.includes(homepageSearchTerm)
      );
    });
  }, [homepageSearchTerm, homepageSelectedPhotos]);
  const filteredHomepageAvailablePhotos = useMemo(() => {
    const sorted = [...homepageAvailablePhotos].sort((a, b) =>
      String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
    );

    if (!homepageSearchTerm) {
      return sorted;
    }

    return sorted.filter((photo) => {
      const title = toStringValue(photo.title).toLowerCase();
      const caption = toStringValue(photo.caption).toLowerCase();
      const poem = toStringValue(photo.poem).toLowerCase();
      const collection = toStringValue(photo.collection).toLowerCase();
      return (
        title.includes(homepageSearchTerm) ||
        caption.includes(homepageSearchTerm) ||
        poem.includes(homepageSearchTerm) ||
        collection.includes(homepageSearchTerm)
      );
    });
  }, [homepageAvailablePhotos, homepageSearchTerm]);
  const currentLibrarySortLabel = useMemo(
    () => librarySortOptions.find((option) => option.value === librarySort)?.label || librarySort,
    [librarySort, librarySortOptions],
  );
  const currentLibraryVisibilityLabel = useMemo(() => {
    if (effectivePublishedFilter === "published") {
      return "Published";
    }
    if (effectivePublishedFilter === "draft") {
      return "Draft";
    }
    return "All";
  }, [effectivePublishedFilter]);
  const currentLibraryViewLabel = useMemo(() => {
    if (collectionFilter === HOMEPAGE_COLLECTION_FILTER) {
      return "Homepage";
    }
    if (collectionFilter === "All") {
      return "All Collections";
    }
    return collectionFilter;
  }, [collectionFilter]);
  const libraryViewTone = useMemo(() => {
    if (isDraftsTab) {
      return {
        chip: "border-rose-300 bg-rose-50 text-rose-800",
        dot: "bg-rose-600",
      };
    }
    if (isHomepageCollectionFilter) {
      return {
        chip: "border-emerald-300 bg-emerald-50 text-emerald-800",
        dot: "bg-emerald-600",
      };
    }
    if (collectionFilter !== "All") {
      return {
        chip: "border-amber-300 bg-amber-50 text-amber-800",
        dot: "bg-amber-500",
      };
    }
    return {
      chip: "border-zinc-300 bg-zinc-50 text-zinc-700",
      dot: "bg-zinc-500",
    };
  }, [collectionFilter, isDraftsTab, isHomepageCollectionFilter]);
  const libraryTitle = isDraftsTab ? "Draft Library" : "Photo Library";
  const libraryResultCount = Number.isFinite(totalPhotos) ? totalPhotos : photos.length;
  const searchChipValue = searchInput.trim();
  const hasActiveLibraryFilters =
    Boolean(searchChipValue) ||
    collectionFilter !== "All" ||
    librarySort !== "newest" ||
    (!isDraftsTab && effectivePublishedFilter !== "all");
  const normalizedBrandSettingsDraft = useMemo(() => normalizeSiteSettings(brandSettingsDraft), [brandSettingsDraft]);
  const normalizedBrandSettingsDraftKey = JSON.stringify(normalizedBrandSettingsDraft);
  const savedBrandSettingsKey = JSON.stringify(savedBrandSettings);
  const brandingPreviewClass = getNavbarBrandTextClass(normalizedBrandSettingsDraft.brandName);
  const brandingPreviewStyle = getNavbarBrandTextStyle(normalizedBrandSettingsDraft);
  const brandingPreviewVars = getSiteSettingsCssVariables(normalizedBrandSettingsDraft);
  const selectedBrandFontOption = getNavbarBrandFontOption(normalizedBrandSettingsDraft.fontKey);
  const selectedSiteTheme = getSiteTheme(normalizedBrandSettingsDraft.themeKey);
  const selectedTextScaleOption =
    TEXT_SCALE_OPTIONS.find((option) => option.key === normalizedBrandSettingsDraft.textScaleKey) ||
    TEXT_SCALE_OPTIONS[0];
  const hasUploadedBrandLogo = Boolean(normalizedBrandSettingsDraft.customLogoDataUrl);
  const isUsingUploadedBrandLogo =
    normalizedBrandSettingsDraft.logoMode === "custom" && hasUploadedBrandLogo;
  const primaryBrandFontOptions = useMemo(
    () => NAVBAR_BRAND_FONT_OPTIONS.filter((option) => option.group !== "extended"),
    [],
  );
  const extendedBrandFontOptions = useMemo(
    () => NAVBAR_BRAND_FONT_OPTIONS.filter((option) => option.group === "extended"),
    [],
  );
  const selectedFontIsExtended = selectedBrandFontOption.group === "extended";
  const brandingSampleName = normalizedBrandSettingsDraft.brandName || siteBrand.name;
  const isBrandingDirty = normalizedBrandSettingsDraftKey !== savedBrandSettingsKey;
  const wordmarkColorName = getColorOptionLabel(NAVBAR_BRAND_COLOR_OPTIONS, normalizedBrandSettingsDraft.textColor);
  const fallbackLogoColorName = getColorOptionLabel(NAVBAR_BRAND_COLOR_OPTIONS, normalizedBrandSettingsDraft.logoColor);
  const globalTextColorName = getColorOptionLabel(GLOBAL_TEXT_COLOR_OPTIONS, normalizedBrandSettingsDraft.globalTextColor);
  const activeNavbarSurfaceTarget =
    normalizedBrandSettingsDraft.navbarFillStyle === "gradient" ? activeNavbarPaletteTarget : "background";
  const activeNavbarSurfaceLabel =
    activeNavbarSurfaceTarget === "end"
      ? "End Color"
      : activeNavbarSurfaceTarget === "start"
        ? "Start Color"
        : "Background Color";
  const activeNavbarSurfaceValue =
    activeNavbarSurfaceTarget === "end"
      ? normalizedBrandSettingsDraft.navbarGradientColor
      : normalizedBrandSettingsDraft.navbarBackgroundColor;
  const activeNavbarSurfaceName = getColorOptionLabel(CHROME_BACKGROUND_COLOR_OPTIONS, activeNavbarSurfaceValue);
  const navbarStartColorName = getColorOptionLabel(
    CHROME_BACKGROUND_COLOR_OPTIONS,
    normalizedBrandSettingsDraft.navbarBackgroundColor,
  );
  const navbarEndColorName = getColorOptionLabel(
    CHROME_BACKGROUND_COLOR_OPTIONS,
    normalizedBrandSettingsDraft.navbarGradientColor,
  );
  const navbarTextColorName = getColorOptionLabel(
    CHROME_TEXT_COLOR_OPTIONS,
    normalizedBrandSettingsDraft.navbarTextColor,
  );
  const footerBackgroundColorName = getColorOptionLabel(
    CHROME_BACKGROUND_COLOR_OPTIONS,
    normalizedBrandSettingsDraft.footerBackgroundColor,
  );
  const footerTextColorName = getColorOptionLabel(
    CHROME_TEXT_COLOR_OPTIONS,
    normalizedBrandSettingsDraft.footerTextColor,
  );
  const navbarSurfaceUsesPresetColor = hasColorOption(CHROME_BACKGROUND_COLOR_OPTIONS, activeNavbarSurfaceValue);
  const navbarTextUsesPresetColor = hasColorOption(
    CHROME_TEXT_COLOR_OPTIONS,
    normalizedBrandSettingsDraft.navbarTextColor,
  );
  const footerBackgroundUsesPresetColor = hasColorOption(
    CHROME_BACKGROUND_COLOR_OPTIONS,
    normalizedBrandSettingsDraft.footerBackgroundColor,
  );
  const footerTextUsesPresetColor = hasColorOption(CHROME_TEXT_COLOR_OPTIONS, normalizedBrandSettingsDraft.footerTextColor);
  const adminTypeScaleClass =
    normalizedBrandSettingsDraft.textScaleKey === "large"
      ? "text-[19px] [&_input]:text-[18px] [&_select]:text-[18px] [&_textarea]:text-[18px]"
      : normalizedBrandSettingsDraft.textScaleKey === "comfortable"
        ? "text-[18px] [&_input]:text-[17px] [&_select]:text-[17px] [&_textarea]:text-[17px]"
        : "text-[17px] [&_input]:text-[16px] [&_select]:text-[16px] [&_textarea]:text-[16px]";
  const manageableCollectionOptions = useMemo(
    () => collectionOptions.filter((collection) => collection !== DEFAULT_COLLECTION),
    [collectionOptions],
  );

  const getWorkspaceTabClass = useCallback((tabKey, isActive) => {
    const base =
      "inline-flex min-h-[44px] items-center justify-center rounded-full border px-4 py-2.5 text-[12px] font-semibold tracking-[0.16em] uppercase transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20";
    const map = {
      upload: {
        active: "border-sky-600 bg-sky-600 text-white shadow-[0_14px_28px_rgba(2,132,199,0.28)] -translate-y-0.5",
        idle: "border-sky-200 bg-sky-50 text-sky-900 hover:border-sky-400 hover:bg-sky-100 hover:text-sky-900",
      },
      homepage: {
        active: "border-emerald-600 bg-emerald-600 text-white shadow-[0_14px_28px_rgba(5,150,105,0.28)] -translate-y-0.5",
        idle: "border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-400 hover:bg-emerald-100 hover:text-emerald-900",
      },
      library: {
        active: "border-amber-500 bg-amber-500 text-black shadow-[0_14px_28px_rgba(245,158,11,0.24)] -translate-y-0.5",
        idle: "border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-400 hover:bg-amber-100 hover:text-amber-900",
      },
      branding: {
        active: "border-zinc-950 bg-zinc-950 text-white shadow-[0_14px_28px_rgba(17,17,17,0.22)] -translate-y-0.5",
        idle: "border-zinc-300 bg-zinc-100 text-zinc-900 hover:border-zinc-500 hover:bg-zinc-200 hover:text-zinc-950",
      },
      drafts: {
        active: "border-rose-600 bg-rose-600 text-white shadow-[0_14px_28px_rgba(190,24,93,0.28)] -translate-y-0.5",
        idle: "border-rose-200 bg-rose-50 text-rose-900 hover:border-rose-400 hover:bg-rose-100 hover:text-rose-900",
      },
      about: {
        active: "border-violet-600 bg-violet-600 text-white shadow-[0_14px_28px_rgba(124,58,237,0.26)] -translate-y-0.5",
        idle: "border-violet-200 bg-violet-50 text-violet-900 hover:border-violet-400 hover:bg-violet-100 hover:text-violet-900",
      },
    };

    const tone = map[tabKey] || map.library;
    return `${base} ${isActive ? tone.active : tone.idle}`;
  }, []);

  const clearLibrarySearch = useCallback(() => {
    setPage(1);
    setSearchInput("");
    setSearchQuery("");
  }, []);

  const clearCollectionFilter = useCallback(() => {
    setPage(1);
    setCollectionFilter("All");
  }, []);

  const clearLibrarySort = useCallback(() => {
    setPage(1);
    setLibrarySort("newest");
  }, []);

  const clearVisibilityFilter = useCallback(() => {
    setPage(1);
    setPublishedFilter("all");
  }, []);

  const requestLibraryEditorClose = useCallback(() => {
    if (!isLibraryEditorOpen) {
      return;
    }

    if (!activePhotoId || !activePhoto || !activeDraft) {
      setLibraryExitPrompt({ open: false });
      setIsLibraryEditorOpen(false);
      return;
    }

    if (savingPhotoId === activePhotoId || deletingPhotoId === activePhotoId) {
      return;
    }

    if (activeIsDirty) {
      setLibraryExitPrompt({ open: true });
      return;
    }

    if (libraryAutoSaveTimerRef.current) {
      clearTimeout(libraryAutoSaveTimerRef.current);
      libraryAutoSaveTimerRef.current = null;
    }

    setLibraryExitPrompt({ open: false });
    setIsLibraryEditorOpen(false);
  }, [
    activeDraft,
    activeIsDirty,
    activePhoto,
    activePhotoId,
    deletingPhotoId,
    isLibraryEditorOpen,
    savingPhotoId,
  ]);

  const ensureCsrfToken = useCallback(async () => {
    if (csrfToken) {
      return csrfToken;
    }

    const result = await fetch("/api/csrf", { cache: "no-store" }).then(parseJsonResponse);
    const token = result?.csrfToken || "";
    if (!token) {
      throw new Error("Unable to initialize CSRF token.");
    }
    setCsrfToken(token);
    return token;
  }, [csrfToken]);

  const fetchWithCsrf = useCallback(
    async (url, options = {}) => {
      const token = await ensureCsrfToken();
      const headers = new Headers(options.headers || {});
      headers.set(CSRF_HEADER_NAME, token);

      return fetch(url, {
        ...options,
        headers,
      });
    },
    [ensureCsrfToken],
  );

  const applyBrandingDraftChange = useCallback((updater) => {
    const current = normalizeSiteSettings(latestBrandSettingsDraftRef.current);
    const nextInput =
      typeof updater === "function"
        ? updater(current)
        : { ...current, ...updater };
    const next = normalizeSiteSettings(nextInput);

    if (JSON.stringify(next) === JSON.stringify(current)) {
      return;
    }

    applySiteSettingsToDocument(next);

    brandingUndoRef.current = current;
    setCanUndoBranding(true);
    latestBrandSettingsDraftRef.current = next;
    setBrandSettingsDraft(next);
    setBrandingStatus("idle");
    setBrandingMessage("");
  }, []);

  const undoBrandingDraftChange = useCallback(() => {
    if (!brandingUndoRef.current) {
      return;
    }

    const previous = normalizeSiteSettings(brandingUndoRef.current);
    brandingUndoRef.current = null;
    setCanUndoBranding(false);
    applySiteSettingsToDocument(previous);
    latestBrandSettingsDraftRef.current = previous;
    setBrandSettingsDraft(previous);
    setBrandingStatus("idle");
    setBrandingMessage("");
  }, []);

  const resetBrandingToOriginal = useCallback(() => {
    setShowExtendedBrandFonts(false);
    applyBrandingDraftChange(() => getDefaultSiteSettingsValues());
  }, [applyBrandingDraftChange]);

  const applyNavbarSurfaceColor = useCallback(
    (nextColor) => {
      applyBrandingDraftChange((current) => {
        if (current.navbarFillStyle === "gradient" && activeNavbarPaletteTarget === "end") {
          return {
            ...current,
            navbarColorMode: "custom",
            navbarFillStyle: "gradient",
            navbarGradientColor: nextColor,
          };
        }

        return {
          ...current,
          navbarColorMode: "custom",
          navbarBackgroundColor: nextColor,
        };
      });
    },
    [activeNavbarPaletteTarget, applyBrandingDraftChange],
  );

  const applyNavbarTextColor = useCallback(
    (nextColor) => {
      applyBrandingDraftChange((current) => ({
        ...current,
        navbarColorMode: "custom",
        navbarTextColor: nextColor,
      }));
    },
    [applyBrandingDraftChange],
  );

  const applyWordmarkColor = useCallback(
    (nextColor) => {
      applyBrandingDraftChange((current) => ({
        ...current,
        textColor: nextColor,
      }));
    },
    [applyBrandingDraftChange],
  );

  const applyFallbackLogoColor = useCallback(
    (nextColor) => {
      applyBrandingDraftChange((current) => ({
        ...current,
        logoColor: nextColor,
      }));
    },
    [applyBrandingDraftChange],
  );

  const applyGlobalTextColor = useCallback(
    (nextColor) => {
      applyBrandingDraftChange((current) => ({
        ...current,
        textColorMode: "custom",
        globalTextColor: nextColor,
      }));
    },
    [applyBrandingDraftChange],
  );

  const applyFooterBackgroundColor = useCallback(
    (nextColor) => {
      applyBrandingDraftChange((current) => ({
        ...current,
        footerColorMode: "custom",
        footerBackgroundColor: nextColor,
      }));
    },
    [applyBrandingDraftChange],
  );

  const applyFooterTextColor = useCallback(
    (nextColor) => {
      applyBrandingDraftChange((current) => ({
        ...current,
        footerColorMode: "custom",
        footerTextColor: nextColor,
      }));
    },
    [applyBrandingDraftChange],
  );

  const triggerBrandLogoPicker = useCallback(() => {
    brandLogoInputRef.current?.click();
  }, []);

  const handleBrandLogoFileChange = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!isPngFile(file)) {
      setBrandingStatus("error");
      setBrandingMessage("Upload a PNG logo so it fits cleanly in the navbar.");
      return;
    }

    if (file.size > MAX_BRAND_LOGO_UPLOAD_BYTES) {
      setBrandingStatus("error");
      setBrandingMessage("Keep the PNG under 4MB before upload.");
      return;
    }

    setIsPreparingBrandLogo(true);
    setBrandingStatus("idle");
    setBrandingMessage("");

    try {
      const customLogoDataUrl = await fitBrandLogoToNavbar(file);
      applyBrandingDraftChange((current) => ({
        ...current,
        logoMode: "custom",
        customLogoDataUrl,
      }));
    } catch (error) {
      setBrandingStatus("error");
      setBrandingMessage(error.message || "Unable to prepare that PNG for the navbar.");
    } finally {
      setIsPreparingBrandLogo(false);
    }
  }, [applyBrandingDraftChange]);

  const saveBrandingSettings = useCallback(async (draftInput = latestBrandSettingsDraftRef.current) => {
    const nextDraft =
      draftInput && typeof draftInput === "object"
        ? draftInput
        : latestBrandSettingsDraftRef.current;
    const rawBrandName = String(nextDraft?.brandName || "").trim();

    if (!rawBrandName) {
      setBrandingStatus("error");
      setBrandingMessage("Enter a name for the navbar brand.");
      return;
    }

    const settingsToSave = normalizeSiteSettings(nextDraft);
    const settingsToSaveKey = JSON.stringify(settingsToSave);

    setIsSavingBranding(true);
    setBrandingStatus("saving");
    setBrandingMessage("");

    try {
      const result = await fetchWithCsrf("/api/site-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settingsToSave),
      }).then(parseJsonResponse);

      const savedSettings = normalizeSiteSettings(result?.settings || settingsToSave);
      const latestNormalizedDraft = normalizeSiteSettings(latestBrandSettingsDraftRef.current);
      const latestDraftKey = JSON.stringify(latestNormalizedDraft);
      setSavedBrandSettings(savedSettings);

      if (latestDraftKey === settingsToSaveKey) {
        latestBrandSettingsDraftRef.current = savedSettings;
        setBrandSettingsDraft(savedSettings);
      }

      if (result?.persisted === false) {
        setBrandingStatus("warning");
        setBrandingMessage("Saved for this session only because MongoDB is not configured.");
      } else {
        setBrandingStatus("success");
        setBrandingMessage("");
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("site-settings-updated", {
            detail: savedSettings,
          }),
        );
      }
    } catch (error) {
      setBrandingStatus("error");
      setBrandingMessage(error.message || "Unable to update the navbar branding.");
    } finally {
      setIsSavingBranding(false);
    }
  }, [fetchWithCsrf]);

  const loadHeaderData = useCallback(async () => {
    try {
      const [uploadHealth, csrf, siteSettings] = await Promise.all([
        fetch("/api/upload", { cache: "no-store" }).then(parseJsonResponse),
        fetch("/api/csrf", { cache: "no-store" }).then(parseJsonResponse),
        fetch("/api/site-settings", { cache: "no-store" }).then(parseJsonResponse),
      ]);

      setReady(Boolean(uploadHealth.ready));
      setCsrfToken(csrf?.csrfToken || "");
      const nextBrandSettings = normalizeSiteSettings(siteSettings?.settings || {});
      setSavedBrandSettings(nextBrandSettings);
      setBrandSettingsDraft(nextBrandSettings);
      latestBrandSettingsDraftRef.current = nextBrandSettings;
      brandingUndoRef.current = null;
      setCanUndoBranding(false);
    } catch (error) {
      setManageStatus("error");
      setManageMessage(error.message || "Unable to initialize admin state.");
    }
  }, []);

  const loadLibraryData = useCallback(async (options = {}) => {
    if (!isLibraryTab) {
      return;
    }

    setLoadingPhotos(true);

    try {
      const nextCollectionFilter = options.collectionFilter ?? collectionFilter;
      const nextLibrarySort = options.librarySort ?? librarySort;
      const nextPage = options.page ?? page;
      const nextPageSize = options.pageSize ?? pageSize;
      const nextSearchQuery = options.searchQuery ?? searchQuery;
      const nextPublishedFilter = options.publishedFilter ?? effectivePublishedFilter;
      const usingHomepageFilter = nextCollectionFilter === HOMEPAGE_COLLECTION_FILTER;
      const requestedSort = usingHomepageFilter ? "curated" : nextLibrarySort;
      const requestedLimit = usingHomepageFilter ? HOMEPAGE_MAX_PHOTOS : nextPageSize;
      const requestedOffset = usingHomepageFilter ? 0 : (nextPage - 1) * nextPageSize;

      const params = new URLSearchParams({
        sort: requestedSort,
        includeDrafts: "1",
        limit: String(requestedLimit),
        offset: String(requestedOffset),
      });
      if (usingHomepageFilter) {
        params.set("featured", "1");
      } else if (nextCollectionFilter !== "All") {
        params.set("collection", nextCollectionFilter);
      }
      if (nextSearchQuery) {
        params.set("q", nextSearchQuery);
      }
      if (nextPublishedFilter !== "all") {
        params.set("published", nextPublishedFilter);
      }

      const photoList = await fetch(`/api/photos?${params.toString()}`, {
        cache: "no-store",
      }).then(parseJsonResponse);

      const nextPhotos = Array.isArray(photoList.photos) ? photoList.photos : [];
      const nextTotal = Number(photoList?.pagination?.total) || 0;
      const nextOrder = nextPhotos.map((photo) => photo.photoId);

      setPhotos(nextPhotos);
      setTotalPhotos(nextTotal);
      setCollections((current) => mergeCollections(current, photoList.collections || []));
      setDrafts((current) => buildDraftMap(nextPhotos, current));
      baseOrderRef.current = nextOrder;
      setDraggingPhotoId("");
      setDragOverPhotoId("");
      setLastOrderSnapshot([]);
      setManageStatus("idle");
      setManageMessage("");
    } catch (error) {
      setManageStatus("error");
      setManageMessage(error.message || "Unable to load photo library.");
    } finally {
      setLoadingPhotos(false);
    }
  }, [collectionFilter, effectivePublishedFilter, isLibraryTab, librarySort, page, pageSize, searchQuery]);

  const loadHomepageData = useCallback(async () => {
    setHomepageLoading(true);

    try {
      const params = new URLSearchParams({
        includeDrafts: "1",
        published: "published",
        sort: "manual",
        limit: "300",
        offset: "0",
      });

      const result = await fetch(`/api/photos?${params.toString()}`, {
        cache: "no-store",
      }).then(parseJsonResponse);

      const nextPhotos = Array.isArray(result.photos) ? result.photos : [];
      const nextFeatured = nextPhotos
        .filter((photo) => photo.featured)
        .sort((a, b) => {
          const orderA = typeof a.featuredOrder === "number" ? a.featuredOrder : Number.MAX_SAFE_INTEGER;
          const orderB = typeof b.featuredOrder === "number" ? b.featuredOrder : Number.MAX_SAFE_INTEGER;
          if (orderA !== orderB) {
            return orderA - orderB;
          }
          return (a.order || 0) - (b.order || 0);
        })
        .map((photo) => photo.photoId)
        .slice(0, HOMEPAGE_MAX_PHOTOS);

      setHomepagePool(nextPhotos);
      setHomepagePhotoIds(nextFeatured);
      baseHomepageOrderRef.current = nextFeatured;
      setHasHomepageChanges(false);
      setHomepageDraggingPhotoId("");
      setHomepageDragOverPhotoId("");
      setHomepageStatus("idle");
      setHomepageMessage("");
      setCollections((current) => mergeCollections(current, result.collections || []));
    } catch (error) {
      setHomepageStatus("error");
      setHomepageMessage(error.message || "Unable to load homepage editor.");
    } finally {
      setHomepageLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHeaderData();
  }, [loadHeaderData]);

  useEffect(() => {
    latestBrandSettingsDraftRef.current = brandSettingsDraft;
  }, [brandSettingsDraft]);

  useEffect(() => {
    if (selectedFontIsExtended) {
      setShowExtendedBrandFonts(true);
    }
  }, [selectedFontIsExtended]);

  useLayoutEffect(() => {
    applySiteSettingsToDocument(normalizedBrandSettingsDraft);
  }, [normalizedBrandSettingsDraft]);

  useEffect(() => {
    if (brandingAutoSaveTimerRef.current) {
      window.clearTimeout(brandingAutoSaveTimerRef.current);
      brandingAutoSaveTimerRef.current = null;
    }

    if (!isBrandingDirty || isSavingBranding) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      saveBrandingSettings(latestBrandSettingsDraftRef.current);
    }, 700);

    brandingAutoSaveTimerRef.current = timeoutId;

    return () => {
      window.clearTimeout(timeoutId);
      if (brandingAutoSaveTimerRef.current === timeoutId) {
        brandingAutoSaveTimerRef.current = null;
      }
    };
  }, [isBrandingDirty, isSavingBranding, normalizedBrandSettingsDraftKey, saveBrandingSettings]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPage(1);
      setSearchQuery(searchInput.trim());
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    if (skipNextLibraryLoadRef.current) {
      skipNextLibraryLoadRef.current = false;
      return;
    }
    loadLibraryData();
  }, [loadLibraryData]);

  useEffect(() => {
    loadHomepageData();
  }, [loadHomepageData]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (isDraftsTab && (librarySort === "manual" || librarySort === "curated")) {
      setLibrarySort("newest");
    }
  }, [isDraftsTab, librarySort]);

  useEffect(() => {
    if (!collectionOptions.length) {
      return;
    }
    if (!collectionOptions.includes(bulkMoveCollection)) {
      setBulkMoveCollection(collectionOptions[0] || DEFAULT_COLLECTION);
    }
  }, [bulkMoveCollection, collectionOptions]);

  useEffect(() => {
    if (renameFromCollection && !manageableCollectionOptions.includes(renameFromCollection)) {
      setRenameFromCollection("");
    }
    if (deleteCollectionName && !manageableCollectionOptions.includes(deleteCollectionName)) {
      setDeleteCollectionName("");
    }
  }, [deleteCollectionName, manageableCollectionOptions, renameFromCollection]);

  useEffect(() => {
    if (canManualReorder) {
      return;
    }

    setDraggingPhotoId("");
    setDragOverPhotoId("");
    setLastOrderSnapshot([]);
  }, [canManualReorder]);

  useEffect(() => {
    setSelectedPhotoIds((current) =>
      current.filter((photoId) => photos.some((photo) => photo.photoId === photoId)),
    );
  }, [photos]);

  useEffect(() => {
    if (!activePhotoId) {
      setActivePhotoId(photos[0]?.photoId || "");
      return;
    }

    if (!photos.some((photo) => photo.photoId === activePhotoId)) {
      setActivePhotoId(photos[0]?.photoId || "");
    }
  }, [activePhotoId, photos]);

  useEffect(() => {
    if (!homepageActivePhotoId) {
      setHomepageActivePhotoId(homepagePhotoIds[0] || "");
      return;
    }

    if (!homepagePhotoIds.includes(homepageActivePhotoId)) {
      setHomepageActivePhotoId(homepagePhotoIds[0] || "");
    }
  }, [homepageActivePhotoId, homepagePhotoIds]);

  useEffect(() => {
    if (!homepagePool.length) {
      return;
    }

    setDrafts((current) => buildDraftMap(homepagePool, current));
  }, [homepagePool]);

  useEffect(() => {
    if (!isHomepageTab) {
      setIsHomepageEditorOpen(false);
    }
  }, [isHomepageTab]);

  useEffect(() => {
    if (!isLibraryTab) {
      setIsLibraryEditorOpen(false);
    }
  }, [isLibraryTab]);

  useEffect(() => {
    if (!isHomepageEditorOpen || homepageActivePhoto) {
      return;
    }

    setIsHomepageEditorOpen(false);
  }, [homepageActivePhoto, isHomepageEditorOpen]);

  useEffect(() => {
    if (!isHomepageEditorOpen) {
      return undefined;
    }

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsHomepageEditorOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isHomepageEditorOpen]);

  useEffect(() => {
    if (!isLibraryEditorOpen || activePhoto) {
      return;
    }

    setLibraryExitPrompt({ open: false });
    setIsLibraryEditorOpen(false);
  }, [activePhoto, isLibraryEditorOpen]);

  useEffect(() => {
    if (!isLibraryEditorOpen) {
      return undefined;
    }

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        requestLibraryEditorClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isLibraryEditorOpen, requestLibraryEditorClose]);

  useEffect(() => {
    if (!isLibraryEditorOpen) {
      setShowLibraryPoemFormatting(false);
      setShowLibraryPoemPreview(false);
      setLibraryExitPrompt({ open: false });
    }
  }, [isLibraryEditorOpen]);

  useEffect(() => {
    if (!isLibraryEditorOpen) {
      setLibraryOriginalSnapshot({
        photoId: "",
        draft: null,
      });
    }
  }, [isLibraryEditorOpen]);

  useEffect(() => {
    if (!isUploadTab) {
      setShowUploadPoemFormatting(false);
      setShowUploadPoemPreview(false);
    }
  }, [isUploadTab]);

  useEffect(() => {
    setShowLibraryPoemFormatting(false);
    setShowLibraryPoemPreview(false);
  }, [activePhotoId]);

  useEffect(() => {
    if (!isHomepageEditorOpen) {
      setShowHomepagePoemPreview(false);
    }
  }, [isHomepageEditorOpen]);

  useEffect(() => {
    if (isLibraryTab) {
      return;
    }

    setShowLibraryToolsMenu(false);
  }, [isLibraryTab]);

  useEffect(() => {
    if (!showLibraryToolsMenu) {
      return undefined;
    }

    const handleOutsidePointer = (event) => {
      const container = libraryToolsRef.current;
      if (!container || container.contains(event.target)) {
        return;
      }
      setShowLibraryToolsMenu(false);
    };

    document.addEventListener("mousedown", handleOutsidePointer);
    document.addEventListener("touchstart", handleOutsidePointer);
    return () => {
      document.removeEventListener("mousedown", handleOutsidePointer);
      document.removeEventListener("touchstart", handleOutsidePointer);
    };
  }, [showLibraryToolsMenu]);

  useEffect(() => {
    if (!showLibraryToolsMenu) {
      return undefined;
    }

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setShowLibraryToolsMenu(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showLibraryToolsMenu]);

  useEffect(() => {
    if (!activePhotoId) {
      return;
    }

    const panel = editorPanelRef.current;
    if (panel) {
      panel.scrollTop = 0;
    }
  }, [activePhotoId]);

  useEffect(() => {
    if (!isLibraryEditorOpen || !activePhotoId) {
      return;
    }

    setLibraryOriginalSnapshot((current) => {
      if (current.photoId === activePhotoId && current.draft) {
        return current;
      }

      const sourcePhoto =
        photos.find((photo) => photo.photoId === activePhotoId) ||
        homepagePool.find((photo) => photo.photoId === activePhotoId) ||
        null;
      const fallbackDraft = drafts[activePhotoId] || null;
      const nextDraft = sourcePhoto ? toDraft(sourcePhoto) : fallbackDraft ? { ...fallbackDraft } : null;

      if (!nextDraft) {
        return current;
      }

      return {
        photoId: activePhotoId,
        draft: nextDraft,
      };
    });
  }, [activePhotoId, drafts, homepagePool, isLibraryEditorOpen, photos]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return undefined;
    }

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleUploadFieldChange = (event) => {
    const { name, value, type, checked } = event.target;
    setUploadForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleFileChange = (event) => {
    const incoming = Array.from(event.target.files || []);
    setFiles(incoming);
  };

  const updatePoemValue = useCallback((mode, photoId, value) => {
    if (mode === "upload") {
      setUploadForm((current) => ({ ...current, poem: value }));
      return;
    }

    if (!photoId) {
      return;
    }

    setDrafts((current) => ({
      ...current,
      [photoId]: {
        ...(current[photoId] || toDraft(photos.find((photo) => photo.photoId === photoId))),
        poem: value,
      },
    }));
  }, [photos]);

  const insertPoemFormatting = useCallback((before, after = before) => {
    const target = poemModal.open ? poemModal : { mode: activeTab === "upload" ? "upload" : "photo", photoId: activePhotoId };
    const targetRef = poemModal.open
      ? modalPoemRef
      : target.mode === "upload"
        ? uploadPoemRef
        : editorPoemRef;
    const element = targetRef.current;
    if (!element) {
      return;
    }

    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? element.value.length;
    const selected = element.value.slice(start, end);
    const replacement = `${before}${selected}${after}`;
    const nextValue = `${element.value.slice(0, start)}${replacement}${element.value.slice(end)}`;

    updatePoemValue(target.mode, target.photoId, nextValue);

    requestAnimationFrame(() => {
      const currentElement = targetRef.current;
      if (!currentElement) {
        return;
      }

      currentElement.focus();
      const cursorStart = start + before.length;
      const cursorEnd = cursorStart + selected.length;
      currentElement.setSelectionRange(cursorStart, cursorEnd);
      resizeTextarea(currentElement);
    });
  }, [activePhotoId, activeTab, poemModal, updatePoemValue]);

  const insertHomepagePoemFormatting = useCallback((before, after = before) => {
    const photoId = homepageActivePhoto?.photoId;
    const element = editorPoemRef.current;
    if (!photoId || !element) {
      return;
    }

    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? element.value.length;
    const selected = element.value.slice(start, end);
    const replacement = `${before}${selected}${after}`;
    const nextValue = `${element.value.slice(0, start)}${replacement}${element.value.slice(end)}`;

    setDrafts((current) => ({
      ...current,
      [photoId]: {
        ...(current[photoId] || toDraft(homepagePhotoMap.get(photoId))),
        poem: nextValue,
      },
    }));

    requestAnimationFrame(() => {
      const currentElement = editorPoemRef.current;
      if (!currentElement) {
        return;
      }

      currentElement.focus();
      const cursorStart = start + before.length;
      const cursorEnd = cursorStart + selected.length;
      currentElement.setSelectionRange(cursorStart, cursorEnd);
      resizeTextarea(currentElement);
    });
  }, [homepageActivePhoto, homepagePhotoMap]);

  const modalPoemValue =
    poemModal.mode === "upload"
      ? uploadForm.poem
      : drafts[poemModal.photoId]?.poem || "";

  const openPoemEditor = useCallback((mode, photoId = "") => {
    setPoemModal({ open: true, mode, photoId });
  }, []);

  const closePoemEditor = useCallback(() => {
    setPoemModal({ open: false, mode: "upload", photoId: "" });
  }, []);

  useEffect(() => {
    if (!poemModal.open) {
      setShowModalPoemPreview(false);
      return;
    }

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        closePoemEditor();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [closePoemEditor, poemModal.open]);

  useEffect(() => {
    if (!poemModal.open) {
      return;
    }

    const nextFrame = requestAnimationFrame(() => {
      const element = modalPoemRef.current;
      if (!element) {
        return;
      }
      resizeTextarea(element);
      element.focus();
    });

    return () => cancelAnimationFrame(nextFrame);
  }, [modalPoemValue, poemModal.open]);

  const handleUploadSubmit = useCallback(async (event) => {
    event.preventDefault();
    if (files.length === 0) {
      setUploadStatus("error");
      setUploadMessage("Select one or more photos to upload.");
      return;
    }

    setUploadStatus("uploading");
    setUploadMessage(`Uploading ${files.length} photo(s)...`);
    setUploadResults([]);

    try {
      const signaturePayload = await fetchWithCsrf("/api/upload/signature", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          folder: `freenyc/${slugify(uploadForm.collection || "city-life")}`,
        }),
      }).then(parseJsonResponse);

      const nextResults = [];
      let successCount = 0;

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const defaultTitle = fileBaseName(file.name);

        if (!file.type.startsWith("image/")) {
          nextResults.push({
            fileName: file.name,
            status: "error",
            message: "Skipped: not an image file.",
          });
          continue;
        }

        if (file.size > MAX_UPLOAD_BYTES) {
          nextResults.push({
            fileName: file.name,
            status: "error",
            message: "Skipped: file is larger than 12MB.",
          });
          continue;
        }

        try {
          const cloudinaryForm = new FormData();
          cloudinaryForm.set("file", file);
          cloudinaryForm.set("api_key", signaturePayload.apiKey);
          cloudinaryForm.set("timestamp", String(signaturePayload.timestamp));
          cloudinaryForm.set("signature", signaturePayload.signature);
          if (signaturePayload.folder) {
            cloudinaryForm.set("folder", signaturePayload.folder);
          }
          if (signaturePayload.allowedFormats) {
            cloudinaryForm.set("allowed_formats", signaturePayload.allowedFormats);
          }

          const cloudinaryResult = await fetch(signaturePayload.uploadUrl, {
            method: "POST",
            body: cloudinaryForm,
          }).then(parseJsonResponse);

          const titleSeed = toStringValue(uploadForm.title);
          const title =
            files.length === 1
              ? titleSeed || defaultTitle
              : titleSeed
                ? `${titleSeed} ${index + 1}`
                : defaultTitle;
          const altSeed = toStringValue(uploadForm.alt);
          const alt = altSeed || title;

          await fetchWithCsrf("/api/upload", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              secureUrl: cloudinaryResult.secure_url,
              publicId: cloudinaryResult.public_id,
              title,
              alt,
              caption: uploadForm.caption,
              poem: uploadForm.poem,
              collection: uploadForm.collection,
              featured: uploadForm.featured,
              published: uploadForm.published,
            }),
          }).then(parseJsonResponse);

          successCount += 1;
          nextResults.push({
            fileName: file.name,
            status: "success",
            message: "Uploaded and saved.",
          });
        } catch (error) {
          nextResults.push({
            fileName: file.name,
            status: "error",
            message: error.message || "Upload failed.",
          });
        }
      }

      const errorCount = nextResults.length - successCount;
      setUploadResults(nextResults);
      setUploadStatus(errorCount === 0 ? "success" : "error");
      setUploadMessage(
        `Finished: ${successCount} successful, ${errorCount} failed/skipped.`,
      );

      if (successCount > 0) {
        setFiles([]);
        setFileInputKey((current) => current + 1);
        await loadLibraryData();
        await loadHomepageData();
      }
    } catch (error) {
      setUploadStatus("error");
      setUploadMessage(error.message || "Unable to start upload.");
    }
  }, [fetchWithCsrf, files, loadHomepageData, loadLibraryData, uploadForm]);

  const handleDraftChange = (photoId, field, value) => {
    setDrafts((current) => ({
      ...current,
      [photoId]: {
        ...(current[photoId] || toDraft(photos.find((photo) => photo.photoId === photoId))),
        [field]: value,
      },
    }));
  };

  const savePhoto = useCallback(async (photoId, options = {}) => {
    const {
      refreshHomepage = true,
      refreshLibrary = isLibraryTab,
      silent = false,
      background = false,
      draftOverride = null,
    } = options;
    const draft = draftOverride || drafts[photoId];
    if (!draft) {
      return false;
    }
    const draftSnapshot = { ...draft };

    if (background) {
      setAutoSavingPhotoId(photoId);
    } else {
      setSavingPhotoId(photoId);
    }
    if (!silent) {
      setManageStatus("idle");
      setManageMessage("");
    }

    try {
      const result = await fetchWithCsrf(`/api/photos/${photoId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          alt: draft.alt,
          caption: draft.caption,
          poem: draft.poem,
          collection: draft.collection,
          featured: Boolean(draft.featured),
          published: Boolean(draft.published),
        }),
      }).then(parseJsonResponse);

      setPhotos((current) =>
        current.map((photo) => (photo.photoId === photoId ? result.photo : photo)),
      );
      setHomepagePool((current) =>
        current.map((photo) => (photo.photoId === photoId ? result.photo : photo)),
      );
      setDrafts((current) => ({
        ...current,
        [photoId]:
          background && current[photoId] && !areDraftValuesEqual(current[photoId], draftSnapshot)
            ? current[photoId]
            : toDraft(result.photo),
      }));
      setCollections((current) => mergeCollections(current, [result.photo.collection]));
      if (!silent) {
        setManageStatus("success");
        setManageMessage(`Saved ${result.photo.title || "photo"}.`);
      }
      if (refreshLibrary) {
        await loadLibraryData();
      }
      if (refreshHomepage) {
        await loadHomepageData();
      }
      return true;
    } catch (error) {
      setManageStatus("error");
      setManageMessage(
        silent ? `Auto-save failed: ${error.message || "Unable to save photo."}` : error.message || "Unable to save photo.",
      );
      return false;
    } finally {
      if (background) {
        setAutoSavingPhotoId("");
      } else {
        setSavingPhotoId("");
      }
    }
  }, [drafts, fetchWithCsrf, isLibraryTab, loadHomepageData, loadLibraryData]);

  useEffect(() => {
    if (!isLibraryEditorOpen || !activePhoto || !activeDraft || !activeIsDirty) {
      if (libraryAutoSaveTimerRef.current) {
        clearTimeout(libraryAutoSaveTimerRef.current);
        libraryAutoSaveTimerRef.current = null;
      }
      return;
    }

    if (
      savingPhotoId === activePhoto.photoId ||
      autoSavingPhotoId === activePhoto.photoId ||
      deletingPhotoId === activePhoto.photoId
    ) {
      return;
    }

    libraryAutoSaveTimerRef.current = setTimeout(() => {
      void savePhoto(activePhoto.photoId, {
        refreshHomepage: false,
        refreshLibrary: false,
        silent: true,
        background: true,
      });
    }, 1200);

    return () => {
      if (libraryAutoSaveTimerRef.current) {
        clearTimeout(libraryAutoSaveTimerRef.current);
        libraryAutoSaveTimerRef.current = null;
      }
    };
  }, [
    activeDraft,
    activeIsDirty,
    activePhoto,
    autoSavingPhotoId,
    deletingPhotoId,
    isLibraryEditorOpen,
    savePhoto,
    savingPhotoId,
  ]);

  const restoreActivePhotoToOriginal = useCallback(async () => {
    if (!activePhotoId || !hasOriginalSnapshotForActivePhoto || !libraryOriginalSnapshot.draft) {
      return;
    }
    if (savingPhotoId === activePhotoId || deletingPhotoId === activePhotoId) {
      return;
    }

    const restoredDraft = { ...libraryOriginalSnapshot.draft };
    setDrafts((current) => ({
      ...current,
      [activePhotoId]: restoredDraft,
    }));

    await savePhoto(activePhotoId, {
      draftOverride: restoredDraft,
      refreshHomepage: true,
      refreshLibrary: true,
    });
  }, [
    activePhotoId,
    deletingPhotoId,
    hasOriginalSnapshotForActivePhoto,
    libraryOriginalSnapshot.draft,
    savePhoto,
    savingPhotoId,
  ]);

  const cancelLibraryExitPrompt = () => {
    setLibraryExitPrompt({ open: false });
  };

  const discardAndCloseLibraryEditor = () => {
    if (libraryAutoSaveTimerRef.current) {
      clearTimeout(libraryAutoSaveTimerRef.current);
      libraryAutoSaveTimerRef.current = null;
    }

    if (activePhoto) {
      setDrafts((current) => ({
        ...current,
        [activePhoto.photoId]: toDraft(activePhoto),
      }));
    }

    setLibraryExitPrompt({ open: false });
    setIsLibraryEditorOpen(false);
  };

  const saveAndCloseLibraryEditor = async () => {
    if (!activePhoto) {
      setLibraryExitPrompt({ open: false });
      setIsLibraryEditorOpen(false);
      return;
    }

    if (libraryAutoSaveTimerRef.current) {
      clearTimeout(libraryAutoSaveTimerRef.current);
      libraryAutoSaveTimerRef.current = null;
    }

    const saved = await savePhoto(activePhoto.photoId);
    if (!saved) {
      return;
    }

    setLibraryExitPrompt({ open: false });
    setIsLibraryEditorOpen(false);
  };

  const deletePhoto = useCallback(async (photo) => {
    const confirmed = window.confirm(`Delete "${photo.title || "Untitled"}"?`);
    if (!confirmed) {
      return;
    }

    setDeletingPhotoId(photo.photoId);
    setManageStatus("idle");
    setManageMessage("");

    try {
      await fetchWithCsrf(`/api/photos/${photo.photoId}`, {
        method: "DELETE",
      }).then(parseJsonResponse);

      setPhotos((current) => current.filter((item) => item.photoId !== photo.photoId));
      setDrafts((current) => {
        const next = { ...current };
        delete next[photo.photoId];
        return next;
      });
      setSelectedPhotoIds((current) => current.filter((id) => id !== photo.photoId));
      setManageStatus("success");
      setManageMessage("Photo deleted.");
    } catch (error) {
      setManageStatus("error");
      setManageMessage(error.message || "Unable to delete photo.");
    } finally {
      setDeletingPhotoId("");
    }
  }, [fetchWithCsrf]);

  const persistLibraryOrder = useCallback(async (nextPhotos, previousOrderIds = []) => {
    if (!Array.isArray(nextPhotos) || nextPhotos.length < 2) {
      return true;
    }

    setIsSavingOrder(true);
    setManageStatus("idle");
    setManageMessage("");

    try {
      await fetchWithCsrf("/api/photos", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "reorder",
          photoIds: nextPhotos.map((item) => item.photoId),
        }),
      }).then(parseJsonResponse);

      baseOrderRef.current = nextPhotos.map((item) => item.photoId);
      setLastOrderSnapshot(previousOrderIds);
      setManageStatus("success");
      setManageMessage("Order saved.");
      return true;
    } catch (error) {
      setManageStatus("error");
      setManageMessage(error.message || "Unable to save order.");
      return false;
    } finally {
      setIsSavingOrder(false);
    }
  }, [fetchWithCsrf]);

  const saveHomepageOrderFromLibrary = useCallback(async (photoList) => {
    const orderedIds = Array.isArray(photoList)
      ? photoList.map((photo) => photo?.photoId).filter(Boolean)
      : [];
    if (orderedIds.length < 1) {
      return false;
    }

    setIsAutoSavingHomepageOrder(true);
    setManageStatus("idle");
    setManageMessage("");

    try {
      const result = await fetchWithCsrf("/api/photos", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "setFeaturedOrder",
          photoIds: orderedIds,
        }),
      }).then(parseJsonResponse);

      const updatedPhotos = Array.isArray(result.photos) ? result.photos : photoList;
      const updatedIds = Array.isArray(result.photoIds) ? result.photoIds : orderedIds;
      baseHomepageOrderRef.current = updatedIds;

      setPhotos(updatedPhotos);
      setTotalPhotos(updatedPhotos.length);
      setHasHomepageChanges(false);
      setManageStatus("success");
      setManageMessage("Homepage sequence saved.");

      await loadHomepageData();
      return true;
    } catch (error) {
      setManageStatus("error");
      setManageMessage(error.message || "Unable to save homepage sequence.");
      return false;
    } finally {
      setIsAutoSavingHomepageOrder(false);
    }
  }, [fetchWithCsrf, loadHomepageData]);

  const applyLibraryReorder = useCallback(async (nextPhotos) => {
    if (!canManualReorder || !Array.isArray(nextPhotos) || nextPhotos.length < 2) {
      return;
    }

    const previousPhotos = photos;
    const previousOrderIds = previousPhotos.map((item) => item.photoId);
    if (areOrdersEqual(nextPhotos, previousOrderIds)) {
      return;
    }

    if (isHomepageCollectionFilter) {
      setPhotos(nextPhotos);
      const saved = await saveHomepageOrderFromLibrary(nextPhotos);
      if (!saved) {
        setPhotos(previousPhotos);
      }
      return;
    }

    if (librarySort !== "manual") {
      setReorderConfirmPrompt({
        open: true,
        sortLabel: librarySortOptions.find((option) => option.value === librarySort)?.label || librarySort,
        nextOrderIds: nextPhotos.map((item) => item.photoId),
        previousOrderIds,
      });
      return;
    }

    setPhotos(nextPhotos);
    const saved = await persistLibraryOrder(nextPhotos, previousOrderIds);
    if (!saved) {
      setPhotos(previousPhotos);
    }
  }, [
    canManualReorder,
    isHomepageCollectionFilter,
    librarySort,
    librarySortOptions,
    persistLibraryOrder,
    photos,
    saveHomepageOrderFromLibrary,
  ]);

  const moveLibraryPhotoByOffset = useCallback(async (photoId, offset) => {
    if (!canManualReorder || isSavingOrder || isAutoSavingHomepageOrder) {
      return;
    }

    const nextPhotos = movePhotoListByOffset(photos, photoId, offset);
    await applyLibraryReorder(nextPhotos);
  }, [applyLibraryReorder, canManualReorder, isAutoSavingHomepageOrder, isSavingOrder, photos]);

  const handleCardDragStart = (event, photoId) => {
    if (!canManualReorder || !supportsDesktopDrag || isSavingOrder || isAutoSavingHomepageOrder) {
      return;
    }
    setDraggingPhotoId(photoId);
    setCardDragPreview(event);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", photoId);
  };

  const handleCardDragOver = (event, photoId) => {
    if (!canManualReorder || !supportsDesktopDrag) {
      return;
    }
    if (!draggingPhotoId || draggingPhotoId === photoId) {
      return;
    }

    event.preventDefault();
    autoScrollPageWhileDragging(event);
    event.dataTransfer.dropEffect = "move";
    setDragOverPhotoId(photoId);
  };

  const handleCardDrop = async (event, photoId) => {
    if (!canManualReorder || !supportsDesktopDrag || isSavingOrder || isAutoSavingHomepageOrder) {
      return;
    }
    event.preventDefault();
    const droppedPhotoId = event.dataTransfer.getData("text/plain") || draggingPhotoId;

    if (!droppedPhotoId || droppedPhotoId === photoId) {
      setDraggingPhotoId("");
      setDragOverPhotoId("");
      return;
    }

    const nextPhotos = reorderPhotoList(photos, droppedPhotoId, photoId);
    if (nextPhotos === photos) {
      setDraggingPhotoId("");
      setDragOverPhotoId("");
      return;
    }
    setDraggingPhotoId("");
    setDragOverPhotoId("");
    await applyLibraryReorder(nextPhotos);
  };

  const cancelReorderConfirm = () => {
    setReorderConfirmPrompt({
      open: false,
      sortLabel: "",
      nextOrderIds: [],
      previousOrderIds: [],
    });
    setManageStatus("idle");
    setManageMessage("Reorder canceled.");
  };

  const confirmReorderChange = async () => {
    if (!reorderConfirmPrompt.open) {
      return;
    }

    const { nextOrderIds, previousOrderIds } = reorderConfirmPrompt;
    const map = new Map(photos.map((item) => [item.photoId, item]));
    const nextPhotos = nextOrderIds.map((photoId) => map.get(photoId)).filter(Boolean);
    const previousPhotos = previousOrderIds.map((photoId) => map.get(photoId)).filter(Boolean);

    if (nextPhotos.length !== photos.length) {
      setReorderConfirmPrompt({
        open: false,
        sortLabel: "",
        nextOrderIds: [],
        previousOrderIds: [],
      });
      setManageStatus("error");
      setManageMessage("Unable to apply reorder. Please try again.");
      return;
    }

    setReorderConfirmPrompt({
      open: false,
      sortLabel: "",
      nextOrderIds: [],
      previousOrderIds: [],
    });
    setPhotos(nextPhotos);
    const saved = await persistLibraryOrder(nextPhotos, previousOrderIds);
    if (!saved) {
      if (previousPhotos.length === photos.length) {
        setPhotos(previousPhotos);
      }
      return;
    }
    setPage(1);
    setLibrarySort("manual");
  };

  const handleCardDragEnd = () => {
    if (!canManualReorder) {
      return;
    }
    setDraggingPhotoId("");
    setDragOverPhotoId("");
  };

  const undoLastOrderChange = async () => {
    if (lastOrderSnapshot.length < 2 || photos.length < 2) {
      return;
    }

    const map = new Map(photos.map((item) => [item.photoId, item]));
    const restored = lastOrderSnapshot.map((photoId) => map.get(photoId)).filter(Boolean);
    if (restored.length !== photos.length) {
      setManageStatus("error");
      setManageMessage("Unable to restore previous order.");
      return;
    }

    const currentPhotos = photos;
    setPhotos(restored);
    const saved = await persistLibraryOrder(restored, []);
    if (!saved) {
      setPhotos(currentPhotos);
      return;
    }
    setLastOrderSnapshot([]);
    setManageStatus("success");
    setManageMessage("Order reverted.");
  };

  const requestPhotoSelection = (nextPhotoId) => {
    if (!nextPhotoId) {
      return;
    }

    if (nextPhotoId === activePhotoId) {
      setIsLibraryEditorOpen(true);
      return;
    }

    if (activePhoto && activeDraft && isDraftDirty(activePhoto, activeDraft)) {
      setSwitchPrompt({
        open: true,
        nextPhotoId,
      });
      return;
    }

    setActivePhotoId(nextPhotoId);
    setIsLibraryEditorOpen(true);
  };

  const cancelPhotoSwitch = () => {
    setSwitchPrompt({ open: false, nextPhotoId: "" });
  };

  const discardAndSwitch = () => {
    if (activePhoto) {
      setDrafts((current) => ({
        ...current,
        [activePhoto.photoId]: toDraft(activePhoto),
      }));
    }
    const nextPhotoId = switchPrompt.nextPhotoId;
    setSwitchPrompt({ open: false, nextPhotoId: "" });
    if (nextPhotoId) {
      setActivePhotoId(nextPhotoId);
      setIsLibraryEditorOpen(true);
    }
  };

  const saveAndSwitch = async () => {
    if (!activePhoto) {
      cancelPhotoSwitch();
      return;
    }

    const nextPhotoId = switchPrompt.nextPhotoId;
    const saved = await savePhoto(activePhoto.photoId);
    if (!saved) {
      return;
    }

    setSwitchPrompt({ open: false, nextPhotoId: "" });
    if (nextPhotoId) {
      setActivePhotoId(nextPhotoId);
      setIsLibraryEditorOpen(true);
    }
  };

  const hasAnyPendingChanges = hasUnsavedChanges || hasHomepageChanges;

  const requestWorkspaceTabChange = (nextTab) => {
    if (!nextTab || nextTab === activeTab) {
      return;
    }

    if (hasAnyPendingChanges) {
      setWorkspaceSwitchPrompt({
        open: true,
        nextTab,
      });
      return;
    }

    setPage(1);
    setActiveTab(nextTab);
  };

  const cancelWorkspaceSwitch = () => {
    setWorkspaceSwitchPrompt({ open: false, nextTab: "" });
  };

  const discardPendingChangesAndSwitchTab = () => {
    const nextTab = workspaceSwitchPrompt.nextTab;

    if (photos.length > 0 || homepagePool.length > 0) {
      setDrafts((current) => {
        const nextDrafts = { ...current };
        const uniquePhotos = new Map();
        for (const photo of photos) {
          uniquePhotos.set(photo.photoId, photo);
        }
        for (const photo of homepagePool) {
          if (!uniquePhotos.has(photo.photoId)) {
            uniquePhotos.set(photo.photoId, photo);
          }
        }

        for (const photo of uniquePhotos.values()) {
          nextDrafts[photo.photoId] = toDraft(photo);
        }
        return nextDrafts;
      });
    }

    if (hasHomepageChanges) {
      setHomepagePhotoIds(baseHomepageOrderRef.current);
      setHasHomepageChanges(false);
      setHomepageDraggingPhotoId("");
      setHomepageDragOverPhotoId("");
    }

    setWorkspaceSwitchPrompt({ open: false, nextTab: "" });
    if (nextTab) {
      setPage(1);
      setActiveTab(nextTab);
    }
  };

  const savePendingChangesAndSwitchTab = async () => {
    const nextTab = workspaceSwitchPrompt.nextTab;
    if (!nextTab) {
      setWorkspaceSwitchPrompt({ open: false, nextTab: "" });
      return;
    }

    setIsSavingBeforeWorkspaceSwitch(true);

    try {
      if (hasHomepageChanges) {
        const homepageSaved = await saveHomepageSelection();
        if (!homepageSaved) {
          return;
        }
      }

      if (hasUnsavedChanges) {
        const uniquePhotos = new Map();
        for (const photo of photos) {
          uniquePhotos.set(photo.photoId, photo);
        }
        for (const photo of homepagePool) {
          if (!uniquePhotos.has(photo.photoId)) {
            uniquePhotos.set(photo.photoId, photo);
          }
        }

        const dirtyPhotoIds = Array.from(uniquePhotos.values())
          .filter((photo) => isDraftDirty(photo, drafts[photo.photoId]))
          .map((photo) => photo.photoId);

        for (const photoId of dirtyPhotoIds) {
          const saved = await savePhoto(photoId, { refreshHomepage: false });
          if (!saved) {
            return;
          }
        }

        await loadHomepageData();
      }

      setWorkspaceSwitchPrompt({ open: false, nextTab: "" });
      setPage(1);
      setActiveTab(nextTab);
    } finally {
      setIsSavingBeforeWorkspaceSwitch(false);
    }
  };

  const normalizeCollectionName = (value) => toStringValue(value).slice(0, 80);

  const autoScrollPageWhileDragging = useCallback((event) => {
    const delta = getEdgeAutoScrollDelta(
      event.clientY,
      0,
      window.innerHeight,
      180,
      2,
      10,
    );
    if (delta !== 0) {
      window.scrollBy(0, delta);
    }
  }, []);

  const autoScrollHomepageSequence = useCallback((event) => {
    const container = homepageSequenceRef.current;
    if (!container) {
      return;
    }

    const bounds = container.getBoundingClientRect();
    const delta = getEdgeAutoScrollDelta(
      event.clientY,
      bounds.top,
      bounds.bottom,
      96,
      1,
      7,
    );
    if (delta !== 0) {
      container.scrollTop += delta;
    }
  }, []);

  const addPhotoToHomepage = (photoId) => {
    if (!photoId || homepageSelectedSet.has(photoId)) {
      return;
    }

    const sourcePhoto =
      homepagePhotoMap.get(photoId) || photos.find((photo) => photo.photoId === photoId) || null;
    if (sourcePhoto?.published === false) {
      setHomepageStatus("error");
      setHomepageMessage("Only published photos can be added to homepage.");
      return;
    }

    if (homepagePhotoIds.length >= HOMEPAGE_MAX_PHOTOS) {
      setHomepageStatus("error");
      setHomepageMessage(`Homepage supports up to ${HOMEPAGE_MAX_PHOTOS} photos.`);
      return;
    }

    const next = [...homepagePhotoIds, photoId];
    applyHomepageOrder(next);
    if (!homepageActivePhotoId) {
      setHomepageActivePhotoId(photoId);
    }
  };

  const removePhotoFromHomepage = (photoId) => {
    const next = homepagePhotoIds.filter((id) => id !== photoId);
    applyHomepageOrder(next);
  };

  const applyHomepageOrder = (nextPhotoIds) => {
    setHomepagePhotoIds(nextPhotoIds);
    setHasHomepageChanges(
      !areOrdersEqual(nextPhotoIds.map((id) => ({ photoId: id })), baseHomepageOrderRef.current),
    );
    setHomepageStatus("idle");
    setHomepageMessage("");
  };

  const moveHomepagePhoto = (fromPhotoId, toPhotoId) => {
    const next = reorderPhotoList(
      homepagePhotoIds.map((photoId) => ({ photoId })),
      fromPhotoId,
      toPhotoId,
    ).map((item) => item.photoId);
    applyHomepageOrder(next);
  };

  const moveHomepagePhotoByOffset = useCallback((photoId, offset) => {
    const next = movePhotoListByOffset(
      homepagePhotoIds.map((itemId) => ({ photoId: itemId })),
      photoId,
      offset,
    ).map((item) => item.photoId);

    if (next.length !== homepagePhotoIds.length) {
      return;
    }

    const hasChanged = next.some((itemId, index) => itemId !== homepagePhotoIds[index]);
    if (!hasChanged) {
      return;
    }

    applyHomepageOrder(next);
  }, [homepagePhotoIds]);

  const insertHomepagePhotoAt = (photoId, targetPhotoId) => {
    if (!photoId) {
      return;
    }

    const isAlreadySelected = homepageSelectedSet.has(photoId);
    if (!isAlreadySelected && homepagePhotoIds.length >= HOMEPAGE_MAX_PHOTOS) {
      setHomepageStatus("error");
      setHomepageMessage(`Homepage supports up to ${HOMEPAGE_MAX_PHOTOS} photos.`);
      return;
    }

    const withoutPhoto = homepagePhotoIds.filter((id) => id !== photoId);
    const targetIndex = withoutPhoto.findIndex((id) => id === targetPhotoId);
    if (targetIndex < 0) {
      const appended = [...withoutPhoto, photoId];
      applyHomepageOrder(appended);
      return;
    }

    const next = [...withoutPhoto];
    next.splice(targetIndex, 0, photoId);
    applyHomepageOrder(next);
  };

  const parseHomepageDragPayload = (event) => {
    const raw = event.dataTransfer.getData("text/plain") || "";
    if (!raw) {
      return { source: "", photoId: "" };
    }

    if (raw.startsWith("pool:")) {
      return { source: "pool", photoId: raw.slice(5) };
    }

    if (raw.startsWith("sequence:")) {
      return { source: "sequence", photoId: raw.slice(9) };
    }

    return { source: "sequence", photoId: raw };
  };

  const saveHomepageSelection = async () => {
    setIsSavingHomepage(true);
    setHomepageStatus("idle");
    setHomepageMessage("");

    try {
      const result = await fetchWithCsrf("/api/photos", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "setFeaturedOrder",
          photoIds: homepagePhotoIds,
        }),
      }).then(parseJsonResponse);

      const next = Array.isArray(result.photoIds) ? result.photoIds : homepagePhotoIds;
      const featuredSet = new Set(next);
      const featuredOrderMap = new Map(next.map((photoId, index) => [photoId, index]));
      setHomepagePhotoIds(next);
      baseHomepageOrderRef.current = next;
      setHasHomepageChanges(false);
      setHomepagePool((current) =>
        current.map((photo) => {
          const nextOrder = featuredOrderMap.get(photo.photoId);
          const isFeatured = featuredSet.has(photo.photoId);
          return {
            ...photo,
            featured: isFeatured,
            featuredOrder: typeof nextOrder === "number" ? nextOrder : null,
          };
        }),
      );
      setPhotos((current) =>
        current.map((photo) => {
          const nextOrder = featuredOrderMap.get(photo.photoId);
          const isFeatured = featuredSet.has(photo.photoId);
          return {
            ...photo,
            featured: isFeatured,
            featuredOrder: typeof nextOrder === "number" ? nextOrder : null,
          };
        }),
      );
      setDrafts((current) => {
        const nextDrafts = { ...current };
        for (const photoId of Object.keys(nextDrafts)) {
          nextDrafts[photoId] = {
            ...nextDrafts[photoId],
            featured: featuredSet.has(photoId),
          };
        }
        return nextDrafts;
      });
      setHomepageStatus("success");
      setHomepageMessage("Homepage curation saved.");

      if (isLibraryTab) {
        await loadLibraryData();
      }
      return true;
    } catch (error) {
      setHomepageStatus("error");
      setHomepageMessage(error.message || "Unable to save homepage selection.");
      return false;
    } finally {
      setIsSavingHomepage(false);
    }
  };

  const handleHomepageDragStart = (event, photoId) => {
    if (!supportsDesktopDrag) {
      return;
    }

    setHomepageDraggingPhotoId(photoId);
    setCardDragPreview(event);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `sequence:${photoId}`);
  };

  const handleHomepagePoolDragStart = (event, photoId) => {
    if (!supportsDesktopDrag) {
      return;
    }

    setHomepageDraggingPhotoId(photoId);
    setCardDragPreview(event);
    event.dataTransfer.effectAllowed = "copyMove";
    event.dataTransfer.setData("text/plain", `pool:${photoId}`);
  };

  const handleHomepageDragOver = (event, photoId) => {
    if (!supportsDesktopDrag) {
      return;
    }

    const payload = parseHomepageDragPayload(event);
    if (!payload.photoId || payload.photoId === photoId) {
      return;
    }

    event.preventDefault();
    autoScrollHomepageSequence(event);
    setHomepageDragOverPhotoId(photoId);
    event.dataTransfer.dropEffect = "move";
  };

  const handleHomepageDrop = (event, photoId) => {
    if (!supportsDesktopDrag) {
      return;
    }

    event.preventDefault();
    const payload = parseHomepageDragPayload(event);
    if (!payload.photoId || payload.photoId === photoId) {
      setHomepageDraggingPhotoId("");
      setHomepageDragOverPhotoId("");
      return;
    }

    if (payload.source === "pool") {
      insertHomepagePhotoAt(payload.photoId, photoId);
    } else {
      moveHomepagePhoto(payload.photoId, photoId);
    }
    setHomepageDraggingPhotoId("");
    setHomepageDragOverPhotoId("");
  };

  const handleHomepageListDragOver = (event) => {
    if (!supportsDesktopDrag) {
      return;
    }

    const payload = parseHomepageDragPayload(event);
    if (!payload.photoId) {
      return;
    }

    event.preventDefault();
    autoScrollHomepageSequence(event);
    event.dataTransfer.dropEffect = payload.source === "pool" ? "copy" : "move";
  };

  const handleHomepageListDrop = (event) => {
    if (!supportsDesktopDrag) {
      return;
    }

    event.preventDefault();
    const payload = parseHomepageDragPayload(event);
    if (!payload.photoId) {
      setHomepageDraggingPhotoId("");
      setHomepageDragOverPhotoId("");
      return;
    }

    if (payload.source === "pool") {
      addPhotoToHomepage(payload.photoId);
    } else {
      const without = homepagePhotoIds.filter((id) => id !== payload.photoId);
      applyHomepageOrder([...without, payload.photoId]);
    }

    setHomepageDraggingPhotoId("");
    setHomepageDragOverPhotoId("");
  };

  const handleHomepageDragEnd = () => {
    setHomepageDraggingPhotoId("");
    setHomepageDragOverPhotoId("");
  };

  useEffect(() => {
    if (!homepageDraggingPhotoId && !draggingPhotoId) {
      return undefined;
    }

    const handleGlobalDragOver = (event) => {
      autoScrollPageWhileDragging(event);
    };

    window.addEventListener("dragover", handleGlobalDragOver);
    return () => window.removeEventListener("dragover", handleGlobalDragOver);
  }, [autoScrollPageWhileDragging, draggingPhotoId, homepageDraggingPhotoId]);

  const addCollectionOption = () => {
    const normalized = normalizeCollectionName(newCollectionName);
    if (!normalized) {
      setManageStatus("error");
      setManageMessage("Enter an album name.");
      return;
    }

    if (collectionOptions.includes(normalized)) {
      setManageStatus("error");
      setManageMessage("That album already exists.");
      return;
    }

    setCollections((current) => mergeCollections(current, [normalized]));
    setNewCollectionName("");
    setManageStatus("success");
    setManageMessage("Album created. Assign it to photos to keep it.");
  };

  const runRenameCollection = async () => {
    const from = normalizeCollectionName(renameFromCollection);
    const to = normalizeCollectionName(renameToCollection);
    if (!from || !to) {
      setManageStatus("error");
      setManageMessage("Select an album and enter a new name.");
      return;
    }

    if (from === DEFAULT_COLLECTION) {
      setManageStatus("error");
      setManageMessage(`"${DEFAULT_COLLECTION}" is the default album and cannot be renamed.`);
      return;
    }

    if (from === to) {
      setManageStatus("error");
      setManageMessage("New album name must be different.");
      return;
    }

    if (collectionOptions.includes(to)) {
      setManageStatus("error");
      setManageMessage("That album name already exists.");
      return;
    }

    setIsUpdatingCollections(true);
    setManageStatus("idle");
    setManageMessage("");
    try {
      await fetchWithCsrf("/api/photos", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "renameCollection",
          fromCollection: from,
          toCollection: to,
        }),
      }).then(parseJsonResponse);

      setCollections((current) => mergeCollections(current.filter((item) => item !== from), [to]));
      setPhotos((current) =>
        current.map((photo) => (photo.collection === from ? { ...photo, collection: to } : photo)),
      );
      setHomepagePool((current) =>
        current.map((photo) => (photo.collection === from ? { ...photo, collection: to } : photo)),
      );
      setDrafts((current) =>
        Object.fromEntries(
          Object.entries(current).map(([photoId, draft]) => [
            photoId,
            draft?.collection === from ? { ...draft, collection: to } : draft,
          ]),
        ),
      );
      setUploadForm((current) =>
        current.collection === from ? { ...current, collection: to } : current,
      );
      setBulkMoveCollection((current) => (current === from ? to : current));
      if (collectionFilter === from) {
        skipNextLibraryLoadRef.current = true;
        setPage(1);
        setCollectionFilter(to);
      }
      setRenameFromCollection("");
      setRenameToCollection("");
      setManageStatus("success");
      setManageMessage(`Album renamed from "${from}" to "${to}".`);
    } catch (error) {
      setManageStatus("error");
      setManageMessage(error.message || "Unable to rename album.");
    } finally {
      setIsUpdatingCollections(false);
    }
  };

  const runDeleteCollection = async () => {
    const target = normalizeCollectionName(deleteCollectionName);
    if (!target) {
      setManageStatus("error");
      setManageMessage("Select an album to delete.");
      return;
    }

    if (target === DEFAULT_COLLECTION) {
      setManageStatus("error");
      setManageMessage(`"${DEFAULT_COLLECTION}" is the default album and cannot be deleted.`);
      return;
    }

    setIsUpdatingCollections(true);
    setManageStatus("idle");
    setManageMessage("");
    try {
      await fetchWithCsrf("/api/photos", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "deleteCollection",
          collectionName: target,
        }),
      }).then(parseJsonResponse);

      setCollections((current) => current.filter((item) => item !== target));
      setPhotos((current) =>
        current.map((photo) =>
          photo.collection === target ? { ...photo, collection: DEFAULT_COLLECTION } : photo,
        ),
      );
      setHomepagePool((current) =>
        current.map((photo) =>
          photo.collection === target ? { ...photo, collection: DEFAULT_COLLECTION } : photo,
        ),
      );
      setDrafts((current) =>
        Object.fromEntries(
          Object.entries(current).map(([photoId, draft]) => [
            photoId,
            draft?.collection === target ? { ...draft, collection: DEFAULT_COLLECTION } : draft,
          ]),
        ),
      );
      setUploadForm((current) =>
        current.collection === target ? { ...current, collection: DEFAULT_COLLECTION } : current,
      );
      setBulkMoveCollection((current) => (current === target ? DEFAULT_COLLECTION : current));
      if (collectionFilter === target) {
        skipNextLibraryLoadRef.current = true;
        setPage(1);
        setCollectionFilter("All");
        await loadLibraryData({ collectionFilter: "All", page: 1 });
      } else {
        await loadLibraryData();
      }
      setDeleteCollectionName("");
      setManageStatus("success");
      setManageMessage(`Album deleted. Photos were moved to "${DEFAULT_COLLECTION}".`);
    } catch (error) {
      setManageStatus("error");
      setManageMessage(error.message || "Unable to delete album.");
    } finally {
      setIsUpdatingCollections(false);
    }
  };

  const toggleSelectPhoto = (photoId) => {
    setSelectedPhotoIds((current) =>
      current.includes(photoId) ? current.filter((id) => id !== photoId) : [...current, photoId],
    );
  };

  const toggleSelectAll = () => {
    if (selectedCount === photos.length) {
      setSelectedPhotoIds([]);
      return;
    }

    setSelectedPhotoIds(photos.map((photo) => photo.photoId));
  };

  const runBulkPatch = async (updates, successMessage) => {
    if (selectedCount === 0) {
      setManageStatus("error");
      setManageMessage("Select at least one photo.");
      return;
    }

    setIsBulkRunning(true);
    setManageStatus("idle");
    setManageMessage("");

    try {
      for (const photoId of selectedPhotoIds) {
        await fetchWithCsrf(`/api/photos/${photoId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(updates),
        }).then(parseJsonResponse);
      }

      await loadLibraryData();
      setSelectedPhotoIds([]);
      setManageStatus("success");
      setManageMessage(successMessage);
    } catch (error) {
      setManageStatus("error");
      setManageMessage(error.message || "Bulk update failed.");
    } finally {
      setIsBulkRunning(false);
    }
  };

  const runBulkMoveToCollection = async () => {
    if (selectedCount === 0) {
      setManageStatus("error");
      setManageMessage("Select at least one photo.");
      return;
    }

    const destination = normalizeCollectionName(bulkMoveCollection || "");
    if (!destination) {
      setManageStatus("error");
      setManageMessage("Choose a destination collection.");
      return;
    }

    const selectedPhotos = photos.filter((photo) => selectedSet.has(photo.photoId));
    const toMove = selectedPhotos.filter((photo) => photo.collection !== destination);
    const skippedCount = selectedPhotos.length - toMove.length;

    if (toMove.length === 0) {
      setManageStatus("success");
      setManageMessage(`No changes needed. All selected photos are already in "${destination}".`);
      return;
    }

    setIsBulkRunning(true);
    setManageStatus("idle");
    setManageMessage("");

    try {
      for (const photo of toMove) {
        await fetchWithCsrf(`/api/photos/${photo.photoId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ collection: destination }),
        }).then(parseJsonResponse);
      }

      await loadLibraryData();
      await loadHomepageData();
      setSelectedPhotoIds([]);
      setManageStatus("success");
      setManageMessage(
        `Moved ${toMove.length} photo(s) to "${destination}"${skippedCount > 0 ? `, skipped ${skippedCount} already there.` : "."}`,
      );
    } catch (error) {
      setManageStatus("error");
      setManageMessage(error.message || "Bulk move failed.");
    } finally {
      setIsBulkRunning(false);
    }
  };

  const runBulkDelete = async () => {
    if (selectedCount === 0) {
      setManageStatus("error");
      setManageMessage("Select at least one photo.");
      return;
    }

    const confirmed = window.confirm(`Delete ${selectedCount} selected photo(s)?`);
    if (!confirmed) {
      return;
    }

    setIsBulkRunning(true);
    setManageStatus("idle");
    setManageMessage("");

    try {
      for (const photoId of selectedPhotoIds) {
        await fetchWithCsrf(`/api/photos/${photoId}`, {
          method: "DELETE",
        }).then(parseJsonResponse);
      }

      await loadLibraryData();
      setSelectedPhotoIds([]);
      setManageStatus("success");
      setManageMessage("Selected photos deleted.");
    } catch (error) {
      setManageStatus("error");
      setManageMessage(error.message || "Bulk delete failed.");
    } finally {
      setIsBulkRunning(false);
    }
  };

  return (
    <main
      id="main-content"
      className={`admin-shell mx-auto w-full max-w-[1680px] px-4 py-8 text-foreground sm:px-8 sm:py-10 lg:px-12 [&_button]:font-semibold [&_button]:tracking-[0.06em] [&_button]:transition-all [&_button]:duration-150 [&_input]:rounded-md [&_input]:border-zinc-400 [&_input]:bg-white [&_input]:text-foreground [&_input:focus]:ring-2 [&_input:focus]:ring-foreground/20 [&_select]:rounded-md [&_select]:border-zinc-400 [&_select]:bg-white [&_select]:text-foreground [&_select:focus]:ring-2 [&_select:focus]:ring-foreground/20 [&_textarea]:rounded-md [&_textarea]:border-zinc-400 [&_textarea]:bg-white [&_textarea]:text-foreground [&_textarea:focus]:ring-2 [&_textarea:focus]:ring-foreground/20 [&_label]:font-semibold [&_label]:tracking-normal [&_label]:normal-case [&_summary]:tracking-normal [&_summary]:normal-case ${adminTypeScaleClass}`}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold tracking-[0.18em] text-zinc-800 uppercase">Admin Workspace</p>
          <h1 className="display-font mt-2 text-[2.9rem] font-semibold leading-none tracking-[-0.055em] text-foreground drop-shadow-[0_1px_0_rgba(0,0,0,0.08)] sm:text-[3.6rem]">
            Photo Control Room
          </h1>
          <p className="mt-3 max-w-2xl text-[17px] font-medium leading-relaxed text-zinc-800 sm:text-[1.18rem]">
            Curate homepage highlights, manage library metadata, and keep drafts private until ready.
          </p>
        </div>

        <div className="rounded-[1.25rem] border border-zinc-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(246,244,240,0.94)_100%)] px-4 py-3 text-left shadow-[0_14px_30px_rgba(0,0,0,0.06)] sm:min-w-[250px] sm:text-right">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-zinc-800 uppercase">
            Cloudinary: <span className="text-foreground">{ready ? "Connected" : "Not Configured"}</span>
          </p>
          <p className="mt-1 text-[11px] font-semibold tracking-[0.16em] text-zinc-800 uppercase">
            Loaded: <span className="text-foreground">{photos.length} of {totalPhotos}</span>
          </p>
          <p className="mt-1 text-[11px] font-semibold tracking-[0.16em] text-zinc-800 uppercase">
            Unsaved edits: <span className="text-foreground">{dirtyPhotoCount}</span>
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 rounded-[1.5rem] border border-line bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(246,244,240,0.92)_100%)] p-2 shadow-[0_14px_34px_rgba(0,0,0,0.06)]">
        <button
          type="button"
          onClick={() => requestWorkspaceTabChange("upload")}
          className={getWorkspaceTabClass("upload", isUploadTab)}
        >
          Upload
        </button>
        <button
          type="button"
          onClick={() => requestWorkspaceTabChange("homepage")}
          className={getWorkspaceTabClass("homepage", isHomepageTab)}
        >
          Homepage
        </button>
        <button
          type="button"
          onClick={() => requestWorkspaceTabChange("library")}
          className={getWorkspaceTabClass("library", activeTab === "library")}
        >
          Library
        </button>
        <button
          type="button"
          onClick={() => requestWorkspaceTabChange("branding")}
          className={getWorkspaceTabClass("branding", isBrandingTab)}
        >
          Branding
        </button>
        <button
          type="button"
          onClick={() => requestWorkspaceTabChange("drafts")}
          className={getWorkspaceTabClass("drafts", isDraftsTab)}
        >
          Drafts
        </button>
        <Link href="/admin/about" className={getWorkspaceTabClass("about", false)}>
          About
        </Link>
      </div>

      {isBrandingTab ? (
        <section className="mt-5 space-y-5">
          <section className="rounded-[1.85rem] border border-zinc-300/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(246,243,236,0.98)_100%)] p-4 shadow-[0_20px_48px_rgba(15,23,42,0.08)] sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <p className="text-[11px] font-semibold tracking-[0.12em] text-zinc-700 uppercase">Navbar + Website Theme</p>
                <h2 className="mt-2 text-[1.95rem] font-semibold tracking-[-0.035em] text-zinc-950 sm:text-[2.25rem]">
                  Branding Studio
                </h2>
                <p className="mt-2.5 max-w-xl text-sm text-zinc-700">
                  Shape the navbar, logo, type, and site mood from one compact control console.
                </p>
                <p className="mt-2 text-xs text-zinc-600">
                  Auto-saves are on. Undo steps back one move, and Reset returns you to the original Classic baseline.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-2 text-[10px] tracking-[0.14em] uppercase ${
                    brandingStatus === "error"
                      ? "border-red-300 bg-red-50 text-red-800"
                    : brandingStatus === "warning"
                        ? "border-amber-300 bg-amber-50 text-amber-800"
                        : isPreparingBrandLogo
                          ? "border-violet-300 bg-violet-50 text-violet-800"
                        : isSavingBranding
                          ? "border-sky-300 bg-sky-50 text-sky-800"
                          : isBrandingDirty
                      ? "border-amber-300 bg-amber-50 text-amber-800"
                      : "border-emerald-300 bg-emerald-50 text-emerald-800"
                  }`}
                >
                  {brandingStatus === "error"
                    ? "Needs Attention"
                    : brandingStatus === "warning"
                      ? "Session Only"
                      : isPreparingBrandLogo
                        ? "Preparing Logo"
                      : isSavingBranding
                        ? "Auto-Saving"
                        : isBrandingDirty
                          ? "Unsaved Changes"
                    : "Auto-Saved"}
                </span>
                <button
                  type="button"
                  onClick={resetBrandingToOriginal}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-zinc-300 bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(246,244,240,0.96)_100%)] px-5 text-[12px] text-zinc-900 shadow-[0_8px_20px_rgba(0,0,0,0.05)] hover:border-zinc-500"
                >
                  Reset to Original
                </button>
                <button
                  type="button"
                  onClick={undoBrandingDraftChange}
                  disabled={!canUndoBranding}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-zinc-300 bg-white px-5 text-[12px] text-zinc-900 shadow-[0_8px_20px_rgba(0,0,0,0.05)] hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <span className="h-4 w-4">
                    <UndoIcon />
                  </span>
                  Undo
                </button>
              </div>
            </div>

            {brandingMessage && brandingStatus !== "success" ? (
              <p
                className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                  brandingStatus === "error"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : brandingStatus === "warning"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                {brandingMessage}
              </p>
            ) : null}
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.18fr)_minmax(300px,0.82fr)]">
            <section className="rounded-[1.6rem] border border-zinc-300/75 bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(248,247,244,0.98)_100%)] p-4 shadow-[0_16px_38px_rgba(15,23,42,0.06)] sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.1em] text-zinc-700 uppercase">Wordmark</p>
                  <h3 className="mt-1 text-[1.35rem] font-semibold tracking-[-0.02em] text-zinc-950">Choose the navbar name</h3>
                </div>
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[10px] tracking-[0.14em] text-zinc-600 uppercase">
                  Max 48 Characters
                </span>
              </div>

              <label className="mt-5 block text-sm">
                Navbar title
                <input
                  type="text"
                  value={brandSettingsDraft.brandName}
                  onChange={(event) =>
                    applyBrandingDraftChange((current) => ({
                      ...current,
                      brandName: event.target.value.slice(0, 48),
                    }))
                  }
                  placeholder={siteBrand.name}
                  maxLength={48}
                  className="mt-2 h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-[15px] shadow-[0_10px_24px_rgba(0,0,0,0.04)] outline-none focus:border-zinc-900/35 focus:ring-0"
                />
              </label>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-[1.35rem] border border-zinc-200 bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(248,248,248,0.94)_100%)] p-4">
                  <p className="text-[11px] tracking-[0.14em] text-zinc-500 uppercase">Current Font</p>
                  <p className="mt-2 text-base font-semibold text-zinc-950">{selectedBrandFontOption.label}</p>
                  <p className="mt-1 text-sm text-zinc-600">{selectedBrandFontOption.note}</p>
                </div>
                <div className="rounded-[1.35rem] border border-zinc-200 bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(248,248,248,0.94)_100%)] p-4">
                  <p className="text-[11px] tracking-[0.14em] text-zinc-500 uppercase">Brand Setup</p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="inline-flex items-center gap-2 text-sm text-zinc-700">
                      <span
                        className="h-4 w-4 rounded-full border border-black/10"
                        style={{ backgroundColor: normalizedBrandSettingsDraft.textColor }}
                      />
                      Text
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700">
                      {isUsingUploadedBrandLogo
                        ? "PNG Logo Active"
                        : hasUploadedBrandLogo
                          ? "Original Mark Active"
                          : "Original Mark"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">
                    Upload a PNG any time, then swap back to the original logo whenever you want.
                  </p>
                  <p className="mt-3 text-[11px] tracking-[0.14em] text-zinc-500 uppercase">Active Theme</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-950">{selectedSiteTheme.label}</p>
                  <p className="mt-1 text-xs text-zinc-500">{selectedSiteTheme.description}</p>
                </div>
              </div>
            </section>

            <aside className="self-start rounded-[1.6rem] border border-zinc-300/75 bg-[linear-gradient(180deg,rgba(252,252,251,1)_0%,rgba(245,242,236,0.98)_100%)] p-4 shadow-[0_18px_42px_rgba(15,23,42,0.08)] sm:p-5 xl:sticky xl:top-[7.25rem]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.1em] text-zinc-700 uppercase">Live Preview</p>
                  <h3 className="mt-1 text-[1.35rem] font-semibold tracking-[-0.02em] text-zinc-950">How the chrome looks live</h3>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-semibold tracking-[0.14em] text-emerald-700 uppercase">
                  Live
                </span>
              </div>
              <div
                className="mt-4 overflow-hidden rounded-[1.45rem] border border-zinc-200/90 bg-[linear-gradient(180deg,rgba(249,249,247,0.98)_0%,rgba(249,249,247,0.93)_100%)] shadow-[0_14px_30px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]"
                style={brandingPreviewVars}
              >
                <div
                  className="border-b p-4"
                  style={{
                    background: "var(--header-bg)",
                    borderColor: "var(--header-border)",
                  }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <BrandLogoMark
                        settings={normalizedBrandSettingsDraft}
                        className="h-10 w-14"
                      />
                      <span
                        className={`logo-font block min-w-0 whitespace-normal break-words text-balance ${brandingPreviewClass}`}
                        style={brandingPreviewStyle}
                      >
                        {brandingSampleName}
                      </span>
                    </div>
                    <div
                      className="hidden items-center gap-4 text-[10px] tracking-[0.14em] uppercase sm:flex"
                      style={{ color: "var(--header-muted)" }}
                    >
                      <span style={{ color: "var(--header-ink)" }}>Gallery</span>
                      <span>About</span>
                      <span>Contact</span>
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  <div className="rounded-[1.2rem] border border-zinc-200 bg-white/72 p-4">
                    <p className="text-[10px] tracking-[0.14em] text-zinc-500 uppercase">Page content</p>
                    <div className="mt-3 h-3 w-2/3 rounded-full bg-zinc-900/14" />
                    <div className="mt-2 h-2.5 w-full rounded-full bg-zinc-900/8" />
                    <div className="mt-1.5 h-2.5 w-5/6 rounded-full bg-zinc-900/8" />
                  </div>
                </div>

                <div
                  className="border-t px-4 py-3"
                  style={{
                    background: "var(--footer-bg)",
                    borderColor: "var(--footer-border)",
                    color: "var(--footer-muted)",
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] tracking-[0.14em] uppercase">
                    <span style={{ color: "var(--footer-link)" }}>Instagram</span>
                    <span>Contact</span>
                    <span>© {new Date().getFullYear()} {brandingSampleName}</span>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs text-zinc-600">
                Changes apply here instantly, so you can keep designing while the preview stays in view.
              </p>
            </aside>
          </div>

          <section className="rounded-[1.6rem] border border-zinc-300/75 bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(247,246,243,0.98)_100%)] p-4 shadow-[0_16px_38px_rgba(15,23,42,0.06)] sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.1em] text-zinc-700 uppercase">Website Themes</p>
                <h3 className="mt-1 text-[1.35rem] font-semibold tracking-[-0.02em] text-zinc-950">Choose the site mood</h3>
                <p className="mt-1.5 max-w-2xl text-sm text-zinc-700">
                  Pick a preset to restyle the site instantly, then fine-tune from there.
                </p>
              </div>
              <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[10px] tracking-[0.14em] text-zinc-600 uppercase">
                Active: {selectedSiteTheme.label}
              </div>
            </div>

            <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {SITE_THEME_PRESETS.map((theme) => {
                const isSelected = normalizedBrandSettingsDraft.themeKey === theme.key;
                const themePreviewVars = getSiteThemeCssVariables(theme.key);

                return (
                  <button
                    key={theme.key}
                    type="button"
                    onClick={() =>
                      applyBrandingDraftChange((current) => ({
                        ...current,
                        themeKey: theme.key,
                        navbarColorMode: "theme",
                        footerColorMode: "theme",
                      }))
                    }
                    aria-pressed={isSelected}
                    className={`group rounded-[1.2rem] border p-3.5 text-left transition-all ${
                      isSelected
                        ? "border-zinc-950 bg-zinc-950 text-white ring-1 ring-zinc-950 shadow-[0_18px_32px_rgba(17,17,17,0.18)]"
                        : "border-zinc-300 bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(249,249,249,0.98)_100%)] text-zinc-950 hover:-translate-y-0.5 hover:border-zinc-500 hover:shadow-[0_14px_26px_rgba(15,23,42,0.10)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold tracking-[0.1em] uppercase">{theme.label}</p>
                        <p className={`mt-1 text-[12px] leading-5 ${isSelected ? "text-white/76" : "text-zinc-600"}`}>
                          {theme.description}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] uppercase transition-all ${
                          isSelected
                            ? "border-white/20 bg-white/10 text-white"
                            : "border-zinc-900 bg-zinc-900 text-white shadow-[0_8px_16px_rgba(17,17,17,0.12)] group-hover:bg-zinc-800"
                        }`}
                      >
                        {isSelected ? "Selected" : "Apply"}
                      </span>
                    </div>

                    <div
                      className="mt-3 overflow-hidden rounded-[1.05rem] border"
                      style={{
                        ...themePreviewVars,
                        borderColor: "var(--line)",
                        background: "var(--paper)",
                      }}
                    >
                      <div
                        className="flex items-center justify-between border-b px-2.5 py-2"
                        style={{
                          borderColor: "var(--header-border)",
                          background: "var(--header-bg)",
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="h-3.5 w-3.5 rounded-full"
                            style={{ background: "var(--accent)" }}
                            aria-hidden="true"
                          />
                          <span
                            className="text-[10px] font-semibold tracking-[0.12em] uppercase"
                            style={{ color: "var(--header-ink)" }}
                          >
                            {theme.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="hidden items-center gap-1 text-[9px] tracking-[0.14em] uppercase sm:flex">
                            <span style={{ color: "var(--header-ink)" }}>Browse</span>
                            <span style={{ color: "var(--header-muted)" }}>Archive</span>
                          </div>
                          {theme.palette.map((color) => (
                            <span
                              key={`${theme.key}-${color}`}
                              className="h-3 w-3 rounded-full border"
                              style={{ backgroundColor: color, borderColor: "rgba(0,0,0,0.08)" }}
                              aria-hidden="true"
                            />
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2.5 p-2.5">
                        <div
                          className="rounded-[0.9rem] border p-2.5"
                          style={{
                            background: "var(--surface)",
                            borderColor: "var(--line)",
                            boxShadow: "var(--shadow-soft)",
                          }}
                        >
                          <div className="h-2.5 w-2/3 rounded-full" style={{ background: "var(--primary)" }} />
                          <div className="mt-2 h-2 w-full rounded-full" style={{ background: "var(--secondary)", opacity: 0.36 }} />
                          <div className="mt-1.5 h-2 w-5/6 rounded-full" style={{ background: "var(--secondary)", opacity: 0.24 }} />
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex rounded-full border px-2.5 py-1 text-[9px] font-semibold tracking-[0.14em] uppercase"
                            style={{
                              borderColor: "var(--button-primary-border)",
                              background: "var(--button-primary-bg)",
                              color: "var(--button-primary-text)",
                            }}
                          >
                            Primary
                          </span>
                          <span
                            className="inline-flex rounded-full border px-2.5 py-1 text-[9px] font-semibold tracking-[0.14em] uppercase"
                            style={{
                              borderColor: "var(--button-secondary-border)",
                              background: "var(--button-secondary-bg)",
                              color: "var(--button-secondary-text)",
                            }}
                          >
                            Secondary
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-[10px] tracking-[0.14em] uppercase" style={{ color: "var(--link)" }}>
                            Link color
                          </span>
                          <span className="text-[10px] tracking-[0.14em] uppercase" style={{ color: "var(--secondary)" }}>
                            {theme.key}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-[1.6rem] border border-zinc-300/75 bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(247,246,243,0.98)_100%)] p-4 shadow-[0_16px_38px_rgba(15,23,42,0.06)] sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.1em] text-zinc-700 uppercase">Fonts</p>
                <h3 className="mt-1 text-[1.35rem] font-semibold tracking-[-0.02em] text-zinc-950">Pick a wordmark style</h3>
                <p className="mt-1.5 text-sm text-zinc-700">
                  Compare directions quickly without losing the live brand preview.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowExtendedBrandFonts((current) => !current)}
                className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-300 bg-white px-4 text-[11px] font-semibold tracking-[0.12em] text-zinc-800 uppercase shadow-[0_8px_18px_rgba(0,0,0,0.04)] hover:border-zinc-500 hover:bg-zinc-50"
              >
                {showExtendedBrandFonts ? "Hide More Fonts" : "More Fonts"}
              </button>
            </div>

            <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
              {primaryBrandFontOptions.map((option) => {
                const isSelected = normalizedBrandSettingsDraft.fontKey === option.key;

                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() =>
                      applyBrandingDraftChange((current) => ({
                        ...current,
                        fontKey: option.key,
                      }))
                    }
                    className={`group rounded-[1.15rem] border p-3.5 text-left transition-all ${
                      isSelected
                        ? "border-zinc-950 bg-zinc-950 text-white ring-1 ring-zinc-950 shadow-[0_16px_30px_rgba(17,17,17,0.18)]"
                        : "border-zinc-300 bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(249,249,249,0.96)_100%)] text-zinc-950 hover:-translate-y-0.5 hover:border-zinc-500 hover:shadow-[0_12px_24px_rgba(15,23,42,0.08)]"
                    } disabled:cursor-not-allowed disabled:opacity-45`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold tracking-[0.1em] uppercase">{option.label}</p>
                        <p className={`mt-1 text-[12px] leading-5 ${isSelected ? "text-white/75" : "text-zinc-600"}`}>
                          {option.note}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] uppercase transition-all ${
                          isSelected
                            ? "border-white/25 bg-white/10 text-white"
                            : "border-zinc-900 bg-zinc-900 text-white shadow-[0_8px_16px_rgba(17,17,17,0.12)] group-hover:bg-zinc-800"
                        }`}
                      >
                        {isSelected ? "Active" : "Use"}
                      </span>
                    </div>

                    <p
                      className="mt-4 min-h-[54px] break-words text-[1.45rem] leading-[0.95]"
                      style={{
                        ...option.style,
                        color: isSelected ? "#FFFFFF" : normalizedBrandSettingsDraft.textColor,
                      }}
                    >
                      {brandingSampleName}
                    </p>
                  </button>
                );
              })}
            </div>

            {showExtendedBrandFonts ? (
              <div className="mt-5 border-t border-zinc-200 pt-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.1em] text-zinc-700 uppercase">More Fonts</p>
                    <h4 className="mt-1 text-lg font-semibold text-zinc-950">Street and hip-hop inspired styles</h4>
                    <p className="mt-1.5 text-sm text-zinc-700">
                      Heavier, louder presets for a mixtape, flyer, or block-party feel.
                    </p>
                  </div>
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[10px] tracking-[0.14em] text-zinc-600 uppercase">
                    Extra Styles
                  </span>
                </div>

                <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                  {extendedBrandFontOptions.map((option) => {
                    const isSelected = normalizedBrandSettingsDraft.fontKey === option.key;

                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() =>
                          applyBrandingDraftChange((current) => ({
                            ...current,
                            fontKey: option.key,
                          }))
                        }
                        className={`group rounded-[1.15rem] border p-3.5 text-left transition-all ${
                          isSelected
                            ? "border-zinc-950 bg-zinc-950 text-white ring-1 ring-zinc-950 shadow-[0_16px_30px_rgba(17,17,17,0.18)]"
                            : "border-zinc-300 bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(249,249,249,0.96)_100%)] text-zinc-950 hover:-translate-y-0.5 hover:border-zinc-500 hover:shadow-[0_12px_24px_rgba(15,23,42,0.08)]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold tracking-[0.1em] uppercase">{option.label}</p>
                            <p className={`mt-1 text-[12px] leading-5 ${isSelected ? "text-white/75" : "text-zinc-600"}`}>
                              {option.note}
                            </p>
                          </div>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] uppercase transition-all ${
                              isSelected
                                ? "border-white/25 bg-white/10 text-white"
                                : "border-zinc-900 bg-zinc-900 text-white shadow-[0_8px_16px_rgba(17,17,17,0.12)] group-hover:bg-zinc-800"
                            }`}
                          >
                            {isSelected ? "Active" : "Use"}
                          </span>
                        </div>

                        <p
                          className="mt-4 min-h-[54px] break-words text-[1.45rem] leading-[0.95]"
                          style={{
                            ...option.style,
                            color: isSelected ? "#FFFFFF" : normalizedBrandSettingsDraft.textColor,
                          }}
                        >
                          {brandingSampleName}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-[1.6rem] border border-zinc-300/75 bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(247,246,243,0.98)_100%)] p-4 shadow-[0_16px_38px_rgba(15,23,42,0.06)] sm:p-5">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.1em] text-zinc-700 uppercase">Colors + Logo</p>
              <h3 className="mt-1 text-[1.35rem] font-semibold tracking-[-0.02em] text-zinc-950">Tune the wordmark and logo</h3>
              <p className="mt-1.5 text-sm text-zinc-700">
                Set the wordmark color, swap the navbar mark, and keep the original logo ready as a fallback.
              </p>
            </div>

            <div className="mt-4 space-y-4">
              <section className="rounded-[1.4rem] border border-zinc-200 bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(249,249,249,0.96)_100%)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] tracking-[0.14em] text-zinc-500 uppercase">Wordmark Color</p>
                    <h4 className="mt-1 text-[1.08rem] font-semibold text-zinc-950">Navbar wordmark</h4>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-medium text-zinc-700 shadow-[0_6px_16px_rgba(0,0,0,0.04)]">
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-black/10"
                      style={{ backgroundColor: normalizedBrandSettingsDraft.textColor }}
                      aria-hidden="true"
                    />
                    {wordmarkColorName}
                  </span>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,1.05fr)]">
                  <div className="rounded-[1.15rem] border border-zinc-200 bg-white p-3.5 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
                    <p className="text-[11px] tracking-[0.14em] text-zinc-500 uppercase">Choose color</p>
                    <BrandColorSwatchPalette
                      options={NAVBAR_BRAND_COLOR_OPTIONS}
                      value={normalizedBrandSettingsDraft.textColor}
                      onSelect={applyWordmarkColor}
                      onCustomChange={(event) => applyWordmarkColor(sanitizeBrandColor(event.target.value))}
                      customLabel="Custom wordmark color"
                      className="mt-3"
                    />
                  </div>

                  <div
                    className="rounded-[1.15rem] border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
                    style={{
                      background: brandingPreviewVars["--header-bg"],
                      borderColor: brandingPreviewVars["--header-border"],
                    }}
                  >
                    <p className="text-[10px] font-semibold tracking-[0.14em] uppercase" style={{ color: brandingPreviewVars["--header-ink"] }}>
                      Live Wordmark Preview
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p
                          className={`${brandingPreviewClass} break-words text-[1.7rem] leading-[0.92] sm:text-[1.95rem]`}
                          style={{
                            ...brandingPreviewStyle,
                            color: normalizedBrandSettingsDraft.textColor,
                          }}
                        >
                          {brandingSampleName}
                        </p>
                      </div>
                      <div
                        className="hidden shrink-0 items-center gap-4 text-[10px] tracking-[0.14em] uppercase sm:flex"
                        style={{ color: brandingPreviewVars["--header-muted"] }}
                      >
                        <span>Gallery</span>
                        <span>About</span>
                        <span>Contact</span>
                      </div>
                    </div>
                    <p className="mt-3 text-xs" style={{ color: brandingPreviewVars["--header-muted"] }}>
                      Current hex: {normalizedBrandSettingsDraft.textColor}
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-[1.4rem] border border-zinc-200 bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(249,249,249,0.96)_100%)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] tracking-[0.14em] text-zinc-500 uppercase">Logo Source</p>
                    <h4 className="mt-1 text-[1.08rem] font-semibold text-zinc-950">Navbar logo</h4>
                    <p className="mt-1.5 text-sm text-zinc-700">Upload a PNG logo to replace the original mark.</p>
                  </div>
                  <span className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-[10px] tracking-[0.14em] text-zinc-700 uppercase">
                    {isUsingUploadedBrandLogo
                      ? "PNG Active"
                      : hasUploadedBrandLogo
                        ? "Original Active"
                        : "Original Only"}
                  </span>
                </div>

                <input
                  ref={brandLogoInputRef}
                  type="file"
                  accept=".png,image/png"
                  onChange={handleBrandLogoFileChange}
                  className="sr-only"
                />

                <div className="mt-4 flex flex-wrap gap-2">
                  {NAVBAR_LOGO_SOURCE_OPTIONS.map((option) => {
                    const isDisabled = option.key === "custom" && !hasUploadedBrandLogo;
                    const isSelected =
                      option.key === "custom"
                        ? isUsingUploadedBrandLogo
                        : !isUsingUploadedBrandLogo;

                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() =>
                          applyBrandingDraftChange((current) => ({
                            ...current,
                            logoMode: option.key,
                          }))
                        }
                        disabled={isDisabled}
                        className={`inline-flex h-10 items-center justify-center rounded-full border px-4 text-[11px] font-semibold tracking-[0.14em] uppercase transition-all ${
                          isSelected
                            ? "border-zinc-950 bg-zinc-950 text-white shadow-[0_10px_24px_rgba(17,17,17,0.16)]"
                            : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 hover:text-zinc-950"
                        } ${isDisabled ? "cursor-not-allowed opacity-45 hover:border-zinc-200 hover:text-zinc-700" : ""}`}
                      >
                        {option.label}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={triggerBrandLogoPicker}
                    disabled={isPreparingBrandLogo}
                    className="group relative inline-flex h-11 items-center justify-center gap-2 overflow-hidden rounded-full border border-amber-300/70 bg-[linear-gradient(135deg,#171717_0%,#b45309_48%,#f59e0b_100%)] px-4 text-[11px] font-semibold tracking-[0.14em] text-white uppercase shadow-[0_14px_28px_rgba(180,83,9,0.24)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(180,83,9,0.28)] disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    <span className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.32),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0))]" />
                    <span className="relative flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
                      <UploadIcon />
                    </span>
                    <span className="relative">
                      {hasUploadedBrandLogo ? "Replace PNG" : "Upload PNG"}
                    </span>
                  </button>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.06fr)_minmax(320px,0.94fr)]">
                  <div className="rounded-[1.15rem] border border-zinc-200 bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
                    <p className="text-[11px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">Logo Preview</p>
                    <div className="mt-3 flex flex-wrap items-center gap-4">
                      <BrandLogoMark
                        settings={normalizedBrandSettingsDraft}
                        className="h-14 w-20"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-zinc-950">
                          {isUsingUploadedBrandLogo ? "PNG logo is live" : "Original mark is live"}
                        </p>
                        <p className="mt-1 text-sm text-zinc-700">
                          {isUsingUploadedBrandLogo
                            ? "Your uploaded PNG is currently showing in the navbar."
                            : "The built-in mark is currently active in the navbar."}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-[1rem] border border-zinc-200 bg-zinc-50/80 p-3">
                      <p className="text-[10px] tracking-[0.14em] text-zinc-500 uppercase">
                        {hasUploadedBrandLogo ? "PNG Preview" : "PNG Logo"}
                      </p>
                      {hasUploadedBrandLogo ? (
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <Image
                            src={normalizedBrandSettingsDraft.customLogoDataUrl}
                            alt=""
                            width={220}
                            height={88}
                            unoptimized
                            className="max-h-14 w-auto max-w-[11rem] object-contain"
                            draggable={false}
                          />
                          <p className="text-sm text-zinc-700">Prepared for the navbar and ready to use.</p>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-zinc-700">Upload a PNG to preview it here.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[1.15rem] border border-zinc-200 bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] tracking-[0.14em] text-zinc-500 uppercase">Fallback Logo Color</p>
                        <h5 className="mt-1 text-[0.98rem] font-semibold text-zinc-950">Original mark color</h5>
                      </div>
                      <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-medium text-zinc-700 shadow-[0_6px_16px_rgba(0,0,0,0.04)]">
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-black/10"
                          style={{ backgroundColor: normalizedBrandSettingsDraft.logoColor }}
                          aria-hidden="true"
                        />
                        {fallbackLogoColorName}
                      </span>
                    </div>

                    <BrandColorSwatchPalette
                      options={NAVBAR_BRAND_COLOR_OPTIONS}
                      value={normalizedBrandSettingsDraft.logoColor}
                      onSelect={applyFallbackLogoColor}
                      onCustomChange={(event) => applyFallbackLogoColor(sanitizeBrandColor(event.target.value))}
                      customLabel="Custom fallback logo color"
                      className="mt-3"
                    />

                    <div className="mt-4 flex items-center gap-3 rounded-[1rem] border border-zinc-200 bg-zinc-50/75 p-3.5">
                      <BrandLogoMark
                        settings={{
                          ...normalizedBrandSettingsDraft,
                          logoMode: "default",
                        }}
                        className="h-12 w-14"
                      />
                      <div>
                        <p className="text-sm font-semibold text-zinc-950">Original mark preview</p>
                        <p className="mt-1 text-xs text-zinc-500">Current hex: {normalizedBrandSettingsDraft.logoColor}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </section>

          <section className="rounded-[1.6rem] border border-zinc-300/75 bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(247,246,243,0.98)_100%)] p-4 shadow-[0_16px_38px_rgba(15,23,42,0.06)] sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.1em] text-zinc-700 uppercase">Navbar + Footer</p>
                <h3 className="mt-1 text-[1.35rem] font-semibold tracking-[-0.02em] text-zinc-950">Header & Footer Appearance</h3>
                <p className="mt-1.5 max-w-2xl text-sm text-zinc-700">
                  Edit one surface at a time so the preview and controls stay easy to scan.
                </p>
              </div>
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[10px] tracking-[0.14em] text-zinc-600 uppercase">
                Theme wins on preset switch
              </span>
            </div>

            <div className="mt-5 inline-flex flex-wrap gap-2 rounded-full border border-zinc-200 bg-white p-1.5 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <button
                type="button"
                onClick={() => setActiveChromePanel("header")}
                className={`inline-flex h-10 items-center justify-center rounded-full px-5 text-[11px] font-semibold tracking-[0.14em] uppercase transition-all ${
                  activeChromePanel === "header"
                    ? "bg-zinc-950 text-white shadow-[0_12px_24px_rgba(17,17,17,0.16)]"
                    : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
                }`}
              >
                Header
              </button>
              <button
                type="button"
                onClick={() => setActiveChromePanel("footer")}
                className={`inline-flex h-10 items-center justify-center rounded-full px-5 text-[11px] font-semibold tracking-[0.14em] uppercase transition-all ${
                  activeChromePanel === "footer"
                    ? "bg-zinc-950 text-white shadow-[0_12px_24px_rgba(17,17,17,0.16)]"
                    : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
                }`}
              >
                Footer
              </button>
            </div>

            {activeChromePanel === "header" ? (
              <section className="mt-5 rounded-[1.45rem] border border-zinc-200 bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(248,248,248,0.96)_100%)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] tracking-[0.14em] text-zinc-500 uppercase">Header</p>
                    <h4 className="mt-1 text-base font-semibold text-zinc-950">Background and nav text</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        applyBrandingDraftChange((current) => ({
                          ...current,
                          navbarColorMode: "theme",
                        }))
                      }
                      className={`inline-flex h-9 items-center justify-center rounded-full border px-4 text-[11px] font-semibold tracking-[0.14em] uppercase transition-all ${
                        normalizedBrandSettingsDraft.navbarColorMode === "theme"
                          ? "border-zinc-950 bg-zinc-950 text-white"
                          : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 hover:text-zinc-950"
                      }`}
                    >
                      Theme
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        applyBrandingDraftChange((current) => ({
                          ...current,
                          navbarColorMode: "custom",
                        }))
                      }
                      className={`inline-flex h-9 items-center justify-center rounded-full border px-4 text-[11px] font-semibold tracking-[0.14em] uppercase transition-all ${
                        normalizedBrandSettingsDraft.navbarColorMode === "custom"
                          ? "border-zinc-950 bg-zinc-950 text-white"
                          : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 hover:text-zinc-950"
                      }`}
                    >
                      Custom
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-3.5">
                  <div
                    className="rounded-[1.2rem] border p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
                    style={{
                      background: brandingPreviewVars["--header-bg"],
                      borderColor: brandingPreviewVars["--header-border"],
                      color: brandingPreviewVars["--header-muted"],
                    }}
                  >
                    <p className="text-[10px] font-semibold tracking-[0.14em] uppercase" style={{ color: brandingPreviewVars["--header-ink"] }}>
                      Live Header Preview
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-3 text-[10px] tracking-[0.14em] uppercase">
                      <span style={{ color: brandingPreviewVars["--header-ink"] }}>Gallery</span>
                      <span>About</span>
                      <span>Contact</span>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-600">
                    Wordmark color stays separate in the logo area above. This panel only changes the header surface and nav text.
                  </p>

                  <div className={`space-y-3.5 ${normalizedBrandSettingsDraft.navbarColorMode === "theme" ? "opacity-55" : ""}`}>
                    <div className="rounded-[1.15rem] border border-zinc-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,248,248,0.96)_100%)] p-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[11px] tracking-[0.14em] text-zinc-500 uppercase">Surface</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              applyBrandingDraftChange((current) => ({
                                ...current,
                                navbarColorMode: "custom",
                                navbarFillStyle: "solid",
                              }))
                            }
                            className={`inline-flex h-9 items-center justify-center rounded-full border px-4 text-[11px] font-semibold tracking-[0.14em] uppercase transition-all ${
                              normalizedBrandSettingsDraft.navbarFillStyle === "solid"
                                ? "border-zinc-950 bg-zinc-950 text-white"
                                : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 hover:text-zinc-950"
                            }`}
                            disabled={normalizedBrandSettingsDraft.navbarColorMode === "theme"}
                          >
                            Solid
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveNavbarPaletteTarget("start");
                              applyBrandingDraftChange((current) => ({
                                ...current,
                                navbarColorMode: "custom",
                                navbarFillStyle: "gradient",
                              }));
                            }}
                            className={`inline-flex h-9 items-center justify-center rounded-full border px-4 text-[11px] font-semibold tracking-[0.14em] uppercase transition-all ${
                              normalizedBrandSettingsDraft.navbarFillStyle === "gradient"
                                ? "border-zinc-950 bg-zinc-950 text-white"
                                : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 hover:text-zinc-950"
                            }`}
                            disabled={normalizedBrandSettingsDraft.navbarColorMode === "theme"}
                          >
                            Gradient
                          </button>
                        </div>
                      </div>

                      {normalizedBrandSettingsDraft.navbarFillStyle === "gradient" ? (
                        <div className="mt-3">
                          <p className="text-[11px] tracking-[0.14em] text-zinc-500 uppercase">Gradient</p>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <button
                              type="button"
                              onClick={() => setActiveNavbarPaletteTarget("start")}
                              disabled={normalizedBrandSettingsDraft.navbarColorMode === "theme"}
                              className={`flex items-center gap-3 rounded-[1rem] border px-3 py-2.5 text-left transition-all ${
                                activeNavbarPaletteTarget === "start"
                                  ? "border-zinc-950 bg-zinc-950 text-white shadow-[0_12px_28px_rgba(17,17,17,0.16)]"
                                  : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400"
                              } disabled:cursor-not-allowed disabled:opacity-45`}
                            >
                              <span
                                className={`h-4 w-4 rounded-full border ${activeNavbarPaletteTarget === "start" ? "border-white/65" : "border-black/10"}`}
                                style={{ backgroundColor: normalizedBrandSettingsDraft.navbarBackgroundColor }}
                                aria-hidden="true"
                              />
                              <span className="min-w-0">
                                <span className={`block text-[10px] tracking-[0.14em] uppercase ${activeNavbarPaletteTarget === "start" ? "text-white/72" : "text-zinc-500"}`}>
                                  Start Color
                                </span>
                                <span className="mt-0.5 block truncate text-sm font-semibold">{navbarStartColorName}</span>
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveNavbarPaletteTarget("end")}
                              disabled={normalizedBrandSettingsDraft.navbarColorMode === "theme"}
                              className={`flex items-center gap-3 rounded-[1rem] border px-3 py-2.5 text-left transition-all ${
                                activeNavbarPaletteTarget === "end"
                                  ? "border-zinc-950 bg-zinc-950 text-white shadow-[0_12px_28px_rgba(17,17,17,0.16)]"
                                  : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400"
                              } disabled:cursor-not-allowed disabled:opacity-45`}
                            >
                              <span
                                className={`h-4 w-4 rounded-full border ${activeNavbarPaletteTarget === "end" ? "border-white/65" : "border-black/10"}`}
                                style={{ backgroundColor: normalizedBrandSettingsDraft.navbarGradientColor }}
                                aria-hidden="true"
                              />
                              <span className="min-w-0">
                                <span className={`block text-[10px] tracking-[0.14em] uppercase ${activeNavbarPaletteTarget === "end" ? "text-white/72" : "text-zinc-500"}`}>
                                  End Color
                                </span>
                                <span className="mt-0.5 block truncate text-sm font-semibold">{navbarEndColorName}</span>
                              </span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 flex items-center gap-3 rounded-[1rem] border border-zinc-200 bg-white px-3 py-2.5 shadow-[0_8px_18px_rgba(0,0,0,0.04)]">
                          <span
                            className="h-4 w-4 rounded-full border border-black/10"
                            style={{ backgroundColor: normalizedBrandSettingsDraft.navbarBackgroundColor }}
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <p className="text-[10px] tracking-[0.14em] text-zinc-500 uppercase">Background Color</p>
                            <p className="truncate text-sm font-semibold text-zinc-900">{navbarStartColorName}</p>
                          </div>
                        </div>
                      )}

                      <div className="mt-3">
                        <p className="text-[11px] tracking-[0.14em] text-zinc-500 uppercase">Choose color</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {CHROME_BACKGROUND_COLOR_OPTIONS.map((option) => (
                            <CompactColorChipButton
                              key={`navbar-surface-${option.value}`}
                              label={option.label}
                              value={option.value}
                              selected={activeNavbarSurfaceValue === option.value}
                              onClick={() => applyNavbarSurfaceColor(option.value)}
                              disabled={normalizedBrandSettingsDraft.navbarColorMode === "theme"}
                            />
                          ))}
                          <CustomColorChipButton
                            label={`Custom ${activeNavbarSurfaceLabel.toLowerCase()}`}
                            value={activeNavbarSurfaceValue}
                            selected={!navbarSurfaceUsesPresetColor}
                            onChange={(event) => applyNavbarSurfaceColor(sanitizeBrandColor(event.target.value))}
                            disabled={normalizedBrandSettingsDraft.navbarColorMode === "theme"}
                          />
                        </div>
                      </div>
                    </div>

                    <label className="block rounded-[1.15rem] border border-zinc-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,248,248,0.96)_100%)] p-3.5 text-sm text-zinc-700">
                      <span className="text-[11px] tracking-[0.14em] text-zinc-500 uppercase">Opacity</span>
                      <div className="mt-2 flex items-center gap-3">
                        <input
                          type="range"
                          min="25"
                          max="100"
                          step="1"
                          value={normalizedBrandSettingsDraft.navbarOpacity}
                          onChange={(event) =>
                            applyBrandingDraftChange((current) => ({
                              ...current,
                              navbarColorMode: "custom",
                              navbarOpacity: Number(event.target.value),
                            }))
                          }
                          className="h-2 flex-1 accent-zinc-900"
                          disabled={normalizedBrandSettingsDraft.navbarColorMode === "theme"}
                        />
                        <span className="min-w-[3rem] rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-center text-xs font-semibold text-zinc-800">
                          {normalizedBrandSettingsDraft.navbarOpacity}%
                        </span>
                      </div>
                    </label>

                    <div className="rounded-[1.15rem] border border-zinc-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,248,248,0.96)_100%)] p-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[11px] tracking-[0.14em] text-zinc-500 uppercase">Text Color</p>
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-medium text-zinc-700 shadow-[0_6px_16px_rgba(0,0,0,0.04)]">
                          <span
                            className="h-3.5 w-3.5 rounded-full border border-black/10"
                            style={{ backgroundColor: normalizedBrandSettingsDraft.navbarTextColor }}
                            aria-hidden="true"
                          />
                          {navbarTextColorName}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {CHROME_TEXT_COLOR_OPTIONS.map((option) => (
                          <CompactColorChipButton
                            key={`navbar-text-${option.value}`}
                            label={option.label}
                            value={option.value}
                            selected={normalizedBrandSettingsDraft.navbarTextColor === option.value}
                            onClick={() => applyNavbarTextColor(option.value)}
                            disabled={normalizedBrandSettingsDraft.navbarColorMode === "theme"}
                          />
                        ))}
                        <CustomColorChipButton
                          label="Custom header text color"
                          value={normalizedBrandSettingsDraft.navbarTextColor}
                          selected={!navbarTextUsesPresetColor}
                          onChange={(event) => applyNavbarTextColor(sanitizeBrandColor(event.target.value))}
                          disabled={normalizedBrandSettingsDraft.navbarColorMode === "theme"}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            ) : (
              <section className="mt-5 rounded-[1.45rem] border border-zinc-200 bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(248,248,248,0.96)_100%)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] tracking-[0.14em] text-zinc-500 uppercase">Footer</p>
                    <h4 className="mt-1 text-base font-semibold text-zinc-950">Background and footer text</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        applyBrandingDraftChange((current) => ({
                          ...current,
                          footerColorMode: "theme",
                        }))
                      }
                      className={`inline-flex h-9 items-center justify-center rounded-full border px-4 text-[11px] font-semibold tracking-[0.14em] uppercase transition-all ${
                        normalizedBrandSettingsDraft.footerColorMode === "theme"
                          ? "border-zinc-950 bg-zinc-950 text-white"
                          : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 hover:text-zinc-950"
                      }`}
                    >
                      Theme
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        applyBrandingDraftChange((current) => ({
                          ...current,
                          footerColorMode: "custom",
                        }))
                      }
                      className={`inline-flex h-9 items-center justify-center rounded-full border px-4 text-[11px] font-semibold tracking-[0.14em] uppercase transition-all ${
                        normalizedBrandSettingsDraft.footerColorMode === "custom"
                          ? "border-zinc-950 bg-zinc-950 text-white"
                          : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 hover:text-zinc-950"
                      }`}
                    >
                      Custom
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-3.5">
                  <div
                    className="rounded-[1.2rem] border p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
                    style={{
                      background: brandingPreviewVars["--footer-bg"],
                      borderColor: brandingPreviewVars["--footer-border"],
                      color: brandingPreviewVars["--footer-muted"],
                    }}
                  >
                    <p className="text-[10px] font-semibold tracking-[0.14em] uppercase" style={{ color: brandingPreviewVars["--footer-ink"] }}>
                      Live Footer Preview
                    </p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-[10px] tracking-[0.14em] uppercase">
                      <span style={{ color: brandingPreviewVars["--footer-link"] }}>Instagram</span>
                      <span>Privacy</span>
                      <span>© {new Date().getFullYear()} {brandingSampleName}</span>
                    </div>
                  </div>

                  <div className={`space-y-3.5 ${normalizedBrandSettingsDraft.footerColorMode === "theme" ? "opacity-55" : ""}`}>
                    <div className="rounded-[1.15rem] border border-zinc-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,248,248,0.96)_100%)] p-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[11px] tracking-[0.14em] text-zinc-500 uppercase">Surface</p>
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-medium text-zinc-700 shadow-[0_6px_16px_rgba(0,0,0,0.04)]">
                          <span
                            className="h-3.5 w-3.5 rounded-full border border-black/10"
                            style={{ backgroundColor: normalizedBrandSettingsDraft.footerBackgroundColor }}
                            aria-hidden="true"
                          />
                          {footerBackgroundColorName}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {CHROME_BACKGROUND_COLOR_OPTIONS.map((option) => (
                          <CompactColorChipButton
                            key={`footer-bg-${option.value}`}
                            label={option.label}
                            value={option.value}
                            selected={normalizedBrandSettingsDraft.footerBackgroundColor === option.value}
                            onClick={() => applyFooterBackgroundColor(option.value)}
                            disabled={normalizedBrandSettingsDraft.footerColorMode === "theme"}
                          />
                        ))}
                        <CustomColorChipButton
                          label="Custom footer surface color"
                          value={normalizedBrandSettingsDraft.footerBackgroundColor}
                          selected={!footerBackgroundUsesPresetColor}
                          onChange={(event) => applyFooterBackgroundColor(sanitizeBrandColor(event.target.value))}
                          disabled={normalizedBrandSettingsDraft.footerColorMode === "theme"}
                        />
                      </div>
                    </div>

                    <label className="block rounded-[1.15rem] border border-zinc-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,248,248,0.96)_100%)] p-3.5 text-sm text-zinc-700">
                      <span className="text-[11px] tracking-[0.14em] text-zinc-500 uppercase">Opacity</span>
                      <div className="mt-2 flex items-center gap-3">
                        <input
                          type="range"
                          min="25"
                          max="100"
                          step="1"
                          value={normalizedBrandSettingsDraft.footerOpacity}
                          onChange={(event) =>
                            applyBrandingDraftChange((current) => ({
                              ...current,
                              footerColorMode: "custom",
                              footerOpacity: Number(event.target.value),
                            }))
                          }
                          className="h-2 flex-1 accent-zinc-900"
                          disabled={normalizedBrandSettingsDraft.footerColorMode === "theme"}
                        />
                        <span className="min-w-[3rem] rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-center text-xs font-semibold text-zinc-800">
                          {normalizedBrandSettingsDraft.footerOpacity}%
                        </span>
                      </div>
                    </label>

                    <div className="rounded-[1.15rem] border border-zinc-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,248,248,0.96)_100%)] p-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[11px] tracking-[0.14em] text-zinc-500 uppercase">Text Color</p>
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-medium text-zinc-700 shadow-[0_6px_16px_rgba(0,0,0,0.04)]">
                          <span
                            className="h-3.5 w-3.5 rounded-full border border-black/10"
                            style={{ backgroundColor: normalizedBrandSettingsDraft.footerTextColor }}
                            aria-hidden="true"
                          />
                          {footerTextColorName}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {CHROME_TEXT_COLOR_OPTIONS.map((option) => (
                          <CompactColorChipButton
                            key={`footer-text-${option.value}`}
                            label={option.label}
                            value={option.value}
                            selected={normalizedBrandSettingsDraft.footerTextColor === option.value}
                            onClick={() => applyFooterTextColor(option.value)}
                            disabled={normalizedBrandSettingsDraft.footerColorMode === "theme"}
                          />
                        ))}
                        <CustomColorChipButton
                          label="Custom footer text color"
                          value={normalizedBrandSettingsDraft.footerTextColor}
                          selected={!footerTextUsesPresetColor}
                          onChange={(event) => applyFooterTextColor(sanitizeBrandColor(event.target.value))}
                          disabled={normalizedBrandSettingsDraft.footerColorMode === "theme"}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <div className="relative mt-5 overflow-hidden rounded-[1.55rem] border border-zinc-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(246,244,240,0.98)_100%)] p-3 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
              <div className="pointer-events-none absolute inset-x-6 top-0 h-1 rounded-b-full bg-[linear-gradient(90deg,#111111_0%,#d8b267_42%,#8b5cf6_100%)] opacity-75" />
              <details className="group/reading">
                <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-4 rounded-[1.2rem] border border-zinc-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(252,251,248,0.96)_100%)] px-4 py-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] outline-none transition-all hover:border-zinc-300 hover:shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
                  <div className="flex min-w-0 flex-1 items-start gap-4">
                    <span className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-200/80 bg-[radial-gradient(circle_at_top,rgba(255,248,230,1)_0%,rgba(245,230,194,0.92)_48%,rgba(236,214,164,0.85)_100%)] text-[#6b4b16] shadow-[0_12px_24px_rgba(216,178,103,0.22)]">
                      <TypographyIcon />
                    </span>

                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold tracking-[0.08em] text-zinc-700 uppercase">
                        Reading & Text
                      </p>
                      <h4 className="mt-2 text-[1.32rem] font-semibold tracking-[-0.025em] text-zinc-950 sm:text-[1.45rem]">
                        Global type size and text color
                      </h4>
                      <p className="mt-2 max-w-2xl text-[14px] leading-6 text-zinc-700">
                        Keep the theme’s copy colors, or open this area to fine-tune readability so poems, captions, and body copy feel clearer everywhere on the site.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 self-center">
                    <span className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-[11px] font-semibold tracking-[0.1em] text-zinc-800 uppercase shadow-[0_8px_18px_rgba(15,23,42,0.05)] transition-colors group-hover/reading:border-zinc-400 group-hover/reading:bg-zinc-50">
                      Size: {selectedTextScaleOption.label}
                    </span>
                    <span className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-[11px] font-semibold tracking-[0.1em] text-zinc-800 uppercase shadow-[0_8px_18px_rgba(15,23,42,0.05)] transition-colors group-hover/reading:border-zinc-400 group-hover/reading:bg-zinc-50">
                      {normalizedBrandSettingsDraft.textColorMode === "custom" ? "Custom text" : "Theme text"}
                    </span>
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-300 bg-zinc-950 text-white shadow-[0_10px_24px_rgba(17,17,17,0.14)] transition-transform group-hover/reading:scale-[1.03] group-open/reading:rotate-180">
                      <span className="h-4 w-4">
                        <CaretDownIcon />
                      </span>
                    </span>
                  </div>
                </summary>

                <div className="mt-3 grid gap-5 border-t border-zinc-200/90 px-3 pb-3 pt-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
                  <section className="rounded-[1.2rem] border border-zinc-200 bg-white p-4 shadow-[0_10px_22px_rgba(0,0,0,0.04)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] tracking-[0.14em] text-zinc-500 uppercase">Type Scale</p>
                        <h5 className="mt-1 text-sm font-semibold text-zinc-950">
                          Let the whole site breathe a little more
                        </h5>
                      </div>
                      <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[10px] tracking-[0.14em] text-zinc-600 uppercase">
                        Auto-saves
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      {TEXT_SCALE_OPTIONS.map((option) => {
                        const isSelected = normalizedBrandSettingsDraft.textScaleKey === option.key;

                        return (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() =>
                              applyBrandingDraftChange((current) => ({
                                ...current,
                                textScaleKey: option.key,
                              }))
                            }
                            className={`rounded-[1.1rem] border p-3 text-left transition-all ${
                              isSelected
                                ? "border-zinc-950 bg-zinc-950 text-white shadow-[0_16px_28px_rgba(17,17,17,0.18)]"
                                : "border-zinc-200 bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(249,249,249,0.98)_100%)] text-zinc-950 hover:border-zinc-400 hover:shadow-[0_12px_24px_rgba(0,0,0,0.07)]"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-[12px] font-semibold tracking-[0.04em]">{option.label}</span>
                              <span
                                className={`rounded-full border px-2 py-1 text-[10px] tracking-[0.12em] uppercase ${
                                  isSelected
                                    ? "border-white/20 bg-white/10 text-white"
                                    : "border-zinc-200 bg-white text-zinc-600"
                                }`}
                              >
                                {option.rootFontSize}
                              </span>
                            </div>
                            <p className={`mt-2 text-sm leading-relaxed ${isSelected ? "text-white/76" : "text-zinc-600"}`}>
                              {option.note}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    <p className="mt-4 text-xs text-zinc-500">
                      These presets stay restrained on purpose so larger copy still fits the grid, cards, and lightbox rhythm.
                    </p>
                  </section>

                  <section className="rounded-[1.2rem] border border-zinc-200 bg-white p-4 shadow-[0_10px_22px_rgba(0,0,0,0.04)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] tracking-[0.14em] text-zinc-500 uppercase">Text Color</p>
                        <h5 className="mt-1 text-sm font-semibold text-zinc-950">
                          Theme-led by default, custom when you need it
                        </h5>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            applyBrandingDraftChange((current) => ({
                              ...current,
                              textColorMode: "theme",
                            }))
                          }
                          className={`inline-flex h-9 items-center justify-center rounded-full border px-4 text-[11px] font-semibold tracking-[0.14em] uppercase transition-all ${
                            normalizedBrandSettingsDraft.textColorMode === "theme"
                              ? "border-zinc-950 bg-zinc-950 text-white"
                              : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 hover:text-zinc-950"
                          }`}
                        >
                          Theme
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            applyBrandingDraftChange((current) => ({
                              ...current,
                              textColorMode: "custom",
                            }))
                          }
                          className={`inline-flex h-9 items-center justify-center rounded-full border px-4 text-[11px] font-semibold tracking-[0.14em] uppercase transition-all ${
                            normalizedBrandSettingsDraft.textColorMode === "custom"
                              ? "border-zinc-950 bg-zinc-950 text-white"
                              : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 hover:text-zinc-950"
                          }`}
                        >
                          Custom
                        </button>
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-zinc-500">
                      This setting is for body copy and supporting text. The navbar and footer stay in their own styling panels above.
                    </p>

                    <div className={`mt-4 space-y-4 ${normalizedBrandSettingsDraft.textColorMode === "theme" ? "opacity-55" : ""}`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[11px] tracking-[0.14em] text-zinc-500 uppercase">Global Text Color</p>
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-medium text-zinc-700 shadow-[0_6px_16px_rgba(0,0,0,0.04)]">
                          <span
                            className="h-3.5 w-3.5 rounded-full border border-black/10"
                            style={{ backgroundColor: normalizedBrandSettingsDraft.globalTextColor }}
                            aria-hidden="true"
                          />
                          {globalTextColorName}
                        </span>
                      </div>

                      <div className="rounded-[1rem] border border-zinc-200 bg-zinc-50/70 p-3">
                        <p className="text-[11px] tracking-[0.14em] text-zinc-500 uppercase">Choose color</p>
                        <BrandColorSwatchPalette
                          options={GLOBAL_TEXT_COLOR_OPTIONS}
                          value={normalizedBrandSettingsDraft.globalTextColor}
                          onSelect={applyGlobalTextColor}
                          onCustomChange={(event) => applyGlobalTextColor(sanitizeBrandColor(event.target.value))}
                          customLabel="Custom global text color"
                          disabled={normalizedBrandSettingsDraft.textColorMode === "theme"}
                          className="mt-3"
                        />
                      </div>
                    </div>

                    <div
                      className="mt-4 rounded-[1.15rem] border p-4"
                      style={{
                        ...brandingPreviewVars,
                        background: "var(--surface)",
                        borderColor: "var(--line)",
                        color: "var(--ink)",
                        fontSize: "var(--root-font-size)",
                        boxShadow: "var(--shadow-soft)",
                      }}
                    >
                      <p className="text-[10px] tracking-[0.14em] uppercase" style={{ color: "var(--muted)" }}>
                        Live Text Preview
                      </p>
                      <h6 className="mt-2 text-[1.1em] font-semibold leading-tight" style={{ color: "var(--ink)" }}>
                        Stronger reading without breaking the mood
                      </h6>
                      <p className="mt-2 max-w-lg leading-relaxed" style={{ color: "var(--muted)" }}>
                        Body copy, captions, poems, and supporting text all respond to this setting immediately so you can find a size and tone that still feels editorial.
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span
                          className="inline-flex rounded-full border px-3 py-1.5 text-[0.72em] font-semibold tracking-[0.14em] uppercase"
                          style={{
                            borderColor: "var(--button-primary-border)",
                            background: "var(--button-primary-bg)",
                            color: "var(--button-primary-text)",
                          }}
                        >
                          Button
                        </span>
                        <span className="text-[0.75em] font-medium tracking-[0.08em] uppercase" style={{ color: "var(--link)" }}>
                          Sample link
                        </span>
                      </div>
                    </div>
                  </section>
                </div>
              </details>
            </div>
          </section>
        </section>
      ) : isUploadTab ? (
        <section className="mt-5 rounded-[1.6rem] border border-zinc-300/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,245,239,0.98)_100%)] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] sm:p-5">
          <header className="border-b border-line pb-4">
            <p className="text-[11px] font-semibold tracking-[0.1em] text-zinc-700 uppercase">Upload Workspace</p>
            <h2 className="mt-1 text-[1.4rem] font-semibold tracking-[-0.02em] text-foreground">Multi-photo upload</h2>
            <p className="mt-1.5 text-sm text-foreground/80">
              Build a batch once, then push it through with tighter, faster controls.
            </p>
          </header>

          <form onSubmit={handleUploadSubmit} className="mt-5 space-y-4">
            <section className="rounded-[1.2rem] border border-zinc-300/70 bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(249,248,245,0.98)_100%)] p-4 shadow-[0_12px_26px_rgba(15,23,42,0.05)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">1. Choose photos</h3>
                  <p className="mt-1 text-sm text-muted">Start by selecting one or more image files. This is the only required step.</p>
                </div>
                <span className="rounded-full border border-foreground/20 bg-foreground/5 px-2.5 py-1 text-xs font-semibold text-foreground">
                  Required
                </span>
              </div>

              <input
                key={fileInputKey}
                id="upload-photo-files"
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="sr-only"
                disabled={isUploading}
              />

              <label
                htmlFor="upload-photo-files"
                className="mt-3 block cursor-pointer rounded-xl border border-dashed border-zinc-400 bg-zinc-50 px-4 py-5 transition-colors hover:border-foreground hover:bg-zinc-100"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Drop images here or browse</p>
                    <p className="mt-1 text-sm text-muted">JPG, PNG, WEBP. Maximum 12MB per file.</p>
                  </div>
                  <span className="rounded-md border border-line bg-white px-3 py-2 text-xs text-foreground">
                    Choose files
                  </span>
                </div>
              </label>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-foreground">
                  {files.length} file(s) selected
                </span>
                <span className="text-xs text-muted">Limit: 12MB each</span>
              </div>

              {files.length > 0 ? (
                <div className="mt-3 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                  {files.slice(0, 6).map((file) => (
                    <p
                      key={`${file.name}-${file.size}`}
                      className="truncate rounded-md border border-line bg-white px-2.5 py-1.5 text-xs text-foreground/85"
                    >
                      {file.name}
                    </p>
                  ))}
                  {files.length > 6 ? (
                    <p className="rounded-md border border-line bg-white px-2.5 py-1.5 text-xs text-muted">
                      +{files.length - 6} more file(s)
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="rounded-[1.2rem] border border-zinc-300/70 bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(249,248,245,0.98)_100%)] p-4 shadow-[0_12px_26px_rgba(15,23,42,0.05)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">2. Default metadata</h3>
                  <p className="mt-1 text-sm text-muted">Applied to each photo by default. You can edit per-photo later in Library.</p>
                </div>
                <span className="rounded-full border border-line bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-muted">
                  Core settings
                </span>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                <label className="text-sm">
                  Title template
                  <input
                    name="title"
                    value={uploadForm.title}
                    onChange={handleUploadFieldChange}
                    type="text"
                    placeholder="Optional"
                    className="mt-1.5 w-full border border-line px-3 py-2.5 outline-none focus:border-foreground"
                    disabled={isUploading}
                  />
                </label>

                <label className="text-sm">
                  Alt text template
                  <input
                    name="alt"
                    value={uploadForm.alt}
                    onChange={handleUploadFieldChange}
                    type="text"
                    placeholder="Describe image for screen readers"
                    className="mt-1.5 w-full border border-line px-3 py-2.5 outline-none focus:border-foreground"
                    disabled={isUploading}
                  />
                </label>

                <label className="text-sm">
                  Collection
                  <select
                    name="collection"
                    value={uploadForm.collection}
                    onChange={handleUploadFieldChange}
                    className="mt-1.5 w-full border border-line px-3 py-2.5 outline-none focus:border-foreground"
                    disabled={isUploading}
                  >
                    {collectionOptions.map((collection) => (
                      <option key={collection} value={collection}>
                        {collection}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="rounded-[1.2rem] border border-zinc-300/70 bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(249,248,245,0.98)_100%)] p-4 shadow-[0_12px_26px_rgba(15,23,42,0.05)]">
              <h3 className="text-lg font-semibold text-foreground">3. Publishing settings</h3>
              <p className="mt-1 text-sm text-muted">Control public visibility and whether uploads should appear on the homepage curation list.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <ToggleSwitch
                  label="Feature on homepage"
                  checked={Boolean(uploadForm.featured)}
                  tone="homepage"
                  onChange={(event) =>
                    handleUploadFieldChange({
                      target: { name: "featured", type: "checkbox", checked: event.target.checked, value: "" },
                    })
                  }
                  disabled={isUploading}
                />
                <ToggleSwitch
                  label="Published on site"
                  checked={Boolean(uploadForm.published)}
                  tone="published"
                  onChange={(event) =>
                    handleUploadFieldChange({
                      target: { name: "published", type: "checkbox", checked: event.target.checked, value: "" },
                    })
                  }
                  disabled={isUploading}
                />
              </div>
              <p className="mt-2 text-sm text-muted">
                Published photos appear on public pages. Disable it to keep uploads private in Drafts.
              </p>
            </section>

            <section className="rounded-[1.2rem] border border-zinc-300/70 bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(249,248,245,0.98)_100%)] p-4 shadow-[0_12px_26px_rgba(15,23,42,0.05)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">4. Optional writing</h3>
                  <p className="mt-1 text-sm text-muted">Add caption or poem templates only if needed.</p>
                </div>
                <span className="rounded-full border border-line bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-muted">
                  Optional
                </span>
              </div>

              <div className="mt-3 space-y-2">
                <details className="rounded-md border border-line bg-zinc-50/60">
                  <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-foreground">Caption template</summary>
                  <div className="border-t border-line bg-white px-3 py-3">
                    <textarea
                      name="caption"
                      value={uploadForm.caption}
                      onChange={handleUploadFieldChange}
                      rows={3}
                      className="min-h-[110px] w-full border border-line px-3 py-2.5 outline-none focus:border-foreground"
                      disabled={isUploading}
                    />
                  </div>
                </details>

                <details className="rounded-md border border-line bg-zinc-50/60">
                  <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-foreground">Poem template</summary>
                  <div className="border-t border-line bg-white px-3 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">Poem editor</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowUploadPoemFormatting((current) => !current)}
                          className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                            showUploadPoemFormatting
                              ? "border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100"
                              : "border-line bg-white text-foreground/85 hover:border-violet-300 hover:text-violet-700"
                          }`}
                        >
                          {showUploadPoemFormatting ? "Hide format" : "Format"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowUploadPoemPreview((current) => !current)}
                          className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                            showUploadPoemPreview
                              ? "border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100"
                              : "border-line bg-white text-foreground/85 hover:border-sky-300 hover:text-sky-700"
                          }`}
                        >
                          {showUploadPoemPreview ? "Hide preview" : "Preview"}
                        </button>
                        <button
                          type="button"
                          onClick={() => openPoemEditor("upload")}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line hover:border-foreground"
                          aria-label="Expand poem editor"
                          title="Expand poem editor"
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M8 4H4v4" />
                            <path d="M16 4h4v4" />
                            <path d="M8 20H4v-4" />
                            <path d="M16 20h4v-4" />
                            <path d="M4 4l6 6" />
                            <path d="M20 4l-6 6" />
                            <path d="M4 20l6-6" />
                            <path d="M20 20l-6-6" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {showUploadPoemFormatting ? (
                      <div className="mt-2">
                        <PoemToolbar onInsert={insertPoemFormatting} />
                      </div>
                    ) : null}

                    <textarea
                      ref={uploadPoemRef}
                      name="poem"
                      value={uploadForm.poem}
                      onChange={(event) => {
                        handleUploadFieldChange(event);
                        resizeTextarea(event.target);
                      }}
                      rows={4}
                      className="mt-2 min-h-[120px] w-full border border-line px-3 py-2.5 leading-7 whitespace-pre-wrap outline-none focus:border-foreground"
                      disabled={isUploading}
                    />
                    {showUploadPoemPreview ? (
                      <PoemLivePreview
                        value={uploadForm.poem}
                        emptyText="Write a poem and click Preview to view formatting."
                        className="mt-2"
                      />
                    ) : null}
                  </div>
                </details>
              </div>
            </section>

            <section className="rounded-[1.2rem] border border-zinc-900/20 bg-[linear-gradient(180deg,rgba(248,248,248,0.84)_0%,rgba(255,255,255,1)_100%)] p-4 shadow-[0_12px_26px_rgba(15,23,42,0.05)]">
              <h3 className="text-lg font-semibold text-foreground">5. Upload</h3>
              <p className="mt-1 text-sm text-muted">
                Ready to upload {files.length} photo{files.length === 1 ? "" : "s"} with your current defaults.
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted">
                  {ready ? "Cloudinary is connected." : "Cloudinary is not configured."}
                </p>
                <button
                  type="submit"
                  className="w-full rounded-md border border-foreground bg-foreground px-6 py-3.5 text-sm font-semibold text-background hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[240px]"
                  disabled={isUploading || !ready || files.length === 0}
                >
                  {isUploading ? "Uploading..." : `Upload ${files.length || ""} photo${files.length === 1 ? "" : "s"}`}
                </button>
              </div>
            </section>
          </form>

          {uploadMessage ? (
            <p className={`mt-4 text-sm ${uploadStatus === "error" ? "text-red-700" : "text-foreground/80"}`}>
              {uploadMessage}
            </p>
          ) : null}

          {uploadResults.length > 0 ? (
            <div className="mt-4 max-h-56 overflow-y-auto rounded-md border border-line bg-white">
              {uploadResults.map((item) => (
                <div
                  key={`${item.fileName}-${item.status}-${item.message}`}
                  className="flex items-center justify-between gap-3 border-b border-line px-3 py-2 text-sm last:border-b-0"
                >
                  <p className="truncate">{item.fileName}</p>
                  <p className={item.status === "success" ? "text-emerald-700" : "text-red-700"}>
                    {item.message}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <section className="mt-5 space-y-4">
          {isHomepageTab ? (
            <>
              <div className="rounded-[1.6rem] border border-zinc-300/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(246,242,235,0.96)_100%)] p-4 shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.1em] text-zinc-700 uppercase">Homepage</p>
                    <h2 className="mt-1 text-[1.35rem] font-semibold tracking-[-0.02em] text-zinc-950">Homepage Editor</h2>
                    <p className="mt-1.5 max-w-2xl text-sm text-muted">
                      Curate the first page visitors see. Choose up to {HOMEPAGE_MAX_PHOTOS} published photos and set the sequence.
                      The first photo becomes the Main Photo.
                    </p>
                  </div>
                  <div className="text-right text-xs tracking-[0.12em] text-muted uppercase">
                    <p>{homepagePhotoIds.length} / {HOMEPAGE_MAX_PHOTOS} selected</p>
                    <p className="mt-1">{hasHomepageChanges ? "Unsaved homepage changes" : "Homepage saved"}</p>
                  </div>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
                  <div
                    className="h-full bg-foreground/80 transition-[width] duration-300"
                    style={{ width: `${Math.min(100, (homepagePhotoIds.length / HOMEPAGE_MAX_PHOTOS) * 100)}%` }}
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={saveHomepageSelection}
                    disabled={isSavingHomepage || !hasHomepageChanges}
                    className="border border-foreground bg-foreground px-4 py-2 text-[10px] tracking-[0.14em] text-background uppercase transition-opacity hover:opacity-90 disabled:opacity-45"
                  >
                    {isSavingHomepage ? "Saving..." : "Save Homepage"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHomepagePhotoIds(baseHomepageOrderRef.current);
                      setHasHomepageChanges(false);
                      setHomepageDraggingPhotoId("");
                      setHomepageDragOverPhotoId("");
                    }}
                    disabled={isSavingHomepage || !hasHomepageChanges}
                    className="border border-line px-4 py-2 text-[10px] tracking-[0.14em] uppercase transition-colors hover:border-foreground disabled:opacity-45"
                  >
                    Reset
                  </button>
                </div>

                {homepageMessage ? (
                  <p className={`mt-3 text-sm ${homepageStatus === "error" ? "text-red-700" : "text-muted"}`}>
                    {homepageMessage}
                  </p>
                ) : null}
              </div>

              <div className="space-y-4">
                <section className="h-fit rounded-[1.35rem] border border-zinc-300/70 bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(249,248,245,0.98)_100%)] p-3.5 shadow-[0_14px_28px_rgba(15,23,42,0.05)] sm:p-4">
                  <h3 className="text-[11px] font-semibold tracking-[0.1em] text-zinc-700 uppercase">Homepage Sequence</h3>
                  <p className="mt-2 text-sm text-muted">
                    Drag to reorder on desktop, or use the move buttons on touch devices and compact screens.
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Tip: drag photo cards from the Published Library Picker below into this sequence.
                  </p>

                  <input
                    value={homepageSearchInput}
                    onChange={(event) => setHomepageSearchInput(event.target.value)}
                    placeholder="Search title, caption, poem, category"
                    className="mt-3 w-full border border-line px-3 py-2 text-sm normal-case outline-none focus:border-foreground"
                  />

                  <div
                    ref={homepageSequenceRef}
                    onDragOver={handleHomepageListDragOver}
                    onDrop={handleHomepageListDrop}
                    className="mt-3 max-h-[56vh] space-y-2 overflow-y-auto pr-1 sm:max-h-[62vh]"
                  >
                    {homepageLoading ? (
                      <p className="text-sm text-muted">Loading homepage photos...</p>
                    ) : filteredHomepageSelectedPhotos.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-line px-3 py-5 text-sm text-muted">
                        {homepageSearchTerm ? "No matching homepage photos for this search." : "No homepage photos selected yet."}
                      </p>
                    ) : (
                      filteredHomepageSelectedPhotos.map((photo) => {
                        const draft = drafts[photo.photoId] || toDraft(photo);
                        const isDirty = isDraftDirty(photo, draft);
                        const isDragging = homepageDraggingPhotoId === photo.photoId;
                        const isDropTarget = homepageDragOverPhotoId === photo.photoId;
                        const isActive = homepageActivePhoto?.photoId === photo.photoId;
                        const slotLabel = homepagePhotoIds.findIndex((photoId) => photoId === photo.photoId) + 1;
                        const canMoveUp = slotLabel > 1 && !isSavingHomepage && !isAutoSavingHomepageOrder;
                        const canMoveDown =
                          slotLabel < homepagePhotoIds.length && !isSavingHomepage && !isAutoSavingHomepageOrder;

                        return (
                          <article
                            key={photo.photoId}
                            draggable={supportsDesktopDrag}
                            onDragStart={(event) => handleHomepageDragStart(event, photo.photoId)}
                            onDragOver={(event) => handleHomepageDragOver(event, photo.photoId)}
                            onDrop={(event) => handleHomepageDrop(event, photo.photoId)}
                            onDragEnd={handleHomepageDragEnd}
                            onClick={() => setHomepageActivePhotoId(photo.photoId)}
                            className={`cursor-pointer rounded-xl border bg-white p-2.5 transition-all sm:p-3 ${
                              isActive
                                ? "border-foreground shadow-[0_10px_24px_rgba(0,0,0,0.09)]"
                                : isDropTarget
                                  ? "border-foreground/70 ring-1 ring-foreground/25"
                                  : "border-line hover:border-foreground/45"
                            } ${isDragging ? "scale-[0.995] opacity-60" : ""}`}
                          >
                            <div className="flex items-center gap-2.5 sm:gap-3">
                              <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-xs tracking-[0.08em] font-semibold ${
                                  slotLabel === 1
                                    ? "border-amber-500/70 bg-amber-50 text-amber-800"
                                    : "border-foreground/25 bg-zinc-50 text-foreground/85"
                                }`}
                                aria-label={`Homepage position ${slotLabel}`}
                                title={`Homepage position ${slotLabel}`}
                              >
                                #{slotLabel}
                              </div>

                              <div className="relative h-[4.5rem] w-14 shrink-0 overflow-hidden rounded border border-line bg-zinc-200 sm:h-20 sm:w-16">
                                <Image
                                  src={photo.thumbnailUrl || photo.imageUrl}
                                  alt={photo.alt || photo.title || "Homepage photo"}
                                  fill
                                  draggable={false}
                                  sizes="(max-width: 640px) 72px, 96px"
                                  className="object-cover"
                                />
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold leading-tight sm:text-base">
                                  {photo.title || "Untitled"}
                                </p>
                                <p className="mt-1 truncate text-[10px] tracking-[0.12em] text-muted uppercase">
                                  {photo.collection}
                                </p>
                              </div>

                              <div className="flex flex-col items-end gap-1">
                                {slotLabel === 1 ? (
                                  <span className="rounded-full border border-amber-500/70 bg-amber-50 px-1.5 py-0.5 text-[10px] tracking-[0.12em] text-amber-800 uppercase sm:px-2 sm:py-1">
                                    Main Photo
                                  </span>
                                ) : null}
                                {isDirty ? (
                                  <span className="rounded-full border border-amber-500/80 bg-amber-100 px-1.5 py-0.5 text-[10px] tracking-[0.1em] text-amber-900 uppercase sm:px-2 sm:py-1">
                                    Unsaved
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div className="mt-2 flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  moveHomepagePhotoByOffset(photo.photoId, -1);
                                }}
                                disabled={!canMoveUp}
                                aria-label={`Move ${photo.title || "photo"} up in homepage sequence`}
                                className="inline-flex min-h-9 items-center gap-1 rounded border border-line px-2 py-1 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground disabled:opacity-35"
                              >
                                <span className="h-3.5 w-3.5">
                                  <MoveArrowIcon direction="up" />
                                </span>
                                Up
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  moveHomepagePhotoByOffset(photo.photoId, 1);
                                }}
                                disabled={!canMoveDown}
                                aria-label={`Move ${photo.title || "photo"} down in homepage sequence`}
                                className="inline-flex min-h-9 items-center gap-1 rounded border border-line px-2 py-1 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground disabled:opacity-35"
                              >
                                <span className="h-3.5 w-3.5">
                                  <MoveArrowIcon direction="down" />
                                </span>
                                Down
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setHomepageActivePhotoId(photo.photoId);
                                  setIsHomepageEditorOpen(true);
                                }}
                                className="rounded border border-line px-2 py-1 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  removePhotoFromHomepage(photo.photoId);
                                }}
                                className="rounded border border-line px-2 py-1 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
                              >
                                Remove
                              </button>
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                </section>
              </div>

              <section className="rounded-[1.35rem] border border-zinc-300/70 bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(249,248,245,0.98)_100%)] p-3.5 shadow-[0_14px_28px_rgba(15,23,42,0.05)] sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[11px] font-semibold tracking-[0.1em] text-zinc-700 uppercase">Published Library Picker</h3>
                    <p className="mt-2 text-sm text-muted">
                      Add published photos to homepage on touch devices, or drag a card into Homepage Sequence on desktop.
                    </p>
                  </div>
                  <p className="text-xs tracking-[0.12em] text-muted uppercase">
                    {filteredHomepageAvailablePhotos.length} available
                  </p>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {filteredHomepageAvailablePhotos.map((photo) => (
                    <article
                      key={photo.photoId}
                      draggable={supportsDesktopDrag}
                      onDragStart={(event) => handleHomepagePoolDragStart(event, photo.photoId)}
                      onDragEnd={handleHomepageDragEnd}
                      className="group overflow-hidden rounded-xl border border-line bg-white transition-all hover:border-foreground/45 hover:shadow-[0_10px_22px_rgba(0,0,0,0.08)]"
                    >
                      <div className="relative aspect-[4/5] w-full bg-zinc-200">
                        <Image
                          src={photo.thumbnailUrl || photo.imageUrl}
                          alt={photo.alt || photo.title || "Published photo"}
                          fill
                          draggable={false}
                          sizes="(max-width: 640px) 88vw, (max-width: 1024px) 44vw, (max-width: 1536px) 30vw, 22vw"
                          className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                      </div>
                      <div className="space-y-2 p-3 sm:p-3.5">
                        <p className="truncate text-[15px] font-semibold sm:text-base">{photo.title || "Untitled"}</p>
                        <p className="truncate text-[10px] tracking-[0.12em] text-muted uppercase">{photo.collection}</p>
                        <p className="text-xs text-muted">Use Add on touch devices, or drag to sequence on desktop.</p>
                        <button
                          type="button"
                          onClick={() => addPhotoToHomepage(photo.photoId)}
                          disabled={homepagePhotoIds.length >= HOMEPAGE_MAX_PHOTOS}
                          className="w-full rounded border border-line px-3 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground disabled:opacity-45"
                        >
                          Add to Homepage
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                {!homepageLoading && filteredHomepageAvailablePhotos.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">
                    {homepageSearchTerm ? "No published photos match this search." : "No more published photos available to add."}
                  </p>
                ) : null}
              </section>
            </>
          ) : (
          <>
          <div className="rounded-[1.6rem] border border-zinc-300/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,245,239,0.98)_100%)] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[1.6rem] font-semibold tracking-[-0.02em] text-zinc-950 sm:text-[1.75rem]">
                  {libraryTitle}
                  <span className="ml-2 text-[0.85em] font-medium text-zinc-500">
                    ({libraryResultCount.toLocaleString()})
                  </span>
                </h2>
              </div>

              <div ref={libraryToolsRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setShowLibraryToolsMenu((current) => !current)}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 text-[12px] text-zinc-800 shadow-[0_8px_20px_rgba(0,0,0,0.05)] hover:border-zinc-900/35 hover:text-zinc-950"
                  aria-expanded={showLibraryToolsMenu}
                  aria-label="Toggle album manager"
                >
                  <span className="h-4 w-4">
                    <ActionsIcon />
                  </span>
                  Albums
                </button>

                {showLibraryToolsMenu ? (
                  <div className="absolute right-0 top-[calc(100%+0.6rem)] z-40 w-[min(92vw,390px)]">
                    <div className="max-h-[min(82vh,760px)] overflow-y-auto rounded-[1.55rem] border border-zinc-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(249,247,243,0.98)_100%)] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[1.35rem] font-semibold tracking-[-0.02em] text-zinc-950">
                            Manage Albums
                          </p>
                          <p className="mt-1 text-[11px] tracking-[0.12em] text-zinc-500 uppercase">
                            Create, rename, or remove albums
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowLibraryToolsMenu(false)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-[linear-gradient(180deg,rgba(252,250,247,1)_0%,rgba(245,242,237,0.96)_100%)] text-zinc-600 shadow-[0_6px_16px_rgba(0,0,0,0.05)] transition-colors hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-900"
                          aria-label="Close album manager"
                        >
                          <span className="h-4 w-4">
                            <CloseIcon />
                          </span>
                        </button>
                      </div>

                      <div className="mt-6 space-y-4">
                        <section className="rounded-[1.2rem] border border-zinc-200/85 bg-white/96 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.06)]">
                          <div>
                            <p className="text-[11px] tracking-[0.14em] text-zinc-500 uppercase">
                              Create Album
                            </p>
                            <h3 className="mt-1 text-base font-semibold text-zinc-950">
                              Add a new album
                            </h3>
                            <p className="mt-1 text-sm text-muted">
                              New albums appear in filters right away and are saved once photos use them.
                            </p>
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                            <input
                              value={newCollectionName}
                              onChange={(event) => setNewCollectionName(event.target.value)}
                              placeholder="New album name"
                              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-sm shadow-[0_6px_18px_rgba(0,0,0,0.04)] outline-none focus:border-zinc-900/35 focus:ring-0"
                            />
                            <LibraryActionButton
                              icon={<PlusIcon />}
                              variant="primary"
                              onClick={addCollectionOption}
                              className="justify-center sm:min-w-[120px]"
                            >
                              Create
                            </LibraryActionButton>
                          </div>
                        </section>

                        <section className="rounded-[1.2rem] border border-zinc-200/85 bg-white/96 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.06)]">
                          <div>
                            <p className="text-[11px] tracking-[0.14em] text-zinc-500 uppercase">
                              Rename Album
                            </p>
                            <h3 className="mt-1 text-base font-semibold text-zinc-950">
                              Update an album name
                            </h3>
                          </div>
                          <div className="mt-4 grid gap-3">
                            <PanelSelectInput
                              label="Album"
                              value={renameFromCollection}
                              displayValue={renameFromCollection || "Select album"}
                              onChange={(event) => setRenameFromCollection(event.target.value)}
                              disabled={manageableCollectionOptions.length < 1 || isUpdatingCollections}
                            >
                              <option value="">Select album</option>
                              {manageableCollectionOptions.map((collection) => (
                                <option key={`rename-${collection}`} value={collection}>
                                  {collection}
                                </option>
                              ))}
                            </PanelSelectInput>
                            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                              <input
                                value={renameToCollection}
                                onChange={(event) => setRenameToCollection(event.target.value)}
                                placeholder="New album name"
                                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-sm shadow-[0_6px_18px_rgba(0,0,0,0.04)] outline-none focus:border-zinc-900/35 focus:ring-0"
                              />
                              <LibraryActionButton
                                icon={<PencilIcon />}
                                variant="secondary"
                                onClick={runRenameCollection}
                                disabled={manageableCollectionOptions.length < 1 || isUpdatingCollections}
                                className="justify-center sm:min-w-[120px]"
                              >
                                Rename
                              </LibraryActionButton>
                            </div>
                          </div>
                        </section>

                        <section className="rounded-[1.2rem] border border-red-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,247,247,0.98)_100%)] p-4 shadow-[0_10px_24px_rgba(220,38,38,0.08)]">
                          <div>
                            <p className="text-[11px] tracking-[0.14em] text-red-500 uppercase">
                              Delete Album
                            </p>
                            <h3 className="mt-1 text-base font-semibold text-zinc-950">
                              Remove an album
                            </h3>
                            <p className="mt-1 text-sm text-zinc-600">
                              Photos from a deleted album are moved to {DEFAULT_COLLECTION}.
                            </p>
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                            <PanelSelectInput
                              label="Album"
                              value={deleteCollectionName}
                              displayValue={deleteCollectionName || "Select album"}
                              onChange={(event) => setDeleteCollectionName(event.target.value)}
                              disabled={manageableCollectionOptions.length < 1 || isUpdatingCollections}
                            >
                              <option value="">Select album</option>
                              {manageableCollectionOptions.map((collection) => (
                                <option key={`delete-${collection}`} value={collection}>
                                  {collection}
                                </option>
                              ))}
                            </PanelSelectInput>
                            <LibraryActionButton
                              icon={<TrashIcon />}
                              variant="danger"
                              onClick={runDeleteCollection}
                              disabled={!deleteCollectionName || isUpdatingCollections}
                              className="justify-center sm:self-end sm:min-w-[120px]"
                            >
                              Delete
                            </LibraryActionButton>
                          </div>
                        </section>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <label className="relative min-w-[min(100%,320px)] flex-[1_1_320px] max-w-[420px]">
                <span className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400">
                  <SearchIcon />
                </span>
                <input
                  aria-label="Search photos, captions, poems"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search photos, captions, poems..."
                  className="h-10 w-full rounded-full border border-zinc-300 bg-white pl-10 pr-4 text-sm shadow-[0_6px_18px_rgba(0,0,0,0.04)] outline-none focus:border-foreground"
                />
              </label>

              <FilterSelectPill
                label="Category"
                value={collectionFilter}
                displayValue={
                  collectionFilter === "All"
                    ? "All"
                    : collectionFilter === HOMEPAGE_COLLECTION_FILTER
                      ? "Homepage"
                      : collectionFilter
                }
                onChange={(event) => {
                  setPage(1);
                  setCollectionFilter(event.target.value);
                }}
                valueClassName="max-w-[9.5rem]"
              >
                <option value="All">All</option>
                {!isDraftsTab ? (
                  <option value={HOMEPAGE_COLLECTION_FILTER}>Homepage</option>
                ) : null}
                {collectionOptions.map((collection) => (
                  <option key={collection} value={collection}>
                    {collection}
                  </option>
                ))}
              </FilterSelectPill>

              <FilterSelectPill
                label="Sort"
                value={librarySort}
                displayValue={currentLibrarySortLabel}
                onChange={(event) => {
                  setPage(1);
                  setLibrarySort(event.target.value);
                }}
                valueClassName="max-w-[9rem]"
              >
                {librarySortOptions.map((option) => (
                  <option key={`toolbar-sort-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </FilterSelectPill>

              <FilterSelectPill
                label="Visibility"
                value={effectivePublishedFilter}
                displayValue={currentLibraryVisibilityLabel}
                onChange={(event) => {
                  if (isDraftsTab) {
                    return;
                  }
                  setPage(1);
                  setPublishedFilter(event.target.value);
                }}
                disabled={isDraftsTab}
                valueClassName="max-w-[7rem]"
              >
                <option value="all">All</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </FilterSelectPill>
            </div>

            {isDraftsTab ? (
              <p className="mt-3 text-sm text-muted">
                Draft vault view: all unpublished photos are listed here so you can review and publish later.
              </p>
            ) : null}
          </div>

          {hasActiveLibraryFilters ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {searchChipValue ? (
                <button
                  type="button"
                  onClick={clearLibrarySearch}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-[11px] text-zinc-700 shadow-[0_6px_16px_rgba(0,0,0,0.04)] hover:border-zinc-900/40"
                >
                  Search: {searchChipValue}
                  <span className="h-3.5 w-3.5">
                    <ChipCloseIcon />
                  </span>
                </button>
              ) : null}
              {collectionFilter !== "All" ? (
                <button
                  type="button"
                  onClick={clearCollectionFilter}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-[11px] text-zinc-700 shadow-[0_6px_16px_rgba(0,0,0,0.04)] hover:border-zinc-900/40"
                >
                  Category: {currentLibraryViewLabel}
                  <span className="h-3.5 w-3.5">
                    <ChipCloseIcon />
                  </span>
                </button>
              ) : null}
              {librarySort !== "newest" ? (
                <button
                  type="button"
                  onClick={clearLibrarySort}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-[11px] text-zinc-700 shadow-[0_6px_16px_rgba(0,0,0,0.04)] hover:border-zinc-900/40"
                >
                  Sort: {currentLibrarySortLabel}
                  <span className="h-3.5 w-3.5">
                    <ChipCloseIcon />
                  </span>
                </button>
              ) : null}
              {!isDraftsTab && effectivePublishedFilter !== "all" ? (
                <button
                  type="button"
                  onClick={clearVisibilityFilter}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-[11px] text-zinc-700 shadow-[0_6px_16px_rgba(0,0,0,0.04)] hover:border-zinc-900/40"
                >
                  Visibility: {currentLibraryVisibilityLabel}
                  <span className="h-3.5 w-3.5">
                    <ChipCloseIcon />
                  </span>
                </button>
              ) : null}
            </div>
          ) : null}

          {manageMessage ? (
            <p className={`text-sm ${manageStatus === "error" ? "text-red-700" : "text-muted"}`}>
              {manageMessage}
            </p>
          ) : null}

          <div className="space-y-4">
            <section className="rounded-[1.35rem] border border-zinc-300/70 bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(249,248,245,0.98)_100%)] p-4 shadow-[0_14px_28px_rgba(15,23,42,0.05)]">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={photos.length > 0 && selectedCount === photos.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 accent-foreground"
                    aria-label="Select all photos on this page"
                  />
                  Select all on page
                </label>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold tracking-[0.08em] uppercase ${libraryViewTone.chip}`}>
                    <span className={`h-2.5 w-2.5 rounded-full ${libraryViewTone.dot}`} aria-hidden="true" />
                    View: {currentLibraryViewLabel}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-zinc-300 bg-zinc-50 px-3.5 py-1.5 text-xs font-semibold tracking-[0.08em] text-zinc-700 uppercase">
                    {selectedCount > 0 ? `${selectedCount} selected` : "Click card to edit"}
                  </span>
                </div>
              </div>

              <div className="mb-3 flex flex-wrap items-center gap-2">
                {lastOrderSnapshot.length > 1 ? (
                  <button
                    type="button"
                    onClick={undoLastOrderChange}
                    disabled={isSavingOrder || loadingPhotos}
                    className="rounded-md border border-line px-3 py-2 text-xs disabled:opacity-50"
                  >
                    Undo last reorder
                  </button>
                ) : null}
                {isAutoSavingHomepageOrder ? (
                  <p className="text-sm text-muted">Saving homepage sequence...</p>
                ) : isSavingOrder ? (
                  <p className="text-sm text-muted">Saving order...</p>
                ) : (
                  <p className="text-sm text-muted">
                    Drag photo thumbnails to reorder on desktop, or use the move buttons on touch devices and compact
                    screens. Order saves automatically.
                  </p>
                )}
              </div>

              {selectedCount > 0 ? (
                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-zinc-300 bg-zinc-50/80 p-2.5">
                  <label className="grid min-w-[190px] gap-1 text-xs">
                    <span className="text-foreground/85">Move selected to</span>
                    <select
                      value={bulkMoveCollection}
                      onChange={(event) => setBulkMoveCollection(event.target.value)}
                      className="border border-line px-2.5 py-2 outline-none focus:border-foreground"
                    >
                      {collectionOptions.map((collection) => (
                        <option key={`bulk-${collection}`} value={collection}>
                          {collection}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={runBulkMoveToCollection}
                    disabled={isBulkRunning}
                    className="rounded-md border border-line px-3 py-2 text-xs disabled:opacity-50"
                  >
                    Move
                  </button>
                  <button
                    type="button"
                    onClick={() => runBulkPatch({ published: false }, "Selected photos moved to draft.")}
                    disabled={isBulkRunning}
                    className="rounded-md border border-line px-3 py-2 text-xs disabled:opacity-50"
                  >
                    Move to draft
                  </button>
                  <button
                    type="button"
                    onClick={runBulkDelete}
                    disabled={isBulkRunning}
                    className="inline-flex items-center gap-1.5 rounded-md border border-red-600 px-3 py-2 text-xs text-red-700 hover:bg-red-600 hover:text-white disabled:opacity-50"
                  >
                    <span className="h-3.5 w-3.5">
                      <TrashIcon />
                    </span>
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPhotoIds([])}
                    className="rounded-md border border-line px-3 py-2 text-xs"
                  >
                    Clear selection
                  </button>
                </div>
              ) : null}

              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm text-muted">Click any photo card to edit in popup.</p>
              </div>
              {loadingPhotos ? (
                <p className="text-sm text-muted">Loading library...</p>
              ) : photos.length === 0 ? (
                <p className="text-sm text-muted">No photos found for current filters.</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {photos.map((photo, photoIndex) => {
                      const draft = drafts[photo.photoId] || toDraft(photo);
                      const isDirty = isDraftDirty(photo, draft);
                      const isSelected = selectedSet.has(photo.photoId);
                      const isActive = activePhotoId === photo.photoId;
                      const isDragging = draggingPhotoId === photo.photoId;
                      const isDropTarget = dragOverPhotoId === photo.photoId;
                      const canMoveBackward = photoIndex > 0 && !isSavingOrder && !isAutoSavingHomepageOrder;
                      const canMoveForward =
                        photoIndex < photos.length - 1 && !isSavingOrder && !isAutoSavingHomepageOrder;

                      return (
                        <article
                          key={photo.photoId}
                          onDragOver={(event) => handleCardDragOver(event, photo.photoId)}
                          onDrop={(event) => handleCardDrop(event, photo.photoId)}
                          onDragEnd={handleCardDragEnd}
                          className={`group overflow-hidden border bg-white text-left transition-all ${
                            isActive
                              ? "border-foreground shadow-[0_10px_24px_rgba(0,0,0,0.09)]"
                            : isDropTarget
                              ? "border-foreground/80 ring-1 ring-foreground/25"
                                : isSelected
                                  ? "border-foreground/50"
                                  : "border-line hover:border-foreground/70"
                          } ${isDragging ? "opacity-70" : ""}`}
                        >
                          <button
                            type="button"
                            onClick={() => requestPhotoSelection(photo.photoId)}
                            className="block w-full text-left"
                          >
                            <div
                              draggable={canManualReorder && supportsDesktopDrag}
                              onDragStart={(event) => {
                                if (!canManualReorder || !supportsDesktopDrag || isSavingOrder) {
                                  return;
                                }
                                event.stopPropagation();
                                handleCardDragStart(event, photo.photoId);
                              }}
                              onDragEnd={handleCardDragEnd}
                              className={`relative aspect-[4/5] w-full bg-zinc-200 ${canManualReorder ? "cursor-grab active:cursor-grabbing" : ""}`}
                            >
                              <div className="pointer-events-none absolute left-1.5 top-1.5 z-10 flex flex-wrap gap-1">
                                <span
                                  className={`rounded px-2 py-0.5 text-[10px] ${
                                    photo.published === false
                                      ? "bg-rose-600/95 text-white"
                                      : "bg-sky-600/95 text-white"
                                  }`}
                                >
                                  {photo.published === false ? "Draft" : "Live"}
                                </span>
                                {photo.featured && photo.featuredOrder === 0 ? (
                                  <span className="rounded bg-amber-500/95 px-2 py-0.5 text-[10px] text-black">
                                    Main
                                  </span>
                                ) : photo.featured ? (
                                  <span className="rounded bg-emerald-600/90 px-2 py-0.5 text-[10px] text-white">
                                    Homepage
                                  </span>
                                ) : null}
                              </div>
                              {isDirty ? (
                                <span className="pointer-events-none absolute right-1.5 top-1.5 z-10 rounded bg-amber-500 px-2 py-0.5 text-[10px] text-black">
                                  Unsaved
                                </span>
                              ) : null}
                            <Image
                              src={photo.thumbnailUrl || photo.imageUrl}
                              alt={photo.alt || photo.title || "Photo thumbnail"}
                              fill
                              draggable={false}
                              sizes="(max-width: 1024px) 33vw, 20vw"
                              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                            />
                            </div>
                            <div className="space-y-1 px-2 py-2">
                              <p className="truncate text-base">{photo.title || "Untitled"}</p>
                              <p className="truncate text-[11px] tracking-[0.12em] text-muted uppercase">
                                {photo.collection}
                              </p>
                            </div>
                          </button>

                          <div className="flex items-center justify-between border-t border-line px-2 py-2">
                            <label className="inline-flex items-center" title="Select photo">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectPhoto(photo.photoId)}
                                aria-label={`Select ${photo.title || "photo"}`}
                                className="h-4 w-4 accent-foreground"
                              />
                            </label>
                            {canManualReorder ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    moveLibraryPhotoByOffset(photo.photoId, -1);
                                  }}
                                  disabled={!canMoveBackward}
                                  aria-label={`Move ${photo.title || "photo"} earlier`}
                                  className="inline-flex min-h-8 items-center gap-1 rounded border border-line px-1.5 py-1 text-[10px] tracking-[0.08em] text-muted/90 uppercase transition-colors hover:border-foreground hover:text-foreground disabled:opacity-35"
                                >
                                  <span className="h-3.5 w-3.5">
                                    <MoveArrowIcon direction="left" />
                                  </span>
                                  Prev
                                </button>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    moveLibraryPhotoByOffset(photo.photoId, 1);
                                  }}
                                  disabled={!canMoveForward}
                                  aria-label={`Move ${photo.title || "photo"} later`}
                                  className="inline-flex min-h-8 items-center gap-1 rounded border border-line px-1.5 py-1 text-[10px] tracking-[0.08em] text-muted/90 uppercase transition-colors hover:border-foreground hover:text-foreground disabled:opacity-35"
                                >
                                  <span className="h-3.5 w-3.5">
                                    <MoveArrowIcon direction="right" />
                                  </span>
                                  Next
                                </button>
                                {supportsDesktopDrag ? (
                                  <button
                                    type="button"
                                    draggable
                                    onDragStart={(event) => {
                                      event.stopPropagation();
                                      handleCardDragStart(event, photo.photoId);
                                    }}
                                    onDragEnd={handleCardDragEnd}
                                    onMouseDown={(event) => event.stopPropagation()}
                                    onClick={(event) => event.preventDefault()}
                                    title="Drag card to reorder"
                                    className="hidden cursor-grab items-center rounded p-1 text-muted/80 hover:bg-zinc-100 active:cursor-grabbing sm:inline-flex"
                                  >
                                    <svg
                                      viewBox="0 0 12 12"
                                      className="h-4 w-4"
                                      fill="currentColor"
                                    >
                                      <circle cx="3" cy="2.5" r="0.9" />
                                      <circle cx="3" cy="6" r="0.9" />
                                      <circle cx="3" cy="9.5" r="0.9" />
                                      <circle cx="9" cy="2.5" r="0.9" />
                                      <circle cx="9" cy="6" r="0.9" />
                                      <circle cx="9" cy="9.5" r="0.9" />
                                    </svg>
                                  </button>
                                ) : null}
                              </div>
                            ) : <span className="h-4 w-4" aria-hidden="true" />}
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  {!isHomepageCollectionFilter ? (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                      <p className="text-xs text-muted">
                        Page {page} of {totalPages}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPage((current) => Math.max(1, current - 1))}
                          disabled={page <= 1}
                          className="border border-line px-3 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground disabled:opacity-40"
                        >
                          Prev
                        </button>
                        <button
                          type="button"
                          onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                          disabled={page >= totalPages}
                          className="border border-line px-3 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </section>

            {isLibraryEditorOpen && activePhoto && activeDraft ? (
              <div
                className="fixed inset-0 z-50 bg-black/60 p-3 backdrop-blur-[2px] sm:p-4"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) {
                    requestLibraryEditorClose();
                  }
                }}
              >
                <div className="mx-auto flex h-full max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-line bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(251,248,243,0.96)_100%)] shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
                  <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">Library photo editor</p>
                      <p className="mt-1 truncate text-base text-foreground/90">
                        {activeDraft.title || activePhoto.title || "Untitled"}
                      </p>
                      <p className="mt-1 h-4 text-xs font-medium text-emerald-700/90">
                        {autoSavingPhotoId === activePhoto.photoId ? "Auto-saving changes..." : " "}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={restoreActivePhotoToOriginal}
                        disabled={
                          !canRestoreOriginal ||
                          autoSavingPhotoId === activePhoto.photoId ||
                          savingPhotoId === activePhoto.photoId ||
                          deletingPhotoId === activePhoto.photoId
                        }
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-foreground/30 text-foreground hover:border-foreground hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-45"
                        aria-label="Revert to original values"
                        title={canRestoreOriginal ? "Back to original values" : "No changes from original values"}
                      >
                        <span className="h-4 w-4">
                          <UndoIcon />
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={requestLibraryEditorClose}
                        className="rounded-md border border-line px-3 py-2 text-xs hover:border-foreground"
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  <div ref={editorPanelRef} className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
                      <aside className="space-y-3">
                        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-md border border-line bg-zinc-200">
                          <Image
                            src={activePhoto.thumbnailUrl || activePhoto.imageUrl}
                            alt={activeDraft.alt || activeDraft.title || "Photo preview"}
                            fill
                            sizes="(max-width: 1024px) 100vw, 320px"
                            className="object-contain"
                          />
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {activePhoto.featured && activePhoto.featuredOrder === 0 ? (
                            <span className="rounded bg-amber-500/90 px-2 py-0.5 text-xs text-black">Main photo</span>
                          ) : activePhoto.featured ? (
                            <span className="rounded bg-emerald-600/90 px-2 py-0.5 text-xs text-white">On homepage</span>
                          ) : (
                            <span className="rounded border border-line px-2 py-0.5 text-xs text-muted">Not on homepage</span>
                          )}
                          <span
                            className={`rounded px-2 py-0.5 text-xs ${
                              activeDraft.published
                                ? "bg-sky-600/95 text-white"
                                : "bg-rose-600/95 text-white"
                            }`}
                          >
                            {activeDraft.published ? "Published" : "Draft"}
                          </span>
                        </div>
                      </aside>

                      <div className="space-y-4">
                        <section className="rounded-md border border-line bg-white p-3">
                          <h3 className="text-base font-semibold">Basic info</h3>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <label>
                              Title
                              <input
                                value={activeDraft.title}
                                onChange={(event) => handleDraftChange(activePhoto.photoId, "title", event.target.value)}
                                className="mt-1.5 w-full border border-line px-3 py-2.5 outline-none focus:border-foreground"
                                disabled={Boolean(savingPhotoId || deletingPhotoId)}
                              />
                            </label>

                            <label>
                              Alt text
                              <input
                                value={activeDraft.alt}
                                onChange={(event) => handleDraftChange(activePhoto.photoId, "alt", event.target.value)}
                                className="mt-1.5 w-full border border-line px-3 py-2.5 outline-none focus:border-foreground"
                                disabled={Boolean(savingPhotoId || deletingPhotoId)}
                              />
                            </label>
                          </div>
                          <label className="mt-3 block">
                            Collection
                            <select
                              value={activeDraft.collection}
                              onChange={(event) => handleDraftChange(activePhoto.photoId, "collection", event.target.value)}
                              className="mt-1.5 w-full border border-line px-3 py-2.5 outline-none focus:border-foreground"
                              disabled={Boolean(savingPhotoId || deletingPhotoId)}
                            >
                              {collectionOptions.map((collection) => (
                                <option key={collection} value={collection}>
                                  {collection}
                                </option>
                              ))}
                            </select>
                          </label>
                        </section>

                        <section className="rounded-md border border-line bg-white p-3">
                          <h3 className="text-base font-semibold">Publishing</h3>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <ToggleSwitch
                              label="On homepage"
                              checked={Boolean(activeDraft.featured)}
                              tone="homepage"
                              onChange={(event) =>
                                handleDraftChange(activePhoto.photoId, "featured", event.target.checked)
                              }
                              disabled={Boolean(savingPhotoId || deletingPhotoId)}
                            />
                            <ToggleSwitch
                              label="Published"
                              checked={Boolean(activeDraft.published)}
                              tone="published"
                              onChange={(event) =>
                                handleDraftChange(activePhoto.photoId, "published", event.target.checked)
                              }
                              disabled={Boolean(savingPhotoId || deletingPhotoId)}
                            />
                          </div>
                          <p className="mt-2 text-sm text-muted">
                            Published photos appear on public pages. Unpublished photos stay private in Drafts.
                          </p>
                        </section>

                        <section className="rounded-md border border-line bg-white p-3">
                          <h3 className="text-base font-semibold">Content</h3>
                          <label className="mt-3 block">
                            Caption
                            <textarea
                              rows={4}
                              value={activeDraft.caption}
                              onChange={(event) => {
                                handleDraftChange(activePhoto.photoId, "caption", event.target.value);
                                resizeTextarea(event.target);
                              }}
                              className="mt-1.5 min-h-[120px] w-full border border-line px-3 py-2.5 outline-none focus:border-foreground"
                              disabled={Boolean(savingPhotoId || deletingPhotoId)}
                            />
                          </label>

                          <div className="mt-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold">Poem</p>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setShowLibraryPoemFormatting((current) => !current)}
                                  className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                                    showLibraryPoemFormatting
                                      ? "border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100"
                                      : "border-line bg-white text-foreground/85 hover:border-violet-300 hover:text-violet-700"
                                  }`}
                                >
                                  {showLibraryPoemFormatting ? "Hide format" : "Format"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShowLibraryPoemPreview((current) => !current)}
                                  className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                                    showLibraryPoemPreview
                                      ? "border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100"
                                      : "border-line bg-white text-foreground/85 hover:border-sky-300 hover:text-sky-700"
                                  }`}
                                >
                                  {showLibraryPoemPreview ? "Hide preview" : "Preview"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openPoemEditor("photo", activePhoto.photoId)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line hover:border-foreground"
                                  aria-label="Expand poem editor"
                                  title="Expand poem editor"
                                >
                                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                                    <path d="M8 4H4v4" />
                                    <path d="M16 4h4v4" />
                                    <path d="M8 20H4v-4" />
                                    <path d="M16 20h4v-4" />
                                    <path d="M4 4l6 6" />
                                    <path d="M20 4l-6 6" />
                                    <path d="M4 20l6-6" />
                                    <path d="M20 20l-6-6" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            {showLibraryPoemFormatting ? (
                              <div className="mt-2">
                                <PoemToolbar onInsert={insertPoemFormatting} />
                              </div>
                            ) : null}
                            <textarea
                              ref={editorPoemRef}
                              rows={6}
                              value={activeDraft.poem}
                              onChange={(event) => {
                                handleDraftChange(activePhoto.photoId, "poem", event.target.value);
                                resizeTextarea(event.target);
                              }}
                              className="mt-1.5 min-h-[160px] w-full border border-line px-3 py-2.5 leading-7 whitespace-pre-wrap outline-none focus:border-foreground"
                              disabled={Boolean(savingPhotoId || deletingPhotoId)}
                            />
                            {showLibraryPoemPreview ? (
                              <PoemLivePreview
                                value={activeDraft.poem}
                                emptyText="Write text and click Preview to render italics/emphasis."
                                className="mt-2"
                              />
                            ) : null}
                          </div>
                        </section>

                        <section className="rounded-md border border-red-200 bg-red-50/60 p-3">
                          <h3 className="text-sm font-semibold text-red-800">Danger zone</h3>
                          <p className="mt-1 text-sm text-red-700">Delete permanently from library and cloud storage.</p>
                          <button
                            type="button"
                            onClick={() => deletePhoto(activePhoto)}
                            disabled={savingPhotoId === activePhoto.photoId || deletingPhotoId === activePhoto.photoId}
                            className="mt-3 rounded-md border border-red-600 px-4 py-2 text-xs text-red-700 hover:bg-red-600 hover:text-white disabled:opacity-50"
                          >
                            {deletingPhotoId === activePhoto.photoId ? "Deleting..." : "Delete photo"}
                          </button>
                        </section>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          </>
          )}
        </section>
      )}

      {isHomepageEditorOpen && homepageActivePhoto && homepageActiveDraft ? (
        <div
          className="fixed inset-0 z-50 bg-black/60 p-3 backdrop-blur-[2px] sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsHomepageEditorOpen(false);
            }
          }}
        >
          <div className="relative mx-auto flex h-full max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-line bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,245,240,0.95)_100%)] shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
            <span className="pointer-events-none absolute -top-5 left-10 h-10 w-10 rounded-full bg-white/95 shadow-[0_8px_16px_rgba(0,0,0,0.12)]" />
            <span className="pointer-events-none absolute -top-8 left-20 h-12 w-12 rounded-full bg-white/95 shadow-[0_8px_16px_rgba(0,0,0,0.12)]" />

            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="text-[10px] tracking-[0.12em] text-muted uppercase">Homepage Photo Editor</p>
                <p className="mt-1 truncate text-base font-semibold sm:text-lg">
                  {homepageActiveDraft.title || homepageActivePhoto.title || "Untitled"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsHomepageEditorOpen(false)}
                className="rounded border border-line px-3 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                <div className="space-y-2">
                  <div className="relative h-52 w-full overflow-hidden rounded border border-line bg-zinc-200 sm:h-64 lg:h-72">
                    <Image
                      src={homepageActivePhoto.thumbnailUrl || homepageActivePhoto.imageUrl}
                      alt={homepageActiveDraft.alt || homepageActiveDraft.title || "Homepage photo preview"}
                      fill
                      sizes="(max-width: 1024px) 100vw, 240px"
                      className="object-cover"
                    />
                  </div>
                  <p className="text-xs text-muted">
                    Position #
                    {Math.max(1, homepagePhotoIds.findIndex((id) => id === homepageActivePhoto.photoId) + 1)}
                  </p>
                  {homepagePhotoIds[0] === homepageActivePhoto.photoId ? (
                    <span className="inline-flex rounded-full bg-amber-500/90 px-2 py-1 text-[10px] tracking-[0.12em] text-black uppercase">
                      Main Photo
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-emerald-600/90 px-2 py-1 text-[10px] tracking-[0.12em] text-white uppercase">
                      On Homepage
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] tracking-[0.12em] uppercase">
                    Title
                    <input
                      value={homepageActiveDraft.title}
                      onChange={(event) =>
                        handleDraftChange(homepageActivePhoto.photoId, "title", event.target.value)
                      }
                      className="mt-1.5 w-full border border-line px-3 py-2 text-sm font-medium normal-case outline-none focus:border-foreground"
                    />
                  </label>

                  <label className="text-[10px] tracking-[0.12em] uppercase">
                    Alt Text
                    <input
                      value={homepageActiveDraft.alt}
                      onChange={(event) =>
                        handleDraftChange(homepageActivePhoto.photoId, "alt", event.target.value)
                      }
                      className="mt-1.5 w-full border border-line px-3 py-2 text-sm normal-case outline-none focus:border-foreground"
                    />
                  </label>

                  <label className="text-[10px] tracking-[0.12em] uppercase">
                    Collection
                    <select
                      value={homepageActiveDraft.collection}
                      onChange={(event) =>
                        handleDraftChange(homepageActivePhoto.photoId, "collection", event.target.value)
                      }
                      className="mt-1.5 w-full border border-line px-3 py-2 text-sm normal-case outline-none focus:border-foreground"
                    >
                      {collectionOptions.map((collection) => (
                        <option key={`homepage-modal-${collection}`} value={collection}>
                          {collection}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid gap-2 rounded border border-line bg-white/70 p-2 sm:grid-cols-2">
                    <label className="flex items-center gap-2 text-[10px] tracking-[0.12em] uppercase">
                      <input
                        type="checkbox"
                        checked
                        onChange={(event) => {
                          if (!event.target.checked) {
                            removePhotoFromHomepage(homepageActivePhoto.photoId);
                            setIsHomepageEditorOpen(false);
                          }
                        }}
                        className="h-4 w-4 accent-foreground"
                      />
                      On Homepage
                    </label>
                    <label className="flex items-center gap-2 text-[10px] tracking-[0.12em] uppercase">
                      <input
                        type="checkbox"
                        checked={Boolean(homepageActiveDraft.published)}
                        onChange={(event) =>
                          handleDraftChange(homepageActivePhoto.photoId, "published", event.target.checked)
                        }
                        className="h-4 w-4 accent-foreground"
                      />
                      Published
                    </label>
                  </div>

                  <label className="text-[10px] tracking-[0.12em] uppercase">
                    Caption
                    <textarea
                      rows={4}
                      value={homepageActiveDraft.caption}
                      onChange={(event) => {
                        handleDraftChange(homepageActivePhoto.photoId, "caption", event.target.value);
                        resizeTextarea(event.target);
                      }}
                      className="mt-1.5 min-h-[120px] w-full border border-line px-3 py-2 text-sm normal-case outline-none focus:border-foreground"
                    />
                  </label>

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] tracking-[0.12em] uppercase">Poem</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowHomepagePoemPreview((current) => !current)}
                          className={`border px-2 py-1 text-[10px] tracking-[0.12em] uppercase transition-colors ${
                            showHomepagePoemPreview
                              ? "border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100"
                              : "border-line bg-white text-foreground/85 hover:border-sky-300 hover:text-sky-700"
                          }`}
                        >
                          {showHomepagePoemPreview ? "Hide Preview" : "Preview"}
                        </button>
                        <button
                          type="button"
                          onClick={() => openPoemEditor("photo", homepageActivePhoto.photoId)}
                          className="border border-line px-2 py-1 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
                        >
                          Expand Editor
                        </button>
                      </div>
                    </div>
                    <PoemToolbar onInsert={insertHomepagePoemFormatting} />
                    <textarea
                      ref={editorPoemRef}
                      rows={7}
                      value={homepageActiveDraft.poem}
                      onChange={(event) => {
                        handleDraftChange(homepageActivePhoto.photoId, "poem", event.target.value);
                        resizeTextarea(event.target);
                      }}
                      className="mt-1.5 min-h-[170px] w-full border border-line px-3 py-2 text-sm leading-6 whitespace-pre-wrap normal-case outline-none focus:border-foreground"
                    />
                    {showHomepagePoemPreview ? (
                      <PoemLivePreview
                        value={homepageActiveDraft.poem}
                        emptyText="Write text and click Preview to render italics/emphasis."
                        className="mt-2"
                      />
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => savePhoto(homepageActivePhoto.photoId)}
                      disabled={
                        savingPhotoId === homepageActivePhoto.photoId ||
                        deletingPhotoId === homepageActivePhoto.photoId
                      }
                      className="border border-foreground bg-foreground px-4 py-2 text-[10px] tracking-[0.14em] text-background uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {savingPhotoId === homepageActivePhoto.photoId ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDrafts((current) => ({
                          ...current,
                          [homepageActivePhoto.photoId]: toDraft(homepageActivePhoto),
                        }))
                      }
                      className="border border-line px-4 py-2 text-[10px] tracking-[0.14em] uppercase transition-colors hover:border-foreground"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        removePhotoFromHomepage(homepageActivePhoto.photoId);
                        setIsHomepageEditorOpen(false);
                      }}
                      className="border border-line px-4 py-2 text-[10px] tracking-[0.14em] uppercase transition-colors hover:border-foreground"
                    >
                      Remove From Homepage
                    </button>
                    {homepageActiveIsDirty ? (
                      <p className="self-center text-xs text-amber-700">Unsaved changes</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {reorderConfirmPrompt.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[1px]">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirm reorder change"
            className="w-full max-w-md rounded-xl border border-line bg-white p-5 shadow-[0_18px_54px_rgba(0,0,0,0.25)]"
          >
            <h3 className="text-base font-semibold">Apply new order?</h3>
            <p className="mt-3 text-sm leading-6 text-foreground/80">
              You are viewing <strong>{reorderConfirmPrompt.sortLabel}</strong>. Reordering now will save a new manual order for this view.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={cancelReorderConfirm}
                className="rounded-md border border-line px-3 py-2 text-xs hover:border-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmReorderChange}
                disabled={isSavingOrder}
                className="rounded-md border border-foreground bg-foreground px-3 py-2 text-xs text-background disabled:opacity-50"
              >
                {isSavingOrder ? "Applying..." : "Apply reorder"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {workspaceSwitchPrompt.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]">
          <div className="relative w-full max-w-lg">
            <span className="pointer-events-none absolute -top-7 left-10 h-14 w-14 rounded-full bg-white/95 shadow-[0_8px_18px_rgba(0,0,0,0.15)]" />
            <span className="pointer-events-none absolute -top-10 left-24 h-16 w-16 rounded-full bg-white/95 shadow-[0_8px_18px_rgba(0,0,0,0.15)]" />
            <span className="pointer-events-none absolute -top-6 left-40 h-12 w-12 rounded-full bg-white/95 shadow-[0_8px_18px_rgba(0,0,0,0.15)]" />

            <div
              role="dialog"
              aria-modal="true"
              aria-label="Unsaved changes before switching tab"
              className="rounded-3xl border border-line bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(248,245,240,0.94)_100%)] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]"
            >
              <p className="text-[10px] tracking-[0.16em] text-muted uppercase">Thought Bubble</p>
              <h3 className="mt-2 text-xl">Save before switching views?</h3>
              <p className="mt-3 text-sm leading-6 text-foreground/80">
                You have unsaved changes. Do you want to save first, or continue without saving?
              </p>

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={cancelWorkspaceSwitch}
                  className="rounded-full border border-line px-4 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
                >
                  Keep Editing
                </button>
                <button
                  type="button"
                  onClick={discardPendingChangesAndSwitchTab}
                  className="rounded-full border border-line px-4 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
                >
                  Continue Without Saving
                </button>
                <button
                  type="button"
                  onClick={savePendingChangesAndSwitchTab}
                  disabled={isSavingBeforeWorkspaceSwitch}
                  className="rounded-full border border-foreground bg-foreground px-4 py-2 text-[10px] tracking-[0.12em] text-background uppercase transition-opacity hover:opacity-90 disabled:opacity-45"
                >
                  {isSavingBeforeWorkspaceSwitch ? "Saving..." : "Save & Continue"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {libraryExitPrompt.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[1px]">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Unsaved photo edits before closing modal"
            className="w-full max-w-md rounded-xl border border-line bg-white p-5 shadow-[0_18px_54px_rgba(0,0,0,0.25)]"
          >
            <h3 className="text-sm tracking-[0.14em] uppercase">Unsaved Edits</h3>
            <p className="mt-3 text-sm leading-6 text-foreground/80">
              You have unsaved edits on this photo. Save before closing the editor?
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={cancelLibraryExitPrompt}
                className="border border-line px-3 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={discardAndCloseLibraryEditor}
                className="border border-line px-3 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
              >
                Exit Without Saving
              </button>
              <button
                type="button"
                onClick={saveAndCloseLibraryEditor}
                disabled={Boolean(savingPhotoId)}
                className="border border-foreground bg-foreground px-3 py-2 text-[10px] tracking-[0.12em] text-background uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {savingPhotoId ? "Saving..." : "Save & Exit"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {switchPrompt.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[1px]">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Unsaved changes confirmation"
            className="w-full max-w-md rounded-xl border border-line bg-white p-5 shadow-[0_18px_54px_rgba(0,0,0,0.25)]"
          >
            <h3 className="text-sm tracking-[0.14em] uppercase">Unsaved Changes</h3>
            <p className="mt-3 text-sm leading-6 text-foreground/80">
              You have unsaved edits on this photo. Save before switching to another photo?
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={cancelPhotoSwitch}
                className="border border-line px-3 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={discardAndSwitch}
                className="border border-line px-3 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={saveAndSwitch}
                disabled={Boolean(savingPhotoId)}
                className="border border-foreground bg-foreground px-3 py-2 text-[10px] tracking-[0.12em] text-background uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {savingPhotoId ? "Saving..." : "Save & Switch"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {poemModal.open ? (
        <div
          className="fixed inset-0 z-50 bg-black/75 p-3 backdrop-blur-[2px] sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closePoemEditor();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Expanded poem editor"
            className="mx-auto flex h-full max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-line bg-white shadow-[0_24px_72px_rgba(0,0,0,0.32)]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
              <div>
                <h3 className="text-sm tracking-[0.14em] uppercase">Expanded Poem Editor</h3>
                <p className="mt-1 text-xs text-muted">
                  {poemModal.mode === "upload"
                    ? "Editing upload template poem."
                    : `Editing: ${drafts[poemModal.photoId]?.title || "Untitled"}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowModalPoemPreview((current) => !current)}
                  className={`rounded border px-3 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors ${
                    showModalPoemPreview
                      ? "border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100"
                      : "border-line bg-white text-foreground/85 hover:border-sky-300 hover:text-sky-700"
                  }`}
                >
                  {showModalPoemPreview ? "Hide Preview" : "Preview"}
                </button>
                <button
                  type="button"
                  onClick={closePoemEditor}
                  className="rounded border border-line px-3 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              <PoemToolbar onInsert={insertPoemFormatting} />

              <textarea
                ref={modalPoemRef}
                value={modalPoemValue}
                onChange={(event) => {
                  updatePoemValue(poemModal.mode, poemModal.photoId, event.target.value);
                  resizeTextarea(event.target);
                }}
                rows={16}
                className="min-h-[300px] w-full border border-line px-3 py-3 text-sm leading-7 whitespace-pre-wrap normal-case outline-none focus:border-foreground"
              />

              {showModalPoemPreview ? (
                <PoemLivePreview
                  value={modalPoemValue}
                  emptyText="Write text and click Preview to render italics/emphasis."
                  className="mt-4"
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
