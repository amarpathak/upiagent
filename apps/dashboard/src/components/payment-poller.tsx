"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 10_000;
const MAX_POLLS = 18;

export function PaymentPoller({ paymentId, status }: { paymentId: string; status: string }) {
  const [pollCount, setPollCount] = useState(0);
  const [message, setMessage] = useState("");
  const [stopped, setStopped] = useState(false);
  const [checking, setChecking] = useState(false);
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const doVerify = useCallback(async (force = false) => {
    setChecking(true);
    setMessage(force ? "Retrying verification (wider search)..." : "Checking Gmail...");
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, force }),
      });
      const data = await res.json();
      setMessage(data.message || "Checking...");

      if (data.verified || data.status === "verified") {
        if (timer.current) clearInterval(timer.current);
        setMessage("Payment verified!");
        router.refresh();
        return true;
      }
      if (data.status === "expired") {
        if (timer.current) clearInterval(timer.current);
        setMessage("Payment expired");
        router.refresh();
        return true;
      }
    } catch {
      setMessage("Network error");
    } finally {
      setChecking(false);
    }
    return false;
  }, [paymentId, router]);

  // Auto-poll on mount for pending payments
  useEffect(() => {
    if (status !== "pending") return; // only auto-poll for pending, not expired

    let count = 0;

    const poll = async () => {
      count++;
      setPollCount(count);
      if (count > MAX_POLLS) {
        if (timer.current) clearInterval(timer.current);
        setStopped(true);
        setMessage("Auto-polling stopped. Use the button below to retry.");
        return;
      }
      await doVerify();
    };

    const firstPoll = setTimeout(poll, 3000);
    timer.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      clearTimeout(firstPoll);
      if (timer.current) clearInterval(timer.current);
    };
  }, [paymentId, status, doVerify]);

  // Manual retry — works even after auto-poll stopped
  const handleRetry = async () => {
    setPollCount((c) => c + 1);
    await doVerify(true); // force=true: skip expiry, wider lookback
  };

  if (status !== "pending" && status !== "expired") return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5">
        {!stopped && !checking ? (
          <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
        ) : checking ? (
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-muted" />
        )}
        <div className="flex-1 text-sm">
          <span className="font-mono text-yellow-500">
            {checking ? "Checking Gmail..." : stopped ? "Auto-polling stopped" : "Verifying payment"}
          </span>
          {!stopped && (
            <span className="text-muted-foreground font-mono text-xs ml-2">
              poll {pollCount}/{MAX_POLLS}
            </span>
          )}
          {message && (
            <p className="text-xs text-muted-foreground mt-0.5">{message}</p>
          )}
        </div>
        <button
          onClick={handleRetry}
          disabled={checking}
          className="shrink-0 px-3 py-1.5 text-xs font-mono border border-border rounded-md hover:bg-surface-raised transition-colors disabled:opacity-50"
        >
          {checking ? "Checking..." : "Retry now"}
        </button>
      </div>
    </div>
  );
}
