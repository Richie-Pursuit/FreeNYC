export function getMongoUri() {
  return process.env.MONGODB_URI || "";
}
