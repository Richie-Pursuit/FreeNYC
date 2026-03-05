import { MongoClient, ServerApiVersion } from "mongodb";

const CLIENT_PROMISE_KEY = "__portfolio_mongo_client_promise__";
const DEFAULT_DB_NAME = "freenyc";

function getMongoUri() {
  return (process.env.MONGODB_URI || "").trim();
}

export function getMongoDbName() {
  return (
    process.env.MONGODB_DB_NAME ||
    process.env.MONGODB_DB ||
    DEFAULT_DB_NAME
  ).trim();
}

export function isMongoConfigured() {
  return Boolean(getMongoUri());
}

export async function getMongoClient() {
  const mongoUri = getMongoUri();
  if (!mongoUri) {
    throw new Error("Missing MONGODB_URI in environment variables.");
  }

  if (!globalThis[CLIENT_PROMISE_KEY]) {
    const client = new MongoClient(mongoUri, {
      serverApi: {
        version: ServerApiVersion.v1,
      },
      connectTimeoutMS: 10_000,
      serverSelectionTimeoutMS: 10_000,
    });

    globalThis[CLIENT_PROMISE_KEY] = client.connect().catch(async (error) => {
      globalThis[CLIENT_PROMISE_KEY] = null;
      try {
        await client.close();
      } catch {
        // Ignore close errors during failed connect attempts.
      }
      throw error;
    });
  }

  try {
    return await globalThis[CLIENT_PROMISE_KEY];
  } catch (error) {
    globalThis[CLIENT_PROMISE_KEY] = null;
    throw error;
  }
}

export async function getMongoDatabase() {
  const client = await getMongoClient();
  return client.db(getMongoDbName());
}
