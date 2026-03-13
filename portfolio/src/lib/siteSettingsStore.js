import { getMongoDatabase, isMongoConfigured } from "@/lib/mongodb";
import { getDefaultSiteSettingsValues, normalizeSiteSettings } from "@/lib/siteSettings";

const SITE_SETTINGS_COLLECTION = "site_settings";
const READY_PROMISE_KEY = "__portfolio_site_settings_ready__";
const SITE_SETTINGS_DOC_ID = "global";

function toSiteSettings(doc) {
  return {
    ...normalizeSiteSettings(doc),
    createdAt: doc?.createdAt || "",
    updatedAt: doc?.updatedAt || "",
  };
}

export function getDefaultSiteSettings() {
  return {
    ...getDefaultSiteSettingsValues(),
    createdAt: "",
    updatedAt: "",
  };
}

async function getSiteSettingsCollection() {
  const db = await getMongoDatabase();
  return db.collection(SITE_SETTINGS_COLLECTION);
}

async function ensureSiteSettingsStoreReady() {
  if (!isMongoConfigured()) {
    return;
  }

  if (!globalThis[READY_PROMISE_KEY]) {
    globalThis[READY_PROMISE_KEY] = (async () => {
      const collection = await getSiteSettingsCollection();
      const now = new Date().toISOString();

      await collection.updateOne(
        { _id: SITE_SETTINGS_DOC_ID },
        {
          $setOnInsert: {
            _id: SITE_SETTINGS_DOC_ID,
            ...getDefaultSiteSettingsValues(),
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true },
      );
    })().catch((error) => {
      globalThis[READY_PROMISE_KEY] = null;
      throw error;
    });
  }

  await globalThis[READY_PROMISE_KEY];
}

export async function getSiteSettings() {
  if (!isMongoConfigured()) {
    return getDefaultSiteSettings();
  }

  await ensureSiteSettingsStoreReady();
  const collection = await getSiteSettingsCollection();
  const doc = await collection.findOne({ _id: SITE_SETTINGS_DOC_ID });
  if (!doc) {
    return getDefaultSiteSettings();
  }

  return toSiteSettings(doc);
}

export async function getSiteSettingsSafe() {
  try {
    return await getSiteSettings();
  } catch {
    return getDefaultSiteSettings();
  }
}

export async function updateSiteSettings(input = {}) {
  const settings = normalizeSiteSettings(input);
  if (!settings.brandName) {
    return { error: "Brand name is required." };
  }

  if (!isMongoConfigured()) {
    return {
      settings: {
        ...settings,
        createdAt: "",
        updatedAt: new Date().toISOString(),
      },
      persisted: false,
    };
  }

  await ensureSiteSettingsStoreReady();
  const collection = await getSiteSettingsCollection();
  const now = new Date().toISOString();

  await collection.updateOne(
    { _id: SITE_SETTINGS_DOC_ID },
    {
      $set: {
        ...settings,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true },
  );

  const updated = await collection.findOne({ _id: SITE_SETTINGS_DOC_ID });
  return {
    settings: toSiteSettings(updated),
    persisted: true,
  };
}
