import { getMongoDatabase, isMongoConfigured } from "@/lib/mongodb";
import { siteBrand } from "@/lib/siteBrand";

const PAGE_CONTENT_COLLECTION = "page_content";
const READY_PROMISE_KEY = "__portfolio_page_content_store_ready__";
const ABOUT_SLUG = "about";

const DEFAULT_ABOUT_SECTIONS = Object.freeze({
  hero: {
    imageUrl: "https://picsum.photos/id/1005/1400/1750",
    publicId: "",
    alt: "Portrait of the street photographer",
  },
  header: {
    introLabel: "About the Artist",
    headline: siteBrand.aboutHeadline,
    supportingLine: siteBrand.aboutSupportingLine,
  },
  body: {
    paragraphs: [
      "I photograph unrepeatable seconds in crowded places without staging or interruption. Light, timing, and distance do the storytelling.",
      "Most frames are made in transit: subway platforms, corner stores, crosswalk pauses, and late avenues where the city moves faster than memory.",
    ],
  },
  quote: {
    text: "Street photography is the art of noticing what disappears in a second.",
    attribution: "",
  },
  contact: {
    instagramLabel: "Instagram",
    instagramHandle: "@freenyc",
    instagramUrl: "https://instagram.com/freenyc",
    emailLabel: "Email",
    email: "richiecarrasco@pursuit.org",
  },
});

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_ABOUT_SECTIONS));
}

function sanitizeText(value, fallback = "", maxLength = 2000) {
  if (typeof value !== "string") {
    return fallback;
  }

  const cleaned = value.trim();
  if (!cleaned) {
    return fallback;
  }

  return cleaned.slice(0, maxLength);
}

function sanitizeOptionalText(value, maxLength = 2000) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, maxLength);
}

function sanitizeUrl(value, fallback = "") {
  const candidate = sanitizeOptionalText(value, 1000);
  if (!candidate) {
    return fallback;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return fallback;
    }
    return parsed.toString();
  } catch {
    return fallback;
  }
}

function sanitizeEmail(value, fallback = "") {
  const candidate = sanitizeOptionalText(value, 220);
  if (!candidate) {
    return fallback;
  }
  if (!candidate.includes("@") || candidate.startsWith("@") || candidate.endsWith("@")) {
    return fallback;
  }
  return candidate;
}

function sanitizeParagraphs(values, fallbackParagraphs) {
  if (!Array.isArray(values)) {
    return [...fallbackParagraphs];
  }

  const paragraphs = values
    .map((value) => sanitizeOptionalText(value, 3200))
    .filter(Boolean)
    .slice(0, 12);

  if (paragraphs.length === 0) {
    return [...fallbackParagraphs];
  }

  return paragraphs;
}

function normalizeAboutSections(input = {}) {
  const defaults = cloneDefaults();
  const hero = input?.hero || {};
  const header = input?.header || {};
  const body = input?.body || {};
  const quote = input?.quote || {};
  const contact = input?.contact || {};

  const instagramHandle = sanitizeOptionalText(
    contact.instagramHandle,
    140,
  ) || defaults.contact.instagramHandle;
  const normalizedHandle = instagramHandle.startsWith("@")
    ? instagramHandle
    : `@${instagramHandle}`;
  const derivedInstagramUrl = sanitizeUrl(
    contact.instagramUrl,
    defaults.contact.instagramUrl,
  );

  return {
    hero: {
      imageUrl: sanitizeUrl(hero.imageUrl, ""),
      publicId: sanitizeOptionalText(hero.publicId, 280),
      alt: sanitizeText(hero.alt, defaults.hero.alt, 220),
    },
    header: {
      introLabel: sanitizeText(
        header.introLabel,
        defaults.header.introLabel,
        120,
      ),
      headline: sanitizeText(header.headline, defaults.header.headline, 180),
      supportingLine: sanitizeText(
        header.supportingLine,
        defaults.header.supportingLine,
        480,
      ),
    },
    body: {
      paragraphs: sanitizeParagraphs(body.paragraphs, defaults.body.paragraphs),
    },
    quote: {
      text: sanitizeText(quote.text, defaults.quote.text, 480),
      attribution: sanitizeOptionalText(
        quote.attribution,
        180,
      ),
    },
    contact: {
      instagramLabel: sanitizeText(
        contact.instagramLabel,
        defaults.contact.instagramLabel,
        80,
      ),
      instagramHandle: normalizeHandleOutput(normalizedHandle),
      instagramUrl: derivedInstagramUrl,
      emailLabel: sanitizeText(
        contact.emailLabel,
        defaults.contact.emailLabel,
        80,
      ),
      email: sanitizeEmail(contact.email, defaults.contact.email),
    },
  };
}

