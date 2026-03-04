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
