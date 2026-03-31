import { createClient } from "@supabase/supabase-js";

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ txn_id: string }>;
}) {
  const { txn_id } = await params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase environment variables for verify page");
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-xl font-bold text-foreground mb-2">
            Service Unavailable
          </h1>
          <p className="text-sm text-muted">
            Verification service is temporarily unavailable.
          </p>
        </div>
      </main>
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: payment, error } = await supabase
    .from("payments")
    .select(
      "id, transaction_id, amount, status, created_at, verified_at, upi_ref, bank_name, merchant_id"
    )
    .eq("transaction_id", txn_id)
    .single();

  if (error || !payment) {
    console.error("Failed to fetch payment:", error);
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 rounded-full border border-border bg-surface-raised flex items-center justify-center mx-auto mb-4">
            <span className="text-muted text-lg">?</span>
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">
            Payment Not Found
          </h1>
          <p className="text-sm text-muted">
            No payment found for transaction ID{" "}
            <code className="font-mono text-foreground/70 bg-surface-raised px-1.5 py-0.5 rounded text-xs">
              {txn_id}
            </code>
          </p>
        </div>
      </main>
    );
  }

  // Fetch merchant name
  let merchantName = "Unknown Merchant";
  if (payment.merchant_id) {
    const { data: merchant } = await supabase
      .from("merchants")
      .select("name")
      .eq("id", payment.merchant_id)
      .single();
    if (merchant) {
      merchantName = merchant.name;
    }
  }

  // Mask UPI ref - show only last 4 digits
  const maskedUpiRef = payment.upi_ref
    ? "****" + payment.upi_ref.slice(-4)
    : null;

  const statusConfig: Record<
    string,
    { label: string; color: string; bg: string }
  > = {
    verified: {
      label: "Payment Detected",
      color: "text-emerald-400",
      bg: "bg-emerald-400/10 border-emerald-400/20",
    },
    pending: {
      label: "Pending",
      color: "text-amber-400",
      bg: "bg-amber-400/10 border-amber-400/20",
    },
    failed: {
      label: "Failed",
      color: "text-red-400",
      bg: "bg-red-400/10 border-red-400/20",
    },
    expired: {
      label: "Expired",
      color: "text-muted",
      bg: "bg-muted/10 border-muted/20",
    },
  };

  const status = statusConfig[payment.status] ?? statusConfig.pending;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
      {/* Nav bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-6 h-14">
          <a
            href="/"
            className="font-mono text-sm font-medium text-foreground tracking-tight"
          >
            upiagent
          </a>
          <span className="text-xs text-muted font-mono">
            Payment Verification
          </span>
        </div>
      </nav>

      <div className="w-full max-w-md">
        {/* Status badge */}
        <div className="text-center mb-8">
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium ${status.bg} ${status.color}`}
          >
            {payment.status === "verified" && (
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
            {payment.status === "pending" && (
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            )}
            {(payment.status === "failed" || payment.status === "expired") && (
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M15 9l-6 6M9 9l6 6" />
              </svg>
            )}
            {status.label}
          </div>
        </div>

        {/* Payment details card */}
        <div className="rounded-xl border border-border bg-surface p-6 space-y-5">
          {/* Amount */}
          <div className="text-center pb-5 border-b border-border">
            <p className="text-xs text-muted font-mono uppercase tracking-wider mb-1">
              Amount
            </p>
            <p className="text-3xl font-bold text-foreground font-mono">
              &#8377;{payment.amount}
            </p>
          </div>

          {/* Details grid */}
          <div className="space-y-4">
            <DetailRow label="Merchant" value={merchantName} />
            <DetailRow label="Transaction ID" value={payment.transaction_id} mono />
            <DetailRow
              label="Created"
              value={new Date(payment.created_at).toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            />

            {payment.status === "verified" && (
              <>
                {maskedUpiRef && (
                  <DetailRow label="UPI Reference" value={maskedUpiRef} mono />
                )}
                {payment.bank_name && (
                  <DetailRow label="Bank" value={payment.bank_name} />
                )}
                {payment.verified_at && (
                  <DetailRow
                    label="Detected At"
                    value={new Date(payment.verified_at).toLocaleString(
                      "en-IN",
                      {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }
                    )}
                  />
                )}
              </>
            )}

            {payment.status === "pending" && (
              <div className="rounded-lg bg-amber-400/5 border border-amber-400/10 p-3 text-center">
                <p className="text-sm text-amber-400">
                  Payment not yet confirmed
                </p>
              </div>
            )}

            {payment.status === "failed" && (
              <div className="rounded-lg bg-red-400/5 border border-red-400/10 p-3 text-center">
                <p className="text-sm text-red-400">
                  Payment verification failed
                </p>
              </div>
            )}

            {payment.status === "expired" && (
              <div className="rounded-lg bg-muted/5 border border-muted/10 p-3 text-center">
                <p className="text-sm text-muted">
                  Payment has expired
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-muted/50 font-mono mt-6">
          Detected by upiagent
        </p>
      </div>
    </main>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-muted shrink-0">{label}</span>
      <span
        className={`text-sm text-foreground/90 text-right truncate ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
