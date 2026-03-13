import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { internalApiError } from "@/lib/api-errors";
import { verifyCsrfRequest } from "@/lib/csrf";
import { getSiteSettings, updateSiteSettings } from "@/lib/siteSettingsStore";

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
  try {
    const settings = await getSiteSettings();
    return NextResponse.json({ settings });
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

    const result = await updateSiteSettings(body);
    if (result.error) {
      return badRequest(result.error);
    }

    return NextResponse.json({
      settings: result.settings,
      persisted: result.persisted !== false,
      message:
        result.persisted === false
          ? "Saved in memory fallback mode (MongoDB not configured)."
          : "Site settings updated.",
    });
  } catch (error) {
    return internalApiError(error);
  }
}
