import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { isAllowedAdminEmail } from "@/lib/auth-policy";

export async function requireApiAuth() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email || "";

  if (!email) {
    return {
      errorResponse: NextResponse.json(
        { error: "Unauthorized. Sign in with Google." },
        { status: 401 },
      ),
    };
  }

  if (!isAllowedAdminEmail(email)) {
    return {
      errorResponse: NextResponse.json(
        { error: "Forbidden. This account cannot access admin endpoints." },
        { status: 403 },
      ),
    };
  }

  return { session };
}
