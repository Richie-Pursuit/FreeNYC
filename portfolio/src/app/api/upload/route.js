import { NextResponse } from "next/server";
import {
  buildCloudinaryThumbnailUrl,
  getCloudinaryPublicConfig,
  getCloudinaryServerConfig,
  isCloudinaryConfigured,
} from "@/lib/cloudinary";
import { requireApiAuth } from "@/lib/auth";
import { createPhoto } from "@/lib/photoStore";

export const dynamic = "force-dynamic";

function badRequest(message) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function internalError(error) {
  return NextResponse.json(
    { error: error?.message || "Internal server error." },
    { status: 500 },
  );
}

async function parseJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function GET() {
  const cloudinaryPublic = getCloudinaryPublicConfig();
  const cloudinaryServer = getCloudinaryServerConfig();

  return NextResponse.json({
    ready: isCloudinaryConfigured(),
    cloudinary: {
      cloudName: cloudinaryPublic.cloudName,
      hasUploadPreset: Boolean(cloudinaryPublic.uploadPreset),
      uploadFolder: cloudinaryServer.uploadFolder,
    },
    signatureEndpoint: "/api/upload/signature",
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
      "This endpoint stores metadata after Cloudinary upload. Use /api/upload/signature to generate a signed upload request.",
  });
}

export async function POST(request) {
  try {
    const authResult = await requireApiAuth();
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const body = await parseJson(request);
    if (!body) {
      return badRequest("Request body must be valid JSON.");
    }

    const imageUrl = body.secureUrl || body.imageUrl;
    if (!imageUrl) {
      return badRequest("secureUrl (or imageUrl) is required.");
    }

    const cloudinary = getCloudinaryServerConfig();
    const computedThumbnail =
      body.thumbnailUrl ||
      buildCloudinaryThumbnailUrl({
        cloudName: cloudinary.cloudName,
        publicId: body.publicId,
        width: 960,
        quality: "auto",
        format: "auto",
      });

    const result = await createPhoto({
      imageUrl,
      thumbnailUrl: computedThumbnail,
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
  } catch (error) {
    return internalError(error);
  }
}
