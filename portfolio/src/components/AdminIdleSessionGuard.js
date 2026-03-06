"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "next-auth/react";

const DEFAULT_IDLE_TIMEOUT_MS = 20 * 60 * 1000;
const DEFAULT_WARNING_TIMEOUT_MS = 60 * 1000;
const MIN_IDLE_TIMEOUT_MS = 60 * 1000;
const MIN_WARNING_TIMEOUT_MS = 10 * 1000;

function toPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function formatSeconds(milliseconds) {
  return Math.max(0, Math.ceil(milliseconds / 1000));
}

export default function AdminIdleSessionGuard() {
  const idleTimeoutMs = useMemo(() => {
    const configured = toPositiveInteger(
      process.env.NEXT_PUBLIC_ADMIN_IDLE_TIMEOUT_MS,
      DEFAULT_IDLE_TIMEOUT_MS,
    );
    return Math.max(MIN_IDLE_TIMEOUT_MS, configured);
  }, []);

  const warningTimeoutMs = useMemo(() => {
    const configured = toPositiveInteger(
      process.env.NEXT_PUBLIC_ADMIN_IDLE_WARNING_MS,
      DEFAULT_WARNING_TIMEOUT_MS,
    );
    const clamped = Math.max(MIN_WARNING_TIMEOUT_MS, configured);
    return Math.min(clamped, idleTimeoutMs - MIN_WARNING_TIMEOUT_MS);
  }, [idleTimeoutMs]);

  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [remainingMs, setRemainingMs] = useState(warningTimeoutMs);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const warningTimerRef = useRef(null);
  const logoutTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const isSigningOutRef = useRef(false);
  const lastActivityResetRef = useRef(0);

  const clearTimers = useCallback(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const handleTimedSignOut = useCallback(async () => {
    if (isSigningOutRef.current) {
      return;
    }

    isSigningOutRef.current = true;
    setIsSigningOut(true);
    clearTimers();

    await fetch("/api/admin-gate", { method: "DELETE" }).catch(() => {});
    await signOut({ callbackUrl: "/login?callbackUrl=/admin&timedOut=1" });
  }, [clearTimers]);

  const armIdleTimers = useCallback(() => {
    clearTimers();

    const warningDelay = Math.max(1000, idleTimeoutMs - warningTimeoutMs);

    warningTimerRef.current = setTimeout(() => {
      if (isSigningOutRef.current) {
        return;
      }

      setIsWarningOpen(true);
      setRemainingMs(warningTimeoutMs);

      countdownIntervalRef.current = setInterval(() => {
        setRemainingMs((current) => Math.max(0, current - 1000));
      }, 1000);
    }, warningDelay);

    logoutTimerRef.current = setTimeout(() => {
      void handleTimedSignOut();
    }, idleTimeoutMs);
  }, [clearTimers, handleTimedSignOut, idleTimeoutMs, warningTimeoutMs]);

  const resetIdleTimers = useCallback(() => {
    setIsWarningOpen(false);
    setRemainingMs(warningTimeoutMs);
    armIdleTimers();
  }, [armIdleTimers, warningTimeoutMs]);

  const registerActivity = useCallback(() => {
    if (isSigningOutRef.current) {
      return;
    }

    const now = Date.now();
    if (now - lastActivityResetRef.current < 700) {
      return;
    }
    lastActivityResetRef.current = now;
    resetIdleTimers();
  }, [resetIdleTimers]);

  const handleStaySignedIn = useCallback(() => {
    resetIdleTimers();
  }, [resetIdleTimers]);

  useEffect(() => {
    armIdleTimers();

    const events = ["pointerdown", "keydown", "touchstart", "scroll", "mousemove"];
    const options = { passive: true };

    events.forEach((eventName) => {
      window.addEventListener(eventName, registerActivity, options);
    });

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, registerActivity, options);
      });
      clearTimers();
    };
  }, [armIdleTimers, clearTimers, registerActivity]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        registerActivity();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [registerActivity]);

  if (!isWarningOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl border border-line bg-white p-5 shadow-[0_30px_70px_rgba(0,0,0,0.25)] sm:p-6">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">
          Inactive Session
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-foreground">Still there?</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          You are about to be signed out for inactivity in{" "}
          <span className="font-semibold text-foreground">{formatSeconds(remainingMs)}s</span>.
        </p>
        <p className="mt-2 text-sm leading-6 text-muted">
          Click below to keep editing. If you do nothing, admin access will close automatically.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => void handleTimedSignOut()}
            className="rounded-md border border-line bg-white px-4 py-2 text-xs font-semibold tracking-[0.12em] text-muted uppercase transition-colors hover:border-foreground/35 hover:text-foreground"
            disabled={isSigningOut}
          >
            Sign Out Now
          </button>
          <button
            type="button"
            onClick={handleStaySignedIn}
            className="rounded-md border border-foreground bg-foreground px-4 py-2 text-xs font-semibold tracking-[0.12em] text-background uppercase transition-opacity hover:opacity-90"
            disabled={isSigningOut}
          >
            Keep Working
          </button>
        </div>
      </div>
    </div>
  );
}
