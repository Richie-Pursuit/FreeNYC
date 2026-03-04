export function getAllowedAdminEmails() {
  const csv = process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "";

  return csv
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedAdminEmail(email) {
  const normalized = (email || "").trim().toLowerCase();
  const allowed = getAllowedAdminEmails();

  if (!normalized) {
    return false;
  }

  if (allowed.length === 0) {
    return true;
  }

  return allowed.includes(normalized);
}
