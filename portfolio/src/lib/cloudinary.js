import { createHash } from "node:crypto";

function parseCloudinaryUrl(value) {
  if (!value || !value.startsWith("cloudinary://")) {
    return null;
  }

  try {
    const parsed = new URL(value);
    return {
      cloudName: parsed.hostname,
      apiKey: decodeURIComponent(parsed.username || ""),
      apiSecret: decodeURIComponent(parsed.password || ""),
    };
  } catch {
    return null;
  }
}

export function getCloudinaryServerConfig() {
  const parsedFromUrl = parseCloudinaryUrl(process.env.CLOUDINARY_URL || "");

  return {
    cloudName:
      process.env.CLOUDINARY_CLOUD_NAME ||
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
      parsedFromUrl?.cloudName ||
      "",
    apiKey: process.env.CLOUDINARY_API_KEY || parsedFromUrl?.apiKey || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || parsedFromUrl?.apiSecret || "",
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || "",
    uploadFolder: process.env.CLOUDINARY_UPLOAD_FOLDER || "",
  };
}

export function getCloudinaryPublicConfig() {
  const { cloudName, uploadPreset } = getCloudinaryServerConfig();
  return { cloudName, uploadPreset };
}

export function isCloudinaryConfigured() {
  const { cloudName, apiKey, apiSecret } = getCloudinaryServerConfig();
  return Boolean(cloudName && apiKey && apiSecret);
}

function normalizeCloudinaryValue(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

export function createCloudinarySignature(params, apiSecret) {
  const normalizedSecret = normalizeCloudinaryValue(apiSecret);
  if (!normalizedSecret) {
    return "";
  }

  const payload = Object.entries(params)
    .map(([key, value]) => [key, normalizeCloudinaryValue(value)])
    .filter(([, value]) => Boolean(value))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return createHash("sha1")
    .update(`${payload}${normalizedSecret}`)
    .digest("hex");
}

export function getCloudinaryUploadUrl(cloudName) {
  const normalizedCloud = normalizeCloudinaryValue(cloudName);
  if (!normalizedCloud) {
    return "";
  }

  return `https://api.cloudinary.com/v1_1/${normalizedCloud}/image/upload`;
}

export function buildCloudinaryThumbnailUrl({
  cloudName,
  publicId,
  width = 1200,
  quality = "auto",
  format = "auto",
}) {
  const normalizedCloud = normalizeCloudinaryValue(cloudName);
  const normalizedPublicId = normalizeCloudinaryValue(publicId);

  if (!normalizedCloud || !normalizedPublicId) {
    return "";
  }

  const transformations = `f_${format},q_${quality},w_${width}`;
  return `https://res.cloudinary.com/${normalizedCloud}/image/upload/${transformations}/${normalizedPublicId}`;
}
