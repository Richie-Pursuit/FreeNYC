import { NextResponse } from "next/server";
import {
  createCloudinarySignature,
  getCloudinaryServerConfig,
  getCloudinaryUploadUrl,
  isCloudinaryConfigured,
} from "@/lib/cloudinary";
import { requireApiAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

function badRequest(message) {
  return NextResponse.json({ error: message }, { status: 400 });
}

async function parseJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function sanitizeFolder(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/[^a-zA-Z0-9/_-]/g, "").slice(0, 120);
}

export async function POST(request) {
  const authResult = await requireApiAuth();
  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }

  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      { error: "Cloudinary is not configured in environment variables." },
      { status: 503 },
    );
  }

  const body = (await parseJson(request)) || {};
  const config = getCloudinaryServerConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = sanitizeFolder(body.folder) || config.uploadFolder;

  const paramsToSign = {
    folder,
    timestamp,
  };

  const signature = createCloudinarySignature(paramsToSign, config.apiSecret);
  if (!signature) {
    return badRequest("Unable to generate upload signature.");
  }

  return NextResponse.json({
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    uploadUrl: getCloudinaryUploadUrl(config.cloudName),
    timestamp,
    folder,
    signature,
  });
}
