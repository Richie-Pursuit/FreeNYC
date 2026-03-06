import { randomUUID } from "node:crypto";
import { getMongoDatabase } from "@/lib/mongodb";
import { samplePhotos } from "@/lib/samplePhotos";

const PHOTO_COLLECTION = "photos";
const DEFAULT_COLLECTION = "City Life";
const READY_PROMISE_KEY = "__portfolio_photo_store_ready__";

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

function sanitizeOptionalCollection(value) {
  return sanitizeText(value, "", 80);
}

function sanitizeAltText(value, fallback = "") {
  return sanitizeText(value, fallback, 220);
}

function sanitizePhotoId(value) {
  return sanitizeText(value, "", 120);
}

function sanitizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }

  return fallback;
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

function sanitizeNonNegativeInteger(value, fallback = null) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function isValidUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSort(value) {
  if (value === "oldest" || value === "manual" || value === "curated") {
    return value;
  }

  return "newest";
}

function toPhoto(doc) {
  if (!doc) {
    return null;
  }

  return {
    photoId: doc.photoId,
    imageUrl: doc.imageUrl,
    thumbnailUrl: doc.thumbnailUrl || doc.imageUrl,
    publicId: doc.publicId || "",
    title: doc.title || "Untitled",
    alt: doc.alt || doc.title || "Street photograph",
    caption: doc.caption || "",
    poem: doc.poem || "",
    collection: doc.collection || DEFAULT_COLLECTION,
    featured: Boolean(doc.featured),
    featuredOrder: typeof doc.featuredOrder === "number" ? doc.featuredOrder : null,
    published: doc.published !== false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    order: typeof doc.order === "number" ? doc.order : 0,
  };
}

function buildSeedPhotoDoc(photo, index) {
  const createdAt = new Date(Date.now() - index * 3600_000).toISOString();

  return {
    photoId: sanitizePhotoId(photo.photoId) || `seed-${randomUUID()}`,
    imageUrl: photo.imageUrl,
    thumbnailUrl: photo.imageUrl,
    publicId: "",
    title: sanitizeText(photo.title, "Untitled", 140),
    alt: sanitizeAltText(photo.alt, sanitizeText(photo.title, "Street photograph", 220)),
    caption: sanitizeText(photo.caption, "", 600),
    poem: sanitizeText(photo.poem, "", 600),
    collection: sanitizeCollection(photo.collection),
    featured: sanitizeBoolean(photo.featured, false),
    featuredOrder: sanitizeBoolean(photo.featured, false) ? index : null,
    published: sanitizeBoolean(photo.published, true),
    createdAt,
    updatedAt: createdAt,
    order: index,
  };
}

async function getPhotoCollection() {
  const db = await getMongoDatabase();
  return db.collection(PHOTO_COLLECTION);
}

async function ensurePhotoStoreReady() {
  if (!globalThis[READY_PROMISE_KEY]) {
    globalThis[READY_PROMISE_KEY] = (async () => {
      const collection = await getPhotoCollection();

      await collection.createIndex({ photoId: 1 }, { unique: true, name: "photoId_unique" });
      await collection.createIndex({ createdAt: -1 }, { name: "createdAt_desc" });
      await collection.createIndex({ order: 1 }, { name: "order_asc" });
      await collection.createIndex({ collection: 1, createdAt: -1 }, { name: "collection_createdAt" });
      await collection.createIndex({ featured: -1, order: 1 }, { name: "featured_order" });
      await collection.createIndex({ featured: -1, featuredOrder: 1 }, { name: "featured_featuredOrder" });
      await collection.createIndex({ published: 1, order: 1 }, { name: "published_order" });

      const seedOperations = samplePhotos.map((photo, index) => {
        const seedDoc = buildSeedPhotoDoc(photo, index);

        return {
          updateOne: {
            filter: { photoId: seedDoc.photoId },
            update: { $setOnInsert: seedDoc },
            upsert: true,
          },
        };
      });

      if (seedOperations.length > 0) {
        await collection.bulkWrite(seedOperations, { ordered: false });
      }
    })().catch((error) => {
      globalThis[READY_PROMISE_KEY] = null;
      throw error;
    });
  }

  try {
    await globalThis[READY_PROMISE_KEY];
  } catch (error) {
    globalThis[READY_PROMISE_KEY] = null;
    throw error;
  }
}

