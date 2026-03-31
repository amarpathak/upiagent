import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function OpsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: merchant } = await supabase
    .from("merchants")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!merchant) {
    redirect("/onboarding");
  }

  // Fetch all payments for this merchant
  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select("*")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false });

  if (paymentsError) {
    console.error("Failed to fetch payments:", paymentsError);
  }

  const allPayments = payments ?? [];

  // Last 24 hours filter
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const recent = allPayments.filter(
    (p) => new Date(p.created_at) >= twentyFourHoursAgo
  );

  // Verification success rate (last 24h)
  const recentWithOutcome = recent.filter(
    (p) => p.status === "verified" || p.status === "failed" || p.status === "expired"
  );
  const recentVerified = recent.filter((p) => p.status === "verified");
  const successRate =
    recentWithOutcome.length > 0
      ? ((recentVerified.length / recentWithOutcome.length) * 100).toFixed(1)
      : "N/A";

  // Average verification time (created_at -> verified_at delta)
  const verifiedPayments = allPayments.filter(
    (p) => p.status === "verified" && p.verified_at
  );
  let avgVerificationTime = "N/A";
  if (verifiedPayments.length > 0) {
    const totalMs = verifiedPayments.reduce((sum, p) => {
      const created = new Date(p.created_at).getTime();
      const verified = new Date(p.verified_at).getTime();
      return sum + (verified - created);
    }, 0);
    const avgSeconds = totalMs / verifiedPayments.length / 1000;
    if (avgSeconds < 60) {
      avgVerificationTime = `${avgSeconds.toFixed(1)}s`;
    } else {
      avgVerificationTime = `${(avgSeconds / 60).toFixed(1)}m`;
    }
  }

  // Pending payments count
  const pendingCount = allPayments.filter((p) => p.status === "pending").length;

  // Failed/expired count
  const failedExpiredCount = allPayments.filter(
    (p) => p.status === "failed" || p.status === "expired"
  ).length;

  // Fetch verification evidence
  const paymentIds = allPayments.map((p) => p.id);
  let gmailCheckCount = 0;
  let totalEvidenceCount = 0;

  if (paymentIds.length > 0) {
    const { data: evidence, error: evidenceError } = await supabase
      .from("verification_evidence")
      .select("id, source")
      .in("payment_id", paymentIds);

    if (evidenceError) {
      console.error("Failed to fetch evidence:", evidenceError);
    }

    const allEvidence = evidence ?? [];
    totalEvidenceCount = allEvidence.length;
    gmailCheckCount = allEvidence.filter((e) => e.source === "gmail").length;
  }

  // LLM usage estimate (~700 tokens per evidence entry)
  const estimatedTokens = totalEvidenceCount * 700;

  // Recent errors: last 10 failed or expired
  const recentErrors = allPayments
    .filter((p) => p.status === "failed" || p.status === "expired")
    .slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Operations</h1>
        <p className="text-sm text-muted-foreground">
          System health and diagnostics
        </p>
      </div>

      {/* Stat cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Verification Success Rate"
          description="Last 24 hours"
          value={successRate === "N/A" ? successRate : `${successRate}%`}
        />
        <StatCard
          title="Avg Verification Time"
          description="All verified payments"
          value={avgVerificationTime}
        />
        <StatCard
          title="Pending Payments"
          description="Awaiting verification"
          value={String(pendingCount)}
        />
        <StatCard
          title="Failed / Expired"
          description="All time"
          value={String(failedExpiredCount)}
        />
        <StatCard
          title="Gmail Checks"
          description="Total evidence from Gmail"
          value={String(gmailCheckCount)}
        />
        <StatCard
          title="Est. LLM Token Usage"
          description={`${totalEvidenceCount} evidence entries x ~700 tokens`}
          value={estimatedTokens.toLocaleString()}
        />
      </div>

      {/* Recent errors */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Errors</CardTitle>
          <CardDescription>
            Last 10 failed or expired payments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentErrors.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No failed or expired payments found.
            </p>
          ) : (
            <div className="space-y-3">
              {recentErrors.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium font-mono">
                      {payment.transaction_id}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(payment.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono">
                      &#8377;{payment.amount}
                    </span>
                    <Badge
                      variant={
                        payment.status === "failed"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {payment.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  title,
  description,
  value,
}: {
  title: string;
  description: string;
  value: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{description}</CardDescription>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold font-mono">{value}</p>
      </CardContent>
    </Card>
  );
}
