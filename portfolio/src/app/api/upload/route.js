import { NextResponse } from "next/server";
import {
  getCloudinaryPublicConfig,
  isCloudinaryConfigured,
} from "@/lib/cloudinary";
import { createPhoto } from "@/lib/photoStore";

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

export async function GET() {
  const cloudinary = getCloudinaryPublicConfig();

  return NextResponse.json({
    ready: isCloudinaryConfigured(),
    cloudinary: {
      cloudName: cloudinary.cloudName,
      hasUploadPreset: Boolean(cloudinary.uploadPreset),
    },
    expectedPayload: {
      secureUrl: "https://res.cloudinary.com/... (required in Step 4 contract)",
      publicId: "optional",
      thumbnailUrl: "optional",
      title: "optional",
      caption: "optional",
      poem: "optional",
      collection: "optional",
    },
    message:
      "This endpoint currently stores metadata after an uploaded image URL is provided. Direct file upload to Cloudinary is added in Step 5.",
  });
}

export async function POST(request) {
  const body = await parseJson(request);
  if (!body) {
    return badRequest("Request body must be valid JSON.");
  }

  const imageUrl = body.secureUrl || body.imageUrl;
  if (!imageUrl) {
    return badRequest("secureUrl (or imageUrl) is required.");
  }

  const result = createPhoto({
    imageUrl,
    thumbnailUrl: body.thumbnailUrl,
    publicId: body.publicId,
    title: body.title,
    caption: body.caption,
    poem: body.poem,
    collection: body.collection,
  });

  if (result.error) {
    return badRequest(result.error);
  }

  return NextResponse.json(
    {
      photo: result.photo,
      message: "Uploaded asset metadata stored successfully.",
    },
    { status: 201 },
  );
}
