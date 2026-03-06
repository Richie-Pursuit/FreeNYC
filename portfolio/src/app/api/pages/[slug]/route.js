import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireApiAuth } from "@/lib/auth";
import { internalApiError } from "@/lib/api-errors";
import { verifyCsrfRequest } from "@/lib/csrf";
import { getPageContent, updatePageContent } from "@/lib/pageContentStore";

export const dynamic = "force-dynamic";

function normalizeSlug(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toLowerCase();
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

export async function GET(_request, { params }) {
  try {
    const resolvedParams = await params;
    const slug = normalizeSlug(resolvedParams?.slug);
    if (!slug) {
      return badRequest("Page slug is required.");
    }

    const page = await getPageContent(slug);
    if (!page) {
      return NextResponse.json({ error: "Page not found." }, { status: 404 });
    }

    return NextResponse.json({ page });
  } catch (error) {
    return internalApiError(error);
  }
}

export async function PATCH(request, { params }) {
  try {
    const authResult = await requireApiAuth();
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const csrfResult = verifyCsrfRequest(request);
    if (!csrfResult.ok) {
      return csrfResult.errorResponse;
    }

    const resolvedParams = await params;
    const slug = normalizeSlug(resolvedParams?.slug);
    if (!slug) {
      return badRequest("Page slug is required.");
    }

    const body = await parseJson(request);
    if (!body) {
      return badRequest("Request body must be valid JSON.");
    }

    const sections = body.sections || body.content || body;
    const result = await updatePageContent(slug, sections);
    if (result.error) {
      return badRequest(result.error);
    }

    if (slug === "about") {
      revalidatePath("/about");
      revalidatePath("/admin/about");
    }

    return NextResponse.json({
      page: result.page,
      persisted: result.persisted !== false,
      message:
        result.persisted === false
          ? "Saved in memory fallback mode (MongoDB not configured)."
          : "Page content updated.",
    });
  } catch (error) {
    return internalApiError(error);
  }
}