async function getNextOrder(collection) {
  const latest = await collection.find({}, { projection: { order: 1 } }).sort({ order: -1 }).limit(1).next();

  if (!latest || typeof latest.order !== "number") {
    return 0;
  }

  return latest.order + 1;
}

async function getNextFeaturedOrder(collection) {
  const latest = await collection
    .find({ featured: true }, { projection: { featuredOrder: 1 } })
    .sort({ featuredOrder: -1 })
    .limit(1)
    .next();

  if (!latest || typeof latest.featuredOrder !== "number") {
    return 0;
  }

  return latest.featuredOrder + 1;
}

export async function getCollections({ includeDrafts = false } = {}) {
  await ensurePhotoStoreReady();
  const collection = await getPhotoCollection();
  const filter = {
    collection: { $exists: true, $ne: "" },
  };
  if (!includeDrafts) {
    filter.$or = [{ published: true }, { published: { $exists: false } }];
  }

  const values = await collection.distinct("collection", filter);

  return values.sort((a, b) => a.localeCompare(b));
}

export async function listPhotos({
  collection = "All",
  q = "",
  limit = 60,
  offset = 0,
  sort = "newest",
  includeDrafts = false,
  publishedStatus = "all",
} = {}) {
  await ensurePhotoStoreReady();
  const photos = await getPhotoCollection();

  const queryText = sanitizeText(q, "", 120);
  const selectedCollection = sanitizeText(collection, "All", 80);
  const safeOffset = Math.max(0, toNumber(offset, 0));
  const safeLimit = Math.min(300, Math.max(1, toNumber(limit, 60)));
  const normalizedSort = normalizeSort(sort);
  const normalizedPublishedStatus =
    publishedStatus === "published" || publishedStatus === "draft"
      ? publishedStatus
      : "all";

  const filterClauses = [];
  if (!includeDrafts) {
    filterClauses.push({
      $or: [{ published: true }, { published: { $exists: false } }],
    });
  } else if (normalizedPublishedStatus === "published") {
    filterClauses.push({
      $or: [{ published: true }, { published: { $exists: false } }],
    });
  } else if (normalizedPublishedStatus === "draft") {
    filterClauses.push({ published: false });
  }

  if (selectedCollection !== "All") {
    filterClauses.push({ collection: selectedCollection });
  }

  if (queryText) {
    const regex = new RegExp(escapeRegex(queryText), "i");
    filterClauses.push({
      $or: [{ title: regex }, { caption: regex }, { poem: regex }],
    });
  }

  const filter =
    filterClauses.length === 0
      ? {}
      : filterClauses.length === 1
        ? filterClauses[0]
        : { $and: filterClauses };

  const sortSpec =
    normalizedSort === "oldest"
      ? { createdAt: 1 }
      : normalizedSort === "manual"
        ? { order: 1, createdAt: -1 }
      : normalizedSort === "curated"
          ? { featured: -1, featuredOrder: 1, order: 1, createdAt: -1 }
        : { createdAt: -1 };

  const [items, total] = await Promise.all([
    photos.find(filter).sort(sortSpec).skip(safeOffset).limit(safeLimit).toArray(),
    photos.countDocuments(filter),
  ]);

  return {
    photos: items.map(toPhoto),
    total,
    limit: safeLimit,
    offset: safeOffset,
  };
}

export async function getPhotoById(photoId) {
  const safePhotoId = sanitizePhotoId(photoId);
  if (!safePhotoId) {
    return null;
  }

  await ensurePhotoStoreReady();
  const collection = await getPhotoCollection();
  const photo = await collection.findOne({ photoId: safePhotoId });

  return toPhoto(photo);
}

export async function createPhoto(input) {
  if (!input || typeof input !== "object") {
    return { error: "Request body is required." };
  }

  const imageUrl = sanitizeText(input.imageUrl, "", 1200);
  if (!imageUrl || !isValidUrl(imageUrl)) {
    return { error: "A valid imageUrl is required." };
  }

  await ensurePhotoStoreReady();
  const collection = await getPhotoCollection();

  const now = new Date().toISOString();
  const nextOrder = await getNextOrder(collection);
  const photo = {
    photoId: sanitizePhotoId(input.photoId) || `photo-${randomUUID()}`,
    imageUrl,
    thumbnailUrl: sanitizeText(input.thumbnailUrl, "", 1200) || imageUrl,
    publicId: sanitizeText(input.publicId, "", 180),
    title: sanitizeText(input.title, "Untitled", 140),
    alt: sanitizeAltText(input.alt, sanitizeText(input.title, "Street photograph", 220)),
    caption: sanitizeText(input.caption, "", 600),
    poem: sanitizeText(input.poem, "", 600),
    collection: sanitizeCollection(input.collection),
    featured: sanitizeBoolean(input.featured, false),
    featuredOrder: null,
    published: sanitizeBoolean(input.published, true),
    createdAt: now,
    updatedAt: now,
    order: nextOrder,
  };

  if (photo.featured) {
    photo.featuredOrder = await getNextFeaturedOrder(collection);
  }

  try {
    await collection.insertOne(photo);
  } catch (error) {
    if (error?.code === 11000) {
      return { error: "photoId already exists." };
    }

    throw error;
  }

  return { photo: toPhoto(photo) };
}

