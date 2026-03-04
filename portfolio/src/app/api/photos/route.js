import { NextResponse } from "next/server";
import {
  createPhoto,
  getCollections,
  listPhotos,
  reorderPhotos,
} from "@/lib/photoStore";

export const dynamic = "force-dynamic";

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return parsed;
}

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

export async function GET(request) {
  const searchParams = request.nextUrl.searchParams;
  const collection = searchParams.get("collection") || "All";
  const q = searchParams.get("q") || "";
  const limit = toInt(searchParams.get("limit"), 60);
  const offset = toInt(searchParams.get("offset"), 0);
  const sort = searchParams.get("sort") || "newest";

  const result = listPhotos({ collection, q, limit, offset, sort });

  return NextResponse.json({
    photos: result.photos,
    pagination: {
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      returned: result.photos.length,
    },
    collections: getCollections(),
    filters: {
      collection,
      q,
      sort,
    },
  });
}

export async function POST(request) {
  const body = await parseJson(request);
  if (!body) {
    return badRequest("Request body must be valid JSON.");
  }

  const result = createPhoto(body);
  if (result.error) {
    return badRequest(result.error);
  }

  return NextResponse.json(
    {
      photo: result.photo,
      message: "Photo metadata created.",
    },
    { status: 201 },
  );
}

export async function PATCH(request) {
  const body = await parseJson(request);
  if (!body) {
    return badRequest("Request body must be valid JSON.");
  }

  if (body.action !== "reorder") {
    return badRequest("Unsupported action. Use action: 'reorder'.");
  }

  const result = reorderPhotos(body.photoIds);
  if (result.error) {
    return badRequest(result.error);
  }

  return NextResponse.json({
    photos: result.photos,
    message: "Photo order updated.",
  });
}
