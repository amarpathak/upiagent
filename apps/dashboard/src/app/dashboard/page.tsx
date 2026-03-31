import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatAmount(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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

function relativeTime(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diff = Math.max(0, now - then);

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: merchant } = await supabase
    .from("merchants")
    .select("id, name, upi_id")
    .eq("user_id", user.id)
    .single();

  if (!merchant) {
    redirect("/onboarding");
  }

  const { data: payments, error } = await supabase
    .from("payments")
    .select("*")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Failed to fetch payments:", error);
  }

  const paymentsList = payments ?? [];

  // Calculate stats
  const now = new Date();
  const todayStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // For "all time" counts, we query without date filter
  const { count: allTimeCount } = await supabase
    .from("payments")
    .select("*", { count: "exact", head: true })
    .eq("merchant_id", merchant.id);

  const { data: allPaymentsForStats } = await supabase
    .from("payments")
    .select("amount, amount_with_paisa, status, overall_confidence, created_at")
    .eq("merchant_id", merchant.id);

  const allPayments = allPaymentsForStats ?? [];

  const getAmount = (p: { amount_with_paisa: number | null; amount: number }) =>
    Number(p.amount_with_paisa ?? p.amount) || 0;

  const todayPayments = allPayments.filter((p) => p.created_at >= todayStart);
  const weekPayments = allPayments.filter((p) => p.created_at >= weekStart);

  const todayCount = todayPayments.length;
  const todaySum = todayPayments.reduce((sum, p) => sum + getAmount(p), 0);

  const weekCount = weekPayments.length;
  const weekSum = weekPayments.reduce((sum, p) => sum + getAmount(p), 0);

  const allTimeSum = allPayments.reduce((sum, p) => sum + getAmount(p), 0);

  const nonPending = allPayments.filter((p) => p.status !== "pending");
  const verified = allPayments.filter((p) => p.status === "verified");
  const successRate =
    nonPending.length > 0
      ? Math.round((verified.length / nonPending.length) * 100)
      : 0;

  const withConfidence = allPayments.filter(
    (p) => p.overall_confidence != null
  );
  const avgConfidence =
    withConfidence.length > 0
      ? Math.round(
          withConfidence.reduce((sum, p) => sum + Number(p.overall_confidence), 0) /
            withConfidence.length
        )
      : 0;

  const recentPayments = paymentsList.slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">{merchant.name}</h1>
        <p className="text-sm text-muted-foreground">{merchant.upi_id}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardDescription>Today</CardDescription>
            <CardTitle className="text-2xl font-mono">
              {formatAmount(todaySum)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {todayCount} payment{todayCount !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>This Week</CardDescription>
            <CardTitle className="text-2xl font-mono">
              {formatAmount(weekSum)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {weekCount} payment{weekCount !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>All Time</CardDescription>
            <CardTitle className="text-2xl font-mono">
              {formatAmount(allTimeSum)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {allTimeCount ?? allPayments.length} payment{(allTimeCount ?? allPayments.length) !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Verification Rate</CardDescription>
            <CardTitle className="text-2xl font-mono">
              {successRate}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {verified.length} verified of {nonPending.length} resolved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Avg Confidence</CardDescription>
            <CardTitle className="text-2xl font-mono">
              {avgConfidence}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              across {withConfidence.length} payment{withConfidence.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-2xl font-mono">
              {allPayments.filter((p) => p.status === "pending").length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              awaiting verification
            </p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Recent Payments</h2>
        {recentPayments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Transaction ID</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentPayments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    <Badge
                      variant={statusVariant(payment.status)}
                      className={statusColor(payment.status)}
                    >
                      {payment.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono font-medium">
                    {formatAmount(payment.amount_with_paisa ?? payment.amount)}
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {payment.transaction_id
                      ? payment.transaction_id.length > 12
                        ? `${payment.transaction_id.slice(0, 12)}...`
                        : payment.transaction_id
                      : "\u2014"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {relativeTime(payment.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
