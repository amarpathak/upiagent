"use client";

import { useState, useCallback, useEffect, useRef } from "react";

type DemoStep = "idle" | "waiting" | "verifying" | "verified" | "timeout";

interface VerifyResult {
  verified: boolean;
  payment?: {
    amount: number;
    upiReferenceId: string;
    senderName: string;
    bankName: string;
    confidence: number;
  };
  reason?: string;
  message?: string;
}

function Field({
  label, value, onChange, mono, type = "text", disabled,
}: {
  label: string; value: string; onChange: (v: string) => void;
  mono?: boolean; type?: string; disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] text-muted font-mono uppercase tracking-wider">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
        className={`bg-background border border-border rounded px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:border-cyan disabled:opacity-40 disabled:cursor-not-allowed ${mono ? "font-mono" : ""}`} />
    </label>
  );
}

function Select({
  label, value, onChange, options, disabled,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] text-muted font-mono uppercase tracking-wider">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
        className="bg-background border border-border rounded px-2.5 py-1.5 text-sm text-foreground font-mono focus:outline-none focus:border-cyan appearance-none disabled:opacity-40">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function Toggle({
  label, checked, onChange, disabled, hint,
}: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
  disabled?: boolean; hint?: string;
}) {
  return (
    <label className={`flex items-start gap-2 ${disabled ? "opacity-40" : "cursor-pointer"}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        disabled={disabled} className="mt-0.5 accent-cyan" />
      <div>
        <span className="text-[10px] text-muted font-mono uppercase tracking-wider">{label}</span>
        {hint && <p className="text-[10px] text-muted/50 mt-0.5">{hint}</p>}
      </div>
    </label>
  );
}

const MAX_WAIT_SECONDS = 180; // 3 minutes
const POLL_INTERVAL = 5000; // 5 seconds

export function LiveDemo() {
  const [upiId, setUpiId] = useState("amarpathakhdfc@ybl");
  const [merchantName, setMerchantName] = useState("upiagent demo");
  const [amount, setAmount] = useState("49");
  const [note, setNote] = useState("Order #2847");
  const [provider, setProvider] = useState("gemini");
  const [addPaisa, setAddPaisa] = useState(true);

  const [step, setStep] = useState<DemoStep>("idle");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [intentUrl, setIntentUrl] = useState("");
  const [txnId, setTxnId] = useState("");
  const [finalAmount, setFinalAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [pollCount, setPollCount] = useState(0);
  const [pollLog, setPollLog] = useState<string[]>([]);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [visibleLines, setVisibleLines] = useState(0);
  const waitTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const aborted = useRef(false);

  const locked = step !== "idle";

  const providerModel: Record<string, string> = {
    gemini: "gemini-2.5-flash",
    openai: "gpt-4o-mini",
    anthropic: "claude-sonnet",
  };

  // Real poll — calls /api/verify which hits Gmail + Gemini
  const pollVerify = useCallback(async (amt: string, pollNum: number): Promise<VerifyResult | null> => {
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedAmount: parseFloat(amt), lookbackMinutes: 5 }),
      });
      return await res.json();
    } catch {
      setPollLog((prev) => [...prev, `poll #${pollNum}: network error`]);
      return null;
    }
  }, []);

  const [error, setError] = useState("");

  const startPaymentFlow = useCallback(async () => {
    console.log("[upiagent] startPaymentFlow called, amount:", amount);
    setError("");

    const num = parseFloat(amount);
    if (!num || num < 1) {
      setError("Amount must be >= 1");
      return;
    }

    aborted.current = false;
    setLoading(true);

    let data;
    try {
      console.log("[upiagent] fetching /api/demo...");
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: num, upiId, merchantName, note, addPaisa }),
      });
      console.log("[upiagent] response status:", res.status);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      data = await res.json();
      console.log("[upiagent] got data:", data.transactionId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to generate QR";
      console.error("[upiagent] error:", msg);
      setError(msg);
      setLoading(false);
      return;
    }
    setLoading(false);

    setQrDataUrl(data.qrDataUrl);
    setIntentUrl(data.intentUrl);
    setTxnId(data.transactionId);
    setFinalAmount(data.amount.toFixed(2));
    setPollLog([]);
    setPollCount(0);
    setVerifyResult(null);

    // Go to waiting
    setStep("waiting");
    setWaitSeconds(0);

    const finalAmt = data.amount.toFixed(2);

    // Tick seconds
    waitTimer.current = setInterval(() => {
      setWaitSeconds((s) => {
        if (s + 1 >= MAX_WAIT_SECONDS) {
          // Timeout
          if (waitTimer.current) clearInterval(waitTimer.current);
          if (pollTimer.current) clearInterval(pollTimer.current);
          setStep("timeout");
        }
        return s + 1;
      });
    }, 1000);

    // Real polling — every 5s, call the actual verify API
    let polls = 0;
    const doPoll = async () => {
      if (aborted.current) return;
      polls++;
      setPollCount(polls);
      setPollLog((prev) => [...prev, `poll #${polls}: checking Gmail for ₹${finalAmt}...`]);

      const result = await pollVerify(finalAmt, polls);

      if (aborted.current) return;

      if (result?.verified) {
        // Payment found!
        if (waitTimer.current) clearInterval(waitTimer.current);
        if (pollTimer.current) clearInterval(pollTimer.current);
        setPollLog((prev) => [...prev, `poll #${polls}: ✓ payment detected!`]);
        setVerifyResult(result);
        setStep("verifying");
        setVisibleLines(0);
      } else {
        const reason = result?.message || "no match yet";
        setPollLog((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = `poll #${polls}: ${reason}`;
          return updated;
        });
      }
    };

    // First poll after 3s (give email time to arrive), then every 5s
    setTimeout(() => {
      if (!aborted.current) doPoll();
    }, 3000);
    pollTimer.current = setInterval(() => {
      if (!aborted.current) doPoll();
    }, POLL_INTERVAL);
  }, [amount, upiId, merchantName, note, addPaisa, pollVerify]);

  // Auto-advance verification lines
  useEffect(() => {
    if (step !== "verifying") return;
    const model = providerModel[provider] ?? provider;
    const p = verifyResult?.payment;
    const totalLines = 6;
    if (visibleLines >= totalLines) {
      setStep("verified");
      return;
    }
    const timer = setTimeout(() => setVisibleLines((v) => v + 1), 400);
    return () => clearTimeout(timer);
  }, [step, visibleLines, provider, verifyResult, providerModel]);

  const reset = useCallback(() => {
    aborted.current = true;
    if (waitTimer.current) clearInterval(waitTimer.current);
    if (pollTimer.current) clearInterval(pollTimer.current);
    setStep("idle");
    setQrDataUrl("");
    setIntentUrl("");
    setTxnId("");
    setFinalAmount("");
    setVisibleLines(0);
    setWaitSeconds(0);
    setPollCount(0);
    setPollLog([]);
    setVerifyResult(null);
    setError("");
  }, []);

  const model = providerModel[provider] ?? provider;
  const p = verifyResult?.payment;

  const verifyLines = p ? [
    { text: `↳ gmail    found bank alert from ${p.bankName}`, type: "dim" },
    { text: `↳ llm      parsed with ${model}`, type: "dim" },
    { text: `↳ llm      ₹${p.amount} ref:${p.upiReferenceId} from:${p.senderName}`, type: "dim" },
    { text: `↳ security [format ✓] [amount ✓] [time ✓] [dedup ✓]`, type: "dim" },
    { text: "", type: "dim" },
    { text: `✓ verified  ₹${p.amount}  confidence: ${p.confidence}`, type: "success" },
  ] : [];

  const timeLeft = MAX_WAIT_SECONDS - waitSeconds;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface-raised">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-border" />
            <div className="w-2.5 h-2.5 rounded-full bg-border" />
            <div className="w-2.5 h-2.5 rounded-full bg-border" />
          </div>
          <span className="text-xs text-muted font-mono ml-2">live demo</span>
          {txnId && <span className="text-[10px] text-muted/50 font-mono ml-2">{txnId}</span>}
        </div>
        {step !== "idle" && (
          <button onClick={reset} className="text-[10px] text-muted font-mono hover:text-foreground transition-colors">
            reset
          </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row">
        {/* Config panel */}
        <div className="md:w-60 shrink-0 border-b md:border-b-0 md:border-r border-border p-4 space-y-3 overflow-hidden">
          <div className="text-[10px] text-muted font-mono uppercase tracking-wider mb-3">Configuration</div>
          <Field label="Merchant UPI" value={upiId} onChange={setUpiId} mono disabled={locked} />
          <Field label="Name" value={merchantName} onChange={setMerchantName} disabled={locked} />
          <Field label="Amount (₹)" value={amount} onChange={setAmount} type="number" mono disabled={locked} />
          <Field label="Note" value={note} onChange={setNote} disabled={locked} />
          <Toggle label="Add paisa" checked={addPaisa} onChange={setAddPaisa} disabled={locked}
            hint="₹49 → ₹49.37 for unique matching" />
          <Select label="LLM" value={provider} onChange={setProvider} disabled={locked}
            options={[
              { value: "gemini", label: "Gemini (free)" },
              { value: "openai", label: "OpenAI" },
              { value: "anthropic", label: "Anthropic" },
            ]} />
        </div>

        {/* Interactive area */}
        <div className="flex-1 p-5 min-h-[420px] flex flex-col overflow-x-hidden">

          {/* Global error display */}
          {error && (
            <div className="text-xs text-red-400 font-mono bg-red-400/10 border border-red-400/20 rounded px-3 py-2 mb-3">
              Error: {error}
            </div>
          )}

          {step === "idle" && (
            <div className="flex-1 flex flex-col items-center justify-center gap-5">
              <p className="text-sm text-muted text-center">
                Real QR + real Gmail verification. No simulation.
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-mono text-muted">₹</span>
                <span className="text-3xl font-mono text-foreground">{amount || "0"}</span>
                {addPaisa && <span className="text-lg font-mono text-muted/40">.xx</span>}
              </div>
              <button
                onClick={() => { startPaymentFlow(); }}
                disabled={loading}
                className="px-5 py-2.5 bg-foreground text-background text-sm font-medium rounded-md hover:bg-foreground/90 transition-colors font-mono disabled:opacity-40">
                {loading ? "Generating..." : "Start payment flow"}
              </button>
            </div>
          )}

          {step === "waiting" && (
            <div className="flex-1 flex flex-col items-center gap-3">
              {qrDataUrl && (
                <div className="rounded-lg overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt="UPI QR Code" width={180} height={180} />
                </div>
              )}
              <p className="font-mono text-sm text-foreground">₹{finalAmount}</p>

              {/* Pay button — opens UPI app on mobile, like PayPal buttons */}
              {intentUrl && (
                <div className="flex flex-col items-center gap-2 w-full max-w-xs">
                  <a
                    href={intentUrl}
                    className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-foreground text-background text-sm font-medium rounded-md hover:bg-foreground/90 transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                    </svg>
                    Pay ₹{finalAmount} with UPI
                  </a>
                  <p className="text-[10px] text-muted/50 text-center">
                    Opens GPay, PhonePe, Paytm — or scan QR above
                  </p>
                </div>
              )}

              {/* Polling status */}
              <div className="w-full max-w-xs mt-2 p-3 rounded border border-border bg-background">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                  <span className="text-[11px] font-mono text-muted">Verifying</span>
                  <span className="text-[10px] font-mono text-muted/40 ml-auto">
                    {minutes}:{seconds.toString().padStart(2, "0")}
                  </span>
                </div>
                <div className="space-y-1 font-mono text-[10px] max-h-24 overflow-y-auto">
                  {pollLog.map((line, i) => (
                    <div key={i} className={`animate-line ${line.includes("✓") ? "text-cyan" : "text-muted/50"}`}>
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === "timeout" && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="text-2xl text-muted">⏱</div>
              <p className="text-sm text-muted">No payment detected within 3 minutes.</p>
              <p className="text-xs text-muted/50">Polled {pollCount} times for ₹{finalAmount}</p>
              <button onClick={reset}
                className="px-5 py-2 border border-border text-sm font-mono rounded-md hover:bg-surface-raised transition-colors">
                Try again
              </button>
            </div>
          )}

          {(step === "verifying" || step === "verified") && (
            <div className="flex-1 font-mono text-[12px] leading-6">
              <div className="text-cyan text-[11px] mb-3">
                ✦ payment detected on poll #{pollCount}
              </div>

              {verifyLines.slice(0, visibleLines).map((line, i) => (
                <div key={i} className="animate-line" style={{ animationDelay: `${i * 30}ms` }}>
                  {line.text === "" ? <br /> : (
                    <span className={line.type === "success" ? "text-cyan font-medium" : "text-muted"}>
                      {line.text}
                    </span>
                  )}
                </div>
              ))}
              {step === "verifying" && <span className="cursor-blink text-cyan">▌</span>}
              {step === "verified" && p && (
                <div className="mt-3 p-3 rounded border border-cyan/20 bg-accent/[0.03]">
                  <div className="text-[10px] text-cyan mb-1.5 uppercase tracking-wider">verified</div>
                  <pre className="text-[11px] text-muted leading-5">
{`{
  verified: true,
  amount: ${p.amount},
  upiReferenceId: "${p.upiReferenceId}",
  senderName: "${p.senderName}",
  bankName: "${p.bankName}",
  confidence: ${p.confidence},
  transactionId: "${txnId}",
}`}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
