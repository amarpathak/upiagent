import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function statusColor(status: string) {
  switch (status) {
    case "verified":
      return "bg-green-500/15 text-green-700 dark:text-green-400";
    case "pending":
      return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400";
    case "failed":
      return "bg-red-500/15 text-red-700 dark:text-red-400";
    case "expired":
      return "bg-gray-500/15 text-gray-700 dark:text-gray-400";
    default:
      return "";
  }
}

function statusVariant(status: string) {
  switch (status) {
    case "verified":
      return "default" as const;
    case "pending":
      return "secondary" as const;
    case "failed":
      return "destructive" as const;
    case "expired":
      return "outline" as const;
    default:
      return "secondary" as const;
  }
}

function confidenceBarColor(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "\u2014";
  return new Date(dateString).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function securityCheck(value: boolean | null | undefined, label: string) {
  const passed = value === true;
  return (
    <span className={passed ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
      {passed ? "\u2713" : "\u2717"} {label}
    </span>
  );
}

export default async function PaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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

  const { data: payment, error } = await supabase
    .from("payments")
    .select("*")
    .eq("id", id)
    .eq("merchant_id", merchant.id)
    .single();

  if (error || !payment) {
    console.error("Failed to fetch payment:", error);
    notFound();
  }

  const { data: evidence, error: evidenceError } = await supabase
    .from("verification_evidence")
    .select("*")
    .eq("payment_id", payment.id)
    .order("created_at", { ascending: true });

  if (evidenceError) {
    console.error("Failed to fetch verification evidence:", evidenceError);
  }

  const evidenceList = evidence ?? [];

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <Link
        href="/dashboard/payments"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        &larr; Back to payments
      </Link>

      <div className="flex items-start gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Badge
              variant={statusVariant(payment.status)}
              className={`${statusColor(payment.status)} text-sm px-3 py-1`}
            >
              {payment.status}
            </Badge>
          </div>
          <p className="text-3xl font-mono font-bold">
            ₹
            {Number(payment.amount).toLocaleString("en-IN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Transaction ID</p>
          <p className="font-mono text-sm">{payment.transaction_id || "\u2014"}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Created</p>
          <p className="text-sm">{formatDate(payment.created_at)}</p>
        </div>
        {payment.verified_at && (
          <div>
            <p className="text-sm text-muted-foreground">Verified at</p>
            <p className="text-sm">{formatDate(payment.verified_at)}</p>
          </div>
        )}
        {payment.intent_url && (
          <div>
            <p className="text-sm text-muted-foreground">Intent URL</p>
            <p className="font-mono text-xs break-all select-all">
              {payment.intent_url}
            </p>
          </div>
        )}
      </div>

      {payment.qr_data_url && (
        <>
          <Separator />
          <div>
            <p className="text-sm text-muted-foreground mb-2">QR Code</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={payment.qr_data_url}
              alt="Payment QR Code"
              className="w-48 h-48 rounded-lg border"
            />
          </div>
        </>
      )}

      {payment.status === "verified" && (
        <>
          <Separator />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {payment.sender_name && (
              <div>
                <p className="text-sm text-muted-foreground">Sender</p>
                <p className="text-sm font-medium">{payment.sender_name}</p>
              </div>
            )}
            {payment.sender_upi_id && (
              <div>
                <p className="text-sm text-muted-foreground">Sender UPI ID</p>
                <p className="font-mono text-sm">{payment.sender_upi_id}</p>
              </div>
            )}
            {payment.upi_ref && (
              <div>
                <p className="text-sm text-muted-foreground">UPI Reference</p>
                <p className="font-mono text-sm">{payment.upi_ref}</p>
              </div>
            )}
            {payment.bank_name && (
              <div>
                <p className="text-sm text-muted-foreground">Bank</p>
                <p className="text-sm">{payment.bank_name}</p>
              </div>
            )}
          </div>
        </>
      )}

      <Separator />

      <div>
        <h2 className="text-lg font-semibold mb-4">Verification Evidence</h2>
        {evidenceList.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Waiting for verification...
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {evidenceList.map((ev) => (
              <Card key={ev.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs">
                        {ev.source === "sms" ? "\u2709" : ev.source === "screenshot" ? "\ud83d\uddbc" : "\u2699"}
                      </span>
                      {ev.source}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {formatDate(ev.created_at)}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {ev.confidence_score != null && (
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Confidence</span>
                        <span className="font-mono font-medium">
                          {Math.round(ev.confidence_score)}%
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${confidenceBarColor(ev.confidence_score)}`}
                          style={{ width: `${Math.min(100, Math.max(0, ev.confidence_score))}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {ev.extracted_data && (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {ev.extracted_data.amount != null && (
                        <div>
                          <span className="text-muted-foreground text-xs">Amount</span>
                          <p className="font-mono">₹{ev.extracted_data.amount}</p>
                        </div>
                      )}
                      {ev.extracted_data.upi_ref && (
                        <div>
                          <span className="text-muted-foreground text-xs">UPI Ref</span>
                          <p className="font-mono text-xs">{ev.extracted_data.upi_ref}</p>
                        </div>
                      )}
                      {ev.extracted_data.sender && (
                        <div>
                          <span className="text-muted-foreground text-xs">Sender</span>
                          <p>{ev.extracted_data.sender}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {ev.security_layers && (
                    <div className="flex flex-wrap gap-3 text-xs">
                      {securityCheck(ev.security_layers.format_valid, "format")}
                      {securityCheck(ev.security_layers.amount_match, "amount")}
                      {securityCheck(ev.security_layers.time_valid, "time")}
                      {securityCheck(ev.security_layers.dedup_pass, "dedup")}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
