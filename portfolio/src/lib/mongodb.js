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
    });

    globalThis[CLIENT_PROMISE_KEY] = client.connect();
  }

  return globalThis[CLIENT_PROMISE_KEY];
}

export async function getMongoDatabase() {
  const client = await getMongoClient();
  return client.db(getMongoDbName());
}
