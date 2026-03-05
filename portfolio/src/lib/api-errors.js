import { NextResponse } from "next/server";

function toMessage(error) {
  if (!error) {
    return "";
  }

  if (typeof error.message === "string") {
    return error.message;
  }

  return String(error);
}

export function isDatabaseConnectionError(error) {
  const message = toMessage(error).toLowerCase();
  const name = String(error?.name || "").toLowerCase();

  return (
    name.includes("mongoserverselectionerror") ||
    name.includes("mongonetworkerror") ||
    message.includes("ssl routines") ||
    message.includes("tlsv1 alert") ||
    message.includes("mongodb.net") ||
    message.includes("server selection timed out") ||
    message.includes("connection timed out") ||
    message.includes("econnreset") ||
    message.includes("enotfound")
  );
}

export function internalApiError(error, fallbackMessage = "Internal server error.") {
  if (isDatabaseConnectionError(error)) {
    return NextResponse.json(
      {
        error:
          "Database connection failed. Check MongoDB Atlas IP access list, cluster status, and MONGODB_URI.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    { error: toMessage(error) || fallbackMessage },
    { status: 500 },
  );
}
