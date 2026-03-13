"use client";

import { signOut } from "next-auth/react";

export default function AdminSessionControls({ email = "" }) {
  const handleSignOut = async () => {
    await fetch("/api/admin-gate", { method: "DELETE" }).catch(() => {});
    await signOut({ callbackUrl: "/" });
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 rounded-full border border-zinc-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(246,244,240,0.94)_100%)] px-3 py-2 shadow-[0_12px_28px_rgba(0,0,0,0.06)] sm:gap-3 sm:px-4">
      {email ? (
        <div className="inline-flex min-h-10 items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 shadow-[0_8px_20px_rgba(0,0,0,0.04)]">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.14)]" />
          <p className="max-w-full break-all text-[11px] font-semibold tracking-[0.08em] text-zinc-800 uppercase sm:text-[12px]">
            {email}
          </p>
        </div>
      ) : null}
      <button
        type="button"
        onClick={handleSignOut}
        className="inline-flex min-h-10 items-center justify-center rounded-full border border-rose-200 bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(255,245,246,0.96)_100%)] px-4 py-2 text-[11px] font-semibold tracking-[0.14em] text-rose-800 uppercase shadow-[0_10px_22px_rgba(190,24,93,0.08)] transition-all hover:-translate-y-0.5 hover:border-rose-300 hover:bg-[linear-gradient(180deg,rgba(255,247,248,1)_0%,rgba(255,235,239,0.98)_100%)] hover:text-rose-900 hover:shadow-[0_14px_26px_rgba(190,24,93,0.14)] sm:text-[12px]"
      >
        Sign Out
      </button>
    </div>
  );
}
