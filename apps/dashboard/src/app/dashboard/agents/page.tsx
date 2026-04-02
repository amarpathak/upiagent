import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function formatDate(dateString: string | null): string {
  if (!dateString) return "\u2014";
  return new Date(dateString).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function relativeTime(dateString: string): string {
  const diff = Math.max(0, Date.now() - new Date(dateString).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface EvidenceRow {
  id: string;
  payment_id: string;
  source: string;
  status: string;
  confidence: number | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw_data: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layer_results: any;
  llm_total_tokens: number;
  llm_call_count: number;
  created_at: string;
  extracted_amount: number | null;
  extracted_sender: string | null;
  extracted_bank: string | null;
}

interface PaymentInfo {
  id: string;
  amount: number;
  amount_with_paisa: number | null;
  status: string;
  transaction_id: string;
  created_at: string;
}

export default async function AgentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: merchant } = await supabase
    .from("merchants")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!merchant) redirect("/onboarding");

  const svc = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Get payments with their evidence
  const { data: payments } = await svc
    .from("payments")
    .select("id, amount, amount_with_paisa, status, transaction_id, created_at")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const paymentIds = (payments ?? []).map((p: PaymentInfo) => p.id);

  const { data: evidence } = paymentIds.length > 0
    ? await svc
        .from("verification_evidence")
        .select("id, payment_id, source, status, confidence, raw_data, layer_results, llm_total_tokens, llm_call_count, created_at, extracted_amount, extracted_sender, extracted_bank")
        .in("payment_id", paymentIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  // Group evidence by payment
  const evidenceByPayment = new Map<string, EvidenceRow[]>();
  for (const ev of (evidence ?? []) as EvidenceRow[]) {
    const list = evidenceByPayment.get(ev.payment_id) ?? [];
    list.push(ev);
    evidenceByPayment.set(ev.payment_id, list);
  }

  const paymentsList = (payments ?? []) as PaymentInfo[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Agents</h1>
        <p className="text-sm text-muted-foreground">
          Verification pipeline runs grouped by payment — expand to see full traces.
        </p>
      </div>

      {paymentsList.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No payments yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {paymentsList.map((payment) => {
            const runs = evidenceByPayment.get(payment.id) ?? [];
            const lastRun = runs[runs.length - 1];
            const hasMatch = runs.some((r) => r.status === "match");
            const totalTokens = runs.reduce((s, r) => s + (r.llm_total_tokens ?? 0), 0);
            const totalCalls = runs.reduce((s, r) => s + (r.llm_call_count ?? 0), 0);
            const amt = Number(payment.amount_with_paisa ?? payment.amount);

            return (
              <Card key={payment.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-3">
                      <span className="font-mono text-base">₹{amt.toFixed(2)}</span>
                      <span className="text-xs font-mono text-muted-foreground">{payment.transaction_id}</span>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={hasMatch ? "default" : payment.status === "pending" ? "secondary" : "outline"}
                        className={
                          hasMatch ? "bg-green-500/15 text-green-400 text-[10px]" :
                          payment.status === "pending" ? "bg-yellow-500/15 text-yellow-400 text-[10px]" :
                          "text-[10px]"
                        }
                      >
                        {hasMatch ? "verified" : payment.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{relativeTime(payment.created_at)}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {runs.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No agent runs yet</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {/* Summary bar */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                        <span>{runs.length} run{runs.length !== 1 ? "s" : ""}</span>
                        {totalTokens > 0 && <span className="font-mono">{totalTokens} tokens</span>}
                        {totalCalls > 0 && <span className="font-mono">{totalCalls} LLM calls</span>}
                        {hasMatch && lastRun?.raw_data?.verify_latency_ms != null && (
                          <span className="font-mono text-green-400">
                            verified in {Math.round(Number(lastRun.raw_data.verify_latency_ms) / 1000)}s
                          </span>
                        )}
                        {!!lastRun?.raw_data?.model && (
                          <span className="font-mono">{String(lastRun.raw_data.model)}</span>
                        )}
                      </div>

                      {/* Timeline */}
                      {runs.map((run, i) => (
                        <details key={run.id} className="group" open={i === runs.length - 1 && !hasMatch}>
                          <summary className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer text-xs">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${
                              run.status === "match" ? "bg-green-500" : "bg-muted-foreground"
                            }`} />
                            <span className="font-mono text-muted-foreground w-4">{i + 1}.</span>
                            <span className={run.status === "match" ? "text-green-400" : "text-foreground"}>
                              {String(run.raw_data?.agent ?? run.source)}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              run.status === "match" ? "bg-green-500/15 text-green-400" : "bg-muted text-muted-foreground"
                            }`}>
                              {run.status}
                            </span>
                            {run.extracted_amount != null && (
                              <span className="font-mono text-muted-foreground">₹{run.extracted_amount}</span>
                            )}
                            {!!run.raw_data?.failure_reason && run.status !== "match" && (
                              <span className="text-red-400 text-[10px] truncate max-w-[200px]">
                                {String(run.raw_data.failure_reason)}
                              </span>
                            )}
                            <span className="ml-auto text-muted-foreground">{formatDate(run.created_at)}</span>
                          </summary>

                          <div className="ml-8 mt-1 mb-2 flex flex-col gap-2">
                            {/* Failure details */}
                            {!!run.raw_data?.failure_details && run.status !== "match" && (
                              <div className="p-2 rounded border border-red-500/20 bg-red-500/5 text-xs text-red-400">
                                {String(run.raw_data.failure_details)}
                              </div>
                            )}

                            {/* Security layers */}
                            {run.layer_results ? (
                              <div className="flex flex-wrap gap-2 text-xs">
                                {Object.entries(run.layer_results as Record<string, unknown>).map(([layer, passed]) => (
                                  <span key={layer} className={String(passed) === "true" ? "text-green-400" : "text-red-400"}>
                                    {String(passed) === "true" ? "\u2713" : "\u2717"} {layer}
                                  </span>
                                ))}
                              </div>
                            ) : null}

                            {/* LLM Response */}
                            {run.raw_data?.llm_response && (
                              <details>
                                <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">
                                  LLM Response
                                </summary>
                                <pre className="mt-1 p-2 rounded bg-muted text-[10px] font-mono overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
                                  {JSON.stringify(run.raw_data.llm_response, null, 2)}
                                </pre>
                              </details>
                            )}

                            {/* Pipeline trace */}
                            {Array.isArray(run.raw_data?.steps) && (run.raw_data!.steps as unknown[]).length > 0 && (
                              <details>
                                <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">
                                  Pipeline Trace ({(run.raw_data!.steps as unknown[]).length} steps)
                                </summary>
                                <div className="mt-1 flex flex-col gap-0.5">
                                  {(run.raw_data!.steps as { step: string; ts: string; [key: string]: unknown }[]).map((step, j) => (
                                    <div key={j} className="flex gap-2 text-[10px] font-mono leading-relaxed">
                                      <span className="text-muted-foreground shrink-0 w-4 text-right">{j + 1}</span>
                                      <span className={
                                        step.step.includes("verified") ? "text-green-400 shrink-0" :
                                        step.step.includes("no_match") || step.step.includes("skipped") ? "text-red-400 shrink-0" :
                                        "text-foreground shrink-0"
                                      }>
                                        {step.step}
                                      </span>
                                      <span className="text-muted-foreground truncate">
                                        {Object.entries(step)
                                          .filter(([k]) => k !== "step" && k !== "ts" && k !== "response" && k !== "layers")
                                          .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
                                          .join(" ")}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}
                          </div>
                        </details>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
