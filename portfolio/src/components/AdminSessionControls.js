"use client";

import { signOut } from "next-auth/react";

export default function AdminSessionControls({ email = "" }) {
  const handleSignOut = async () => {
    await fetch("/api/admin-gate", { method: "DELETE" }).catch(() => {});
    await signOut({ callbackUrl: "/" });
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
      {email ? (
        <p className="max-w-full break-all text-[10px] tracking-[0.12em] text-muted uppercase sm:text-[11px]">
          {email}
        </p>
      ) : null}
      <button
        type="button"
        onClick={handleSignOut}
        className="text-[10px] tracking-[0.16em] text-muted uppercase transition-colors hover:text-foreground sm:text-[11px]"
      >
        Sign Out
      </button>
    </div>
  );
}