function normalizeHandleOutput(handle) {
  if (!handle) {
    return "";
  }

  const cleaned = handle.replace(/\s+/g, "");
  if (!cleaned) {
    return "";
  }

  return cleaned.startsWith("@") ? cleaned : `@${cleaned}`;
}

function normalizeSlug(slug) {
  if (typeof slug !== "string") {
    return "";
  }
  return slug.trim().toLowerCase();
}

function isSupportedSlug(slug) {
  return normalizeSlug(slug) === ABOUT_SLUG;
}

async function getPageCollection() {
  const db = await getMongoDatabase();
  return db.collection(PAGE_CONTENT_COLLECTION);
}

async function ensurePageContentStoreReady() {
  if (!isMongoConfigured()) {
    return;
  }

  if (!globalThis[READY_PROMISE_KEY]) {
    globalThis[READY_PROMISE_KEY] = (async () => {
      const collection = await getPageCollection();

      await collection.createIndex({ slug: 1 }, { unique: true, name: "slug_unique" });
      await collection.updateOne(
        { slug: ABOUT_SLUG },
        {
          $setOnInsert: {
            slug: ABOUT_SLUG,
            sections: cloneDefaults(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
        { upsert: true },
      );

      // One-time safe migration from the old default headline.
      await collection.updateOne(
        {
          slug: ABOUT_SLUG,
          "sections.header.headline": "Street Frames",
        },
        {
          $set: {
            "sections.header.headline": DEFAULT_ABOUT_SECTIONS.header.headline,
            updatedAt: new Date().toISOString(),
          },
        },
      );
    })().catch((error) => {
      globalThis[READY_PROMISE_KEY] = null;
      throw error;
    });
  }

  await globalThis[READY_PROMISE_KEY];
}

function toPageContent(doc) {
  const sections = normalizeAboutSections(doc?.sections || {});

  return {
    slug: ABOUT_SLUG,
    sections,
    createdAt: doc?.createdAt || "",
    updatedAt: doc?.updatedAt || "",
  };
}

export function getDefaultAboutPageContent() {
  return {
    slug: ABOUT_SLUG,
    sections: cloneDefaults(),
    createdAt: "",
    updatedAt: "",
  };
}

export async function getPageContent(slug) {
  const normalizedSlug = normalizeSlug(slug);
  if (!isSupportedSlug(normalizedSlug)) {
    return null;
  }

  if (!isMongoConfigured()) {
    return getDefaultAboutPageContent();
  }

  await ensurePageContentStoreReady();
  const collection = await getPageCollection();
  const doc = await collection.findOne({ slug: normalizedSlug });
  if (!doc) {
    return getDefaultAboutPageContent();
  }

  return toPageContent(doc);
}

export async function getAboutPageContent() {
  return getPageContent(ABOUT_SLUG);
}

export async function getAboutPageContentSafe() {
  try {
    return await getAboutPageContent();
  } catch {
    return getDefaultAboutPageContent();
  }
}

export async function updatePageContent(slug, sectionsInput = {}) {
  const normalizedSlug = normalizeSlug(slug);
  if (!isSupportedSlug(normalizedSlug)) {
    return { error: "Unsupported page slug." };
  }

  const normalizedSections = normalizeAboutSections(sectionsInput);

  if (!isMongoConfigured()) {
    return {
      page: {
        slug: normalizedSlug,
        sections: normalizedSections,
        createdAt: "",
        updatedAt: new Date().toISOString(),
      },
      persisted: false,
    };
  }

  await ensurePageContentStoreReady();
  const collection = await getPageCollection();
  const now = new Date().toISOString();
  await collection.updateOne(
    { slug: normalizedSlug },
    {
      $set: {
        sections: normalizedSections,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true },
  );

  const updated = await collection.findOne({ slug: normalizedSlug });
  return { page: toPageContent(updated), persisted: true };
}