export async function updatePhotoById(photoId, updates) {
  const safePhotoId = sanitizePhotoId(photoId);
  if (!safePhotoId) {
    return { error: "photoId is required." };
  }

  if (!updates || typeof updates !== "object") {
    return { error: "Updates are required." };
  }

  await ensurePhotoStoreReady();
  const collection = await getPhotoCollection();
  const existing = await collection.findOne({ photoId: safePhotoId });
  if (!existing) {
    return { error: "Photo not found.", status: 404 };
  }

  const patch = {};

  if (updates.imageUrl !== undefined) {
    const imageUrl = sanitizeText(updates.imageUrl, "", 1200);
    if (!imageUrl || !isValidUrl(imageUrl)) {
      return { error: "imageUrl must be a valid URL." };
    }
    patch.imageUrl = imageUrl;
  }

  if (updates.thumbnailUrl !== undefined) {
    const thumbnailUrl = sanitizeText(updates.thumbnailUrl, "", 1200);
    if (!thumbnailUrl || !isValidUrl(thumbnailUrl)) {
      return { error: "thumbnailUrl must be a valid URL." };
    }
    patch.thumbnailUrl = thumbnailUrl;
  }

  if (updates.publicId !== undefined) {
    patch.publicId = sanitizeText(updates.publicId, "", 180);
  }

  if (updates.title !== undefined) {
    patch.title = sanitizeText(updates.title, "Untitled", 140);
  }

  if (updates.alt !== undefined) {
    patch.alt = sanitizeAltText(
      updates.alt,
      updates.title !== undefined ? sanitizeText(updates.title, "Street photograph", 220) : "",
    );
  }

  if (updates.caption !== undefined) {
    patch.caption = sanitizeText(updates.caption, "", 600);
  }

  if (updates.poem !== undefined) {
    patch.poem = sanitizeText(updates.poem, "", 600);
  }

  if (updates.collection !== undefined) {
    patch.collection = sanitizeCollection(updates.collection);
  }

  if (updates.featured !== undefined) {
    const nextFeatured = sanitizeBoolean(updates.featured, false);
    patch.featured = nextFeatured;
    if (!nextFeatured) {
      patch.featuredOrder = null;
    } else if (!existing.featured && updates.featuredOrder === undefined) {
      patch.featuredOrder = await getNextFeaturedOrder(collection);
    }
  }

  if (updates.featuredOrder !== undefined) {
    const safeFeaturedOrder = sanitizeNonNegativeInteger(updates.featuredOrder, null);
    if (safeFeaturedOrder === null) {
      return { error: "featuredOrder must be a non-negative integer." };
    }
    patch.featuredOrder = safeFeaturedOrder;
    patch.featured = patch.featured !== false;
  }

  if (updates.published !== undefined) {
    const nextPublished = sanitizeBoolean(updates.published, true);
    patch.published = nextPublished;
    if (!nextPublished) {
      patch.featured = false;
      patch.featuredOrder = null;
    }
  }

  if (Object.keys(patch).length === 0) {
    return { photo: toPhoto(existing) };
  }

  patch.updatedAt = new Date().toISOString();

  const updateResult = await collection.updateOne(
    { photoId: safePhotoId },
    { $set: patch },
  );

  if (!updateResult.matchedCount) {
    return { error: "Photo not found.", status: 404 };
  }

  const photo = await collection.findOne({ photoId: safePhotoId });
  return { photo: toPhoto(photo) };
}

export async function deletePhotoById(photoId) {
  const safePhotoId = sanitizePhotoId(photoId);
  if (!safePhotoId) {
    return { error: "photoId is required." };
  }

  await ensurePhotoStoreReady();
  const collection = await getPhotoCollection();
  const existing = await collection.findOne({ photoId: safePhotoId });

  if (!existing) {
    return { error: "Photo not found.", status: 404 };
  }

  await collection.deleteOne({ photoId: safePhotoId });
  return { photo: toPhoto(existing) };
}

