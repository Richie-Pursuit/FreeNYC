"use client";

import { signOut } from "next-auth/react";

export default function AdminSessionControls({ email = "" }) {
  const handleSignOut = async () => {
    await fetch("/api/admin-gate", { method: "DELETE" }).catch(() => {});
    await signOut({ callbackUrl: "/" });
  };

  return (
    <div className="flex items-center gap-4">
      {email ? (
        <p className="text-[11px] tracking-[0.12em] text-muted uppercase">{email}</p>
      ) : null}
      <button
        type="button"
        onClick={handleSignOut}
        className="text-[11px] tracking-[0.16em] text-muted uppercase transition-colors hover:text-foreground"
      >
        Sign Out
      </button>
    </div>
  );
}
