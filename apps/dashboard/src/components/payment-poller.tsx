"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 10_000; // 10 seconds
const MAX_POLLS = 18; // ~3 minutes total

export function PaymentPoller({ paymentId, status }: { paymentId: string; status: string }) {
  const [pollCount, setPollCount] = useState(0);
  const [message, setMessage] = useState("");
  const [stopped, setStopped] = useState(false);
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (status !== "pending") return;

    let count = 0;

    const poll = async () => {
      count++;
      setPollCount(count);

      if (count > MAX_POLLS) {
        if (timer.current) clearInterval(timer.current);
        setStopped(true);
        setMessage("Stopped polling — check back later or refresh");
        return;
      }

      try {
        const res = await fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentId }),
        });
        const data = await res.json();
        setMessage(data.message || "Checking...");

        if (data.verified || data.status === "verified") {
          if (timer.current) clearInterval(timer.current);
          setMessage("Payment verified!");
          router.refresh();
        }
        if (data.status === "expired") {
          if (timer.current) clearInterval(timer.current);
          setMessage("Payment expired");
          router.refresh();
        }
      } catch {
        setMessage("Network error — retrying...");
      }
    };

    // First poll after 3s, then every 10s
    const firstPoll = setTimeout(poll, 3000);
    timer.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      clearTimeout(firstPoll);
      if (timer.current) clearInterval(timer.current);
    };
  }, [paymentId, status, router]);

  if (status !== "pending") return null;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5">
      {!stopped ? (
        <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
      ) : (
        <div className="w-2 h-2 rounded-full bg-muted" />
      )}
      <div className="text-sm">
        <span className="font-mono text-yellow-500">
          {stopped ? "Polling stopped" : "Verifying payment"}
        </span>
        <span className="text-muted font-mono text-xs ml-2">
          poll {pollCount}/{MAX_POLLS}
        </span>
        {message && (
          <p className="text-xs text-muted mt-0.5">{message}</p>
        )}
      </div>
    </div>
  );
}