export async function reorderPhotos(photoIds) {
  if (!Array.isArray(photoIds) || photoIds.length === 0) {
    return { error: "photoIds must be a non-empty array." };
  }

  await ensurePhotoStoreReady();
  const collection = await getPhotoCollection();
  const current = await collection
    .find({}, { projection: { photoId: 1, order: 1, createdAt: 1 } })
    .sort({ order: 1, createdAt: -1 })
    .toArray();

  const existingIds = current.map((doc) => doc.photoId);
  const existingSet = new Set(existingIds);

  const requested = [];
  const requestedSet = new Set();

  for (const id of photoIds) {
    const safeId = sanitizePhotoId(id);
    if (!safeId || requestedSet.has(safeId) || !existingSet.has(safeId)) {
      continue;
    }

    requested.push(safeId);
    requestedSet.add(safeId);
  }

  if (requested.length === 0) {
    return { error: "None of the provided photoIds were found." };
  }

  const leftovers = existingIds.filter((id) => !requestedSet.has(id));
  const finalOrder = [...requested, ...leftovers];
  const now = new Date().toISOString();

  await collection.bulkWrite(
    finalOrder.map((id, index) => ({
      updateOne: {
        filter: { photoId: id },
        update: {
          $set: {
            order: index,
            updatedAt: now,
          },
        },
      },
    })),
    { ordered: true },
  );

  const updated = await collection.find({}).sort({ order: 1, createdAt: -1 }).toArray();
  return { photos: updated.map(toPhoto) };
}

export async function setFeaturedPhotoOrder(photoIds, { maxItems = 100 } = {}) {
  if (!Array.isArray(photoIds)) {
    return { error: "photoIds must be an array." };
  }

  const requested = [];
  const requestedSet = new Set();
  for (const id of photoIds) {
    const safeId = sanitizePhotoId(id);
    if (!safeId || requestedSet.has(safeId)) {
      continue;
    }
    requested.push(safeId);
    requestedSet.add(safeId);
  }

  if (requested.length > maxItems) {
    return { error: `Homepage selection supports up to ${maxItems} photos.` };
  }

  await ensurePhotoStoreReady();
  const collection = await getPhotoCollection();

  if (requested.length > 0) {
    const matched = await collection
      .find(
        { photoId: { $in: requested } },
        { projection: { photoId: 1, published: 1 } },
      )
      .toArray();

    if (matched.length !== requested.length) {
      return { error: "Some selected photos were not found." };
    }

    const unpublished = matched.find((doc) => doc.published === false);
    if (unpublished) {
      return { error: "Only published photos can be added to homepage." };
    }
  }

  const now = new Date().toISOString();
  await collection.updateMany(
    { featured: true },
    {
      $set: {
        featured: false,
        featuredOrder: null,
        updatedAt: now,
      },
    },
  );

  if (requested.length > 0) {
    await collection.bulkWrite(
      requested.map((photoId, index) => ({
        updateOne: {
          filter: { photoId },
          update: {
            $set: {
              featured: true,
              featuredOrder: index,
              updatedAt: now,
            },
          },
        },
      })),
      { ordered: true },
    );
  }

  const featuredPhotos = await collection
    .find({ featured: true, published: { $ne: false } })
    .sort({ featuredOrder: 1, order: 1, createdAt: -1 })
    .toArray();

  return {
    photoIds: featuredPhotos.map((photo) => photo.photoId),
    photos: featuredPhotos.map(toPhoto),
  };
}

export async function renameCollection(fromCollection, toCollection) {
  const from = sanitizeOptionalCollection(fromCollection);
  const to = sanitizeOptionalCollection(toCollection);

  if (!from || !to) {
    return { error: "Both fromCollection and toCollection are required." };
  }

  if (from === to) {
    return { modifiedCount: 0 };
  }

  await ensurePhotoStoreReady();
  const collection = await getPhotoCollection();
  const now = new Date().toISOString();
  const result = await collection.updateMany(
    { collection: from },
    {
      $set: {
        collection: to,
        updatedAt: now,
      },
    },
  );

  return { modifiedCount: result.modifiedCount };
}

export async function moveCollection(fromCollection, toCollection) {
  return renameCollection(fromCollection, toCollection);
}
