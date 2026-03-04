import { NextResponse } from "next/server";
import {
  createPhoto,
  getCollections,
  listPhotos,
  reorderPhotos,
} from "@/lib/photoStore";
import { requireApiAuth } from "@/lib/auth";

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

export async function GET(request) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const collection = searchParams.get("collection") || "All";
    const q = searchParams.get("q") || "";
    const limit = toInt(searchParams.get("limit"), 60);
    const offset = toInt(searchParams.get("offset"), 0);
    const sort = searchParams.get("sort") || "newest";

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
    return internalError(error);
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
    return internalError(error);
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
    return internalError(error);
  }
}
