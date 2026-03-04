import { randomUUID } from "node:crypto";
import { samplePhotos } from "@/lib/samplePhotos";

const STORE_KEY = "__portfolio_photo_store__";
const DEFAULT_COLLECTION = "City Life";

function sanitizeText(value, fallback = "", maxLength = 400) {
  if (typeof value !== "string") {
    return fallback;
  }

  const clean = value.trim();
  if (!clean) {
    return fallback;
  }

  return clean.slice(0, maxLength);
}

function sanitizeCollection(value) {
  return sanitizeText(value, DEFAULT_COLLECTION, 80);
}

function isValidUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function buildSeedPhoto(photo, index) {
  const createdAt = new Date(Date.now() - index * 3600_000).toISOString();

  return {
    photoId: photo.photoId,
    imageUrl: photo.imageUrl,
    thumbnailUrl: photo.imageUrl,
    publicId: "",
    title: sanitizeText(photo.title, "Untitled", 140),
    caption: sanitizeText(photo.caption, "", 600),
    poem: sanitizeText(photo.poem, "", 600),
    collection: sanitizeCollection(photo.collection),
    createdAt,
    updatedAt: createdAt,
  };
}

function getSeedData() {
  return samplePhotos.map((photo, index) => buildSeedPhoto(photo, index));
}

function getStore() {
  if (!globalThis[STORE_KEY]) {
    globalThis[STORE_KEY] = getSeedData();
  }

  return globalThis[STORE_KEY];
}

function replaceStore(nextStore) {
  globalThis[STORE_KEY] = nextStore;
  return globalThis[STORE_KEY];
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

export function getCollections() {
  return [...new Set(getStore().map((photo) => photo.collection))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export function listPhotos({
  collection = "All",
  q = "",
  limit = 60,
  offset = 0,
  sort = "newest",
} = {}) {
  const query = sanitizeText(q, "", 120).toLowerCase();
  const selectedCollection = sanitizeText(collection, "All", 80);
  let photos = [...getStore()];

  if (selectedCollection !== "All") {
    photos = photos.filter((photo) => photo.collection === selectedCollection);
  }

  if (query) {
    photos = photos.filter((photo) => {
      const haystack = `${photo.title} ${photo.caption} ${photo.poem}`.toLowerCase();
      return haystack.includes(query);
    });
  }

  photos.sort((a, b) => {
    if (sort === "oldest") {
      return a.createdAt.localeCompare(b.createdAt);
    }

    return b.createdAt.localeCompare(a.createdAt);
  });

  const safeOffset = Math.max(0, toNumber(offset, 0));
  const safeLimit = Math.min(300, Math.max(1, toNumber(limit, 60)));
  const total = photos.length;
  const items = photos.slice(safeOffset, safeOffset + safeLimit);

  return {
    photos: items,
    total,
    limit: safeLimit,
    offset: safeOffset,
  };
}

export function getPhotoById(photoId) {
  return getStore().find((photo) => photo.photoId === photoId) || null;
}

export function createPhoto(input) {
  if (!input || typeof input !== "object") {
    return { error: "Request body is required." };
  }

  const imageUrl = sanitizeText(input.imageUrl, "", 1200);
  if (!imageUrl || !isValidUrl(imageUrl)) {
    return { error: "A valid imageUrl is required." };
  }

  const now = new Date().toISOString();
  const photo = {
    photoId: sanitizeText(input.photoId, "", 120) || `photo-${randomUUID()}`,
    imageUrl,
    thumbnailUrl: sanitizeText(input.thumbnailUrl, "", 1200) || imageUrl,
    publicId: sanitizeText(input.publicId, "", 180),
    title: sanitizeText(input.title, "Untitled", 140),
    caption: sanitizeText(input.caption, "", 600),
    poem: sanitizeText(input.poem, "", 600),
    collection: sanitizeCollection(input.collection),
    createdAt: now,
    updatedAt: now,
  };

  const store = getStore();
  store.unshift(photo);
  return { photo };
}

export function updatePhotoById(photoId, updates) {
  if (!photoId) {
    return { error: "photoId is required." };
  }

  if (!updates || typeof updates !== "object") {
    return { error: "Updates are required." };
  }

  const store = getStore();
  const index = store.findIndex((photo) => photo.photoId === photoId);
  if (index === -1) {
    return { error: "Photo not found.", status: 404 };
  }

  const next = { ...store[index] };

  if (updates.imageUrl !== undefined) {
    const imageUrl = sanitizeText(updates.imageUrl, "", 1200);
    if (!imageUrl || !isValidUrl(imageUrl)) {
      return { error: "imageUrl must be a valid URL." };
    }
    next.imageUrl = imageUrl;
  }

  if (updates.thumbnailUrl !== undefined) {
    const thumbnailUrl = sanitizeText(updates.thumbnailUrl, "", 1200);
    if (!thumbnailUrl || !isValidUrl(thumbnailUrl)) {
      return { error: "thumbnailUrl must be a valid URL." };
    }
    next.thumbnailUrl = thumbnailUrl;
  }

  if (updates.publicId !== undefined) {
    next.publicId = sanitizeText(updates.publicId, "", 180);
  }

  if (updates.title !== undefined) {
    next.title = sanitizeText(updates.title, "Untitled", 140);
  }

  if (updates.caption !== undefined) {
    next.caption = sanitizeText(updates.caption, "", 600);
  }

  if (updates.poem !== undefined) {
    next.poem = sanitizeText(updates.poem, "", 600);
  }

  if (updates.collection !== undefined) {
    next.collection = sanitizeCollection(updates.collection);
  }

  next.updatedAt = new Date().toISOString();
  store[index] = next;

  return { photo: next };
}

export function deletePhotoById(photoId) {
  const store = getStore();
  const existing = store.find((photo) => photo.photoId === photoId);

  if (!existing) {
    return { error: "Photo not found.", status: 404 };
  }

  replaceStore(store.filter((photo) => photo.photoId !== photoId));
  return { photo: existing };
}

export function reorderPhotos(photoIds) {
  if (!Array.isArray(photoIds) || photoIds.length === 0) {
    return { error: "photoIds must be a non-empty array." };
  }

  const store = getStore();
  const rankedIds = photoIds
    .map((id) => sanitizeText(id, "", 120))
    .filter(Boolean);
  const rankMap = new Map(rankedIds.map((id, index) => [id, index]));

  const reordered = [...store].sort((a, b) => {
    const aRank = rankMap.has(a.photoId) ? rankMap.get(a.photoId) : Number.MAX_SAFE_INTEGER;
    const bRank = rankMap.has(b.photoId) ? rankMap.get(b.photoId) : Number.MAX_SAFE_INTEGER;
    return aRank - bRank;
  });

  replaceStore(reordered);
  return { photos: reordered };
}
