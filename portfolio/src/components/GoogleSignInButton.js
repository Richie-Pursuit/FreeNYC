"use client";

import { signIn } from "next-auth/react";

export default function GoogleSignInButton({ callbackUrl = "/admin" }) {
  return (
    <button
      type="button"
      onClick={() => signIn("google", { callbackUrl })}
      className="w-full border border-foreground px-7 py-3 text-[11px] tracking-[0.18em] uppercase transition-colors hover:bg-foreground hover:text-background sm:w-auto"
    >
      Continue With Google
    </button>
  );
}
