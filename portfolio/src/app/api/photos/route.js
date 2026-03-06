import { NextResponse } from "next/server";
import {
  createPhoto,
  getCollections,
  listPhotos,
  moveCollection,
  renameCollection,
  reorderPhotos,
  setFeaturedPhotoOrder,
} from "@/lib/photoStore";
import { requireApiAuth } from "@/lib/auth";
import { internalApiError } from "@/lib/api-errors";
import { verifyCsrfRequest } from "@/lib/csrf";

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

function parseBooleanQuery(value) {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function normalizePublishedFilter(value) {
  if (value === "published" || value === "draft") {
    return value;
  }

  return "all";
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
    const includeDrafts = parseBooleanQuery(searchParams.get("includeDrafts"));
    const published = normalizePublishedFilter(searchParams.get("published"));
    const featuredOnly = parseBooleanQuery(searchParams.get("featured"));

    if (includeDrafts) {
      const authResult = await requireApiAuth();
      if (authResult.errorResponse) {
        return authResult.errorResponse;
      }
    }

    const [result, collections] = await Promise.all([
      listPhotos({
        collection,
        q,
        limit,
        offset,
        sort,
        includeDrafts,
        publishedStatus: published,
        featuredOnly,
      }),
      getCollections({ includeDrafts }),
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
        includeDrafts,
        published,
        featuredOnly,
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

    const csrfResult = verifyCsrfRequest(request);
    if (!csrfResult.ok) {
      return csrfResult.errorResponse;
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

    const csrfResult = verifyCsrfRequest(request);
    if (!csrfResult.ok) {
      return csrfResult.errorResponse;
    }

    const body = await parseJson(request);
    if (!body) {
      return badRequest("Request body must be valid JSON.");
    }

    if (body.action === "reorder") {
      const result = await reorderPhotos(body.photoIds);
      if (result.error) {
        return badRequest(result.error);
      }

      return NextResponse.json({
        photos: result.photos,
        message: "Photo order updated.",
      });
    }

    if (body.action === "setFeaturedOrder") {
      const result = await setFeaturedPhotoOrder(body.photoIds, { maxItems: 100 });
      if (result.error) {
        return badRequest(result.error);
      }

      return NextResponse.json({
        photoIds: result.photoIds,
        photos: result.photos,
        message: "Homepage selection updated.",
      });
    }

    if (body.action === "renameCollection") {
      const result = await renameCollection(body.fromCollection, body.toCollection);
      if (result.error) {
        return badRequest(result.error);
      }

      return NextResponse.json({
        modifiedCount: result.modifiedCount || 0,
        message: "Collection renamed.",
      });
    }

    if (body.action === "moveCollection") {
      const result = await moveCollection(body.fromCollection, body.toCollection);
      if (result.error) {
        return badRequest(result.error);
      }

      return NextResponse.json({
        modifiedCount: result.modifiedCount || 0,
        message: "Collection moved.",
      });
    }

    return badRequest(
      "Unsupported action. Use one of: 'reorder', 'setFeaturedOrder', 'renameCollection', 'moveCollection'.",
    );
  } catch (error) {
    return internalApiError(error);
  }
}
