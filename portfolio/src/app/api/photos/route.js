import { NextResponse } from "next/server";
import {
  createPhoto,
  getCollections,
  listPhotos,
  reorderPhotos,
} from "@/lib/photoStore";
import { requireApiAuth } from "@/lib/auth";
import { internalApiError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return parsed;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeQueryText(value, maxLength = 120) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function normalizeSort(value) {
  if (value === "oldest" || value === "manual" || value === "curated") {
    return value;
  }

  return "newest";
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
  try {
    const searchParams = request.nextUrl.searchParams;
    const collection = sanitizeQueryText(searchParams.get("collection"), 80) || "All";
    const q = sanitizeQueryText(searchParams.get("q"), 120);
    const limit = clamp(toInt(searchParams.get("limit"), 60), 1, 300);
    const offset = clamp(toInt(searchParams.get("offset"), 0), 0, 10000);
    const sort = normalizeSort(searchParams.get("sort") || "newest");

    const [result, collections] = await Promise.all([
      listPhotos({ collection, q, limit, offset, sort }),
      getCollections(),
    ]);

    return NextResponse.json({
      photos: result.photos,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        returned: result.photos.length,
      },
      collections,
      filters: {
        collection,
        q,
        sort,
      },
    });
  } catch (error) {
    return internalApiError(error);
  }
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

    const result = await createPhoto(body);
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
  } catch (error) {
    return internalApiError(error);
  }
}

export async function PATCH(request) {
  try {
    const authResult = await requireApiAuth();
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const body = await parseJson(request);
    if (!body) {
      return badRequest("Request body must be valid JSON.");
    }

    if (body.action !== "reorder") {
      return badRequest("Unsupported action. Use action: 'reorder'.");
    }

    const result = await reorderPhotos(body.photoIds);
    if (result.error) {
      return badRequest(result.error);
    }

    return NextResponse.json({
      photos: result.photos,
      message: "Photo order updated.",
    });
  } catch (error) {
    return internalApiError(error);
  }
}
