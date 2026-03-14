const CODE_ADMIN_EMAILS = ["richiecarrasco@pursuit.org"];

export function getAllowedAdminEmails() {
  const csv = process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "";

  const envEmails = csv
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return envEmails.length > 0 ? envEmails : CODE_ADMIN_EMAILS;
}

export function isAllowedAdminEmail(email) {
  const normalized = (email || "").trim().toLowerCase();
  const allowed = getAllowedAdminEmails();

  if (!normalized) {
    return false;
  }

  if (allowed.length === 0) {
    return false;
  }

  return allowed.includes(normalized);
}
