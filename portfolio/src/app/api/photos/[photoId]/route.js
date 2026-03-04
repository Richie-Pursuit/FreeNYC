import { NextResponse } from "next/server";
import {
  deletePhotoById,
  getPhotoById,
  updatePhotoById,
} from "@/lib/photoStore";

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

export async function GET(_request, { params }) {
  const { photoId } = await params;
  const photo = getPhotoById(photoId);

  if (!photo) {
    return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  }

  return NextResponse.json({ photo });
}

export async function PATCH(request, { params }) {
  const { photoId } = await params;
  const body = await parseJson(request);

  if (!body) {
    return badRequest("Request body must be valid JSON.");
  }

  const result = updatePhotoById(photoId, {
    imageUrl: body.imageUrl,
    thumbnailUrl: body.thumbnailUrl,
    publicId: body.publicId,
    title: body.title,
    caption: body.caption,
    poem: body.poem,
    collection: body.collection,
  });

  if (result.error) {
    const status = result.status || 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    photo: result.photo,
    message: "Photo updated.",
  });
}

export async function DELETE(_request, { params }) {
  const { photoId } = await params;
  const result = deletePhotoById(photoId);

  if (result.error) {
    const status = result.status || 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    photo: result.photo,
    deletedPhotoId: result.photo.photoId,
    message: "Photo deleted.",
  });
}
