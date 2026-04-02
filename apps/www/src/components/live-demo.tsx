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
        className={`bg-background border border-border rounded px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent-green disabled:opacity-40 disabled:cursor-not-allowed ${mono ? "font-mono" : ""}`} />
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
        className="bg-background border border-border rounded px-2.5 py-1.5 text-sm text-foreground font-mono focus:outline-none focus:border-accent-green appearance-none disabled:opacity-40">
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
        disabled={disabled} className="mt-0.5 accent-accent-green" />
      <div>
        <span className="text-[10px] text-muted font-mono uppercase tracking-wider">{label}</span>
        {hint && <p className="text-[10px] text-muted/50 mt-0.5">{hint}</p>}
      </div>
    </label>
  );
}

const MAX_WAIT_SECONDS = 180;

export function LiveDemo() {
  const [upiId, setUpiId] = useState("amarpathakhdfc@ybl");
  const [merchantName, setMerchantName] = useState("upiagent demo");
  const [amount, setAmount] = useState("1");
  const [note, setNote] = useState("Order #2847");
  const [accountHolder, setAccountHolder] = useState("AMAR KUMAR PATHAK");
  const [provider, setProvider] = useState("gemini");
  const [addPaisa, setAddPaisa] = useState(true);

  const [step, setStep] = useState<DemoStep>("idle");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [intentUrl, setIntentUrl] = useState("");
  const [txnId, setTxnId] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [finalAmount, setFinalAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [statusLog, setStatusLog] = useState<string[]>([]);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [visibleLines, setVisibleLines] = useState(0);
  const [error, setError] = useState("");

  const waitTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const aborted = useRef(false);

  const locked = step !== "idle";

  const providerModel: Record<string, string> = {
    gemini: "gemini-2.0-flash-lite",
    openai: "gpt-4o-mini",
    anthropic: "claude-3-haiku",
  };

  const startPaymentFlow = useCallback(async () => {
    setError("");
    const num = parseFloat(amount);
    if (!num || num < 1 || num > 3) {
      setError("Demo amount: ₹1–3 only");
      return;
    }

    aborted.current = false;
    setLoading(true);

    let data;
    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: num, upiId, merchantName, note, addPaisa }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      data = await res.json();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate QR");
      setLoading(false);
      return;
    }
    setLoading(false);

    setQrDataUrl(data.qrDataUrl);
    setIntentUrl(data.intentUrl);
    setTxnId(data.transactionId);
    setFinalAmount(data.amount.toFixed(2));
    setStatusLog(["waiting for bank email..."]);
    setVerifyResult(null);
    setStep("waiting");
    setWaitSeconds(0);

    // Countdown timer
    waitTimer.current = setInterval(() => {
      setWaitSeconds((s) => {
        if (s + 1 >= MAX_WAIT_SECONDS) {
          clearInterval(waitTimer.current!);
          esRef.current?.close();
          setStep("timeout");
        }
        return s + 1;
      });
    }, 1000);

    // SSE — server pushes result the moment Gmail notifies us, no polling
    const es = new EventSource(`/api/demo/stream?txnId=${encodeURIComponent(data.transactionId)}`);
    esRef.current = es;

    es.addEventListener("connected", () => {
      setStatusLog(["connected — watching inbox for bank email..."]);
    });

    es.addEventListener("heartbeat", () => {
      setStatusLog((prev) => [...prev.slice(-4), "still watching..."]);
    });

    es.addEventListener("verified", (e: MessageEvent) => {
      if (aborted.current) return;
      clearInterval(waitTimer.current!);
      es.close();
      const payload = JSON.parse(e.data);
      setVerifyResult({
        verified: true,
        payment: {
          amount: payload.payment.amount,
          upiReferenceId: payload.payment.upiReferenceId || "",
          senderName: payload.payment.senderName || "",
          bankName: payload.payment.bankName || "",
          confidence: payload.confidence || 0,
        },
      });
      setStep("verifying");
      setVisibleLines(0);
    });

    es.addEventListener("expired", () => {
      if (aborted.current) return;
      clearInterval(waitTimer.current!);
      es.close();
      setStep("timeout");
    });

    es.onerror = () => {
      if (aborted.current) return;
      setStatusLog((prev) => [...prev, "connection dropped — retrying..."]);
    };
  }, [amount, upiId, merchantName, note, addPaisa]);

  // Auto-advance verification lines
  useEffect(() => {
    if (step !== "verifying") return;
    const totalLines = 6;
    if (visibleLines >= totalLines) {
      setStep("verified");
      return;
    }
    const timer = setTimeout(() => setVisibleLines((v) => v + 1), 400);
    return () => clearTimeout(timer);
  }, [step, visibleLines]);

  const reset = useCallback(() => {
    aborted.current = true;
    if (waitTimer.current) clearInterval(waitTimer.current);
    esRef.current?.close();
    esRef.current = null;
    setStep("idle");
    setQrDataUrl("");
    setIntentUrl("");
    setTxnId("");
    setFinalAmount("");
    setVisibleLines(0);
    setWaitSeconds(0);
    setStatusLog([]);
    setVerifyResult(null);
    setError("");
  }, []);

  const model = providerModel[provider] ?? provider;
  const p = verifyResult?.payment;

  const verifyLines = p ? [
    { text: `↳ source   found bank alert from ${p.bankName || "bank"}`, type: "dim" },
    { text: `↳ llm      parsed with ${model}`, type: "dim" },
    { text: `↳ llm      ₹${p.amount} ref:${p.upiReferenceId} from:${p.senderName}`, type: "dim" },
    { text: `↳ security [format ✓] [amount ✓] [time ✓] [dedup ✓]`, type: "dim" },
    { text: "", type: "dim" },
    { text: `✓ payment verified  ₹${p.amount}  confidence: ${p.confidence}`, type: "success" },
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
        <div className={`shrink-0 border-b md:border-b-0 md:border-r border-border overflow-hidden transition-all ${showConfig ? "md:w-60 p-4" : "md:w-10 p-2"}`}>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="text-[10px] text-muted font-mono uppercase tracking-wider mb-3 hover:text-foreground transition-colors flex items-center gap-1"
          >
            <svg className={`w-3 h-3 transition-transform ${showConfig ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            {showConfig ? "Config" : ""}
          </button>
          <div className={showConfig ? "space-y-3" : "hidden"}>
            <Field label="Merchant UPI" value={upiId} onChange={setUpiId} mono disabled={locked} />
            <Field label="Brand name" value={merchantName} onChange={setMerchantName} disabled={locked} />
            <Field label="Bank account name" value={accountHolder} onChange={setAccountHolder} disabled={locked} />
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
        </div>

        {/* Interactive area */}
        <div className="flex-1 p-5 min-h-[420px] flex flex-col overflow-x-hidden">

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
                onClick={startPaymentFlow}
                disabled={loading}
                className="px-5 py-2.5 bg-foreground text-background text-sm font-medium rounded-md hover:bg-foreground/90 transition-colors font-mono disabled:opacity-40">
                {loading ? "Generating..." : "Start payment flow"}
              </button>
            </div>
          )}

          {step === "waiting" && (
            <div className="flex-1 flex flex-col items-center gap-3">
              <div className="text-[10px] text-muted/50 font-mono uppercase tracking-wider self-start mb-1">
                Customer payment page
              </div>

              <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5 space-y-4">
                <div className="text-center space-y-1">
                  <div className="w-10 h-10 rounded-full bg-surface-raised border border-border mx-auto flex items-center justify-center text-sm font-semibold">
                    {merchantName.charAt(0).toUpperCase()}
                  </div>
                  <p className="font-semibold text-foreground">{merchantName}</p>
                  {note && <p className="text-xs text-muted">{note}</p>}
                </div>

                <div className="text-center">
                  <p className="text-3xl font-mono font-bold text-foreground">₹{finalAmount}</p>
                </div>

                {qrDataUrl && (
                  <div className="flex justify-center">
                    <div className="rounded-lg overflow-hidden border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrDataUrl} alt="UPI QR Code" width={160} height={160} />
                    </div>
                  </div>
                )}

                {accountHolder && (
                  <div className="p-2 rounded-md bg-yellow-500/5 border border-yellow-500/15">
                    <p className="text-[11px] text-yellow-500/80 text-center leading-relaxed">
                      Your UPI app will show <span className="font-semibold">&quot;{accountHolder}&quot;</span> — that&apos;s the account holder for {merchantName}
                    </p>
                  </div>
                )}

                {intentUrl && (
                  <a
                    href={intentUrl}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-foreground text-background text-sm font-semibold rounded-lg hover:bg-foreground/90 transition-colors"
                  >
                    Pay ₹{finalAmount} with UPI
                  </a>
                )}

                <p className="text-[10px] text-muted/40 text-center">
                  Paying to <span className="font-mono">{upiId}</span> · Scan QR or tap button
                </p>
              </div>

              {/* SSE status */}
              <div className="w-full max-w-sm mt-1 p-3 rounded border border-border bg-background">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                  <span className="text-[11px] font-mono text-muted">Listening for payment</span>
                  <span className="text-[10px] font-mono text-muted/40 ml-auto">
                    {minutes}:{seconds.toString().padStart(2, "0")}
                  </span>
                </div>
                <div className="space-y-1 font-mono text-[10px] max-h-24 overflow-y-auto">
                  {statusLog.map((line, i) => (
                    <div key={i} className={`animate-line ${line.includes("✓") ? "text-accent-green" : "text-muted/50"}`}>
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
              <button onClick={reset}
                className="px-5 py-2 border border-border text-sm font-mono rounded-md hover:bg-surface-raised transition-colors">
                Try again
              </button>
            </div>
          )}

          {(step === "verifying" || step === "verified") && (
            <div className="flex-1 font-mono text-[12px] leading-6">
              <div className="text-accent-green text-[11px] mb-3">
                ✦ payment detected
              </div>

              {verifyLines.slice(0, visibleLines).map((line, i) => (
                <div key={i} className="animate-line" style={{ animationDelay: `${i * 30}ms` }}>
                  {line.text === "" ? <br /> : (
                    <span className={line.type === "success" ? "text-accent-green font-medium" : "text-muted"}>
                      {line.text}
                    </span>
                  )}
                </div>
              ))}
              {step === "verifying" && <span className="cursor-blink text-accent-green">▌</span>}
              {step === "verified" && p && (
                <div className="mt-3 p-3 rounded border border-accent-green/20 bg-accent-blue/[0.03]">
                  <div className="text-[10px] text-accent-green mb-1.5 uppercase tracking-wider">verified</div>
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
