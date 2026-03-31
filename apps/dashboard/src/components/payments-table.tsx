"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Payment {
  id: string;
  status: string;
  amount: number;
  amount_with_paisa: number | null;
  transaction_id: string;
  sender_name: string | null;
  verification_source: string | null;
  confidence_score: number | null;
  created_at: string;
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

function statusLabel(status: string): string {
  switch (status) {
    case "verified": return "detected";
    case "pending": return "pending";
    case "failed": return "failed";
    case "expired": return "expired";
    default: return status;
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

function confidenceColor(score: number): string {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 50) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function formatAmount(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PaymentsTable({ payments }: { payments: Payment[] }) {
  const [search, setSearch] = useState("");
  const router = useRouter();

  const filtered = payments.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.transaction_id?.toLowerCase().includes(q) ||
      p.sender_name?.toLowerCase().includes(q)
    );
  });

  if (payments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground">
          No payments yet. Create your first payment.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Input
        placeholder="Search by transaction ID or sender name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Transaction ID</TableHead>
            <TableHead>Sender</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Confidence</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((payment) => (
            <TableRow
              key={payment.id}
              className="cursor-pointer"
              onClick={() =>
                router.push(`/dashboard/payments/${payment.id}`)
              }
            >
              <TableCell>
                <Badge
                  variant={statusVariant(payment.status)}
                  className={statusColor(payment.status)}
                >
                  {statusLabel(payment.status)}
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
              <TableCell>{payment.sender_name || "\u2014"}</TableCell>
              <TableCell className="text-muted-foreground">
                {payment.verification_source || "\u2014"}
              </TableCell>
              <TableCell>
                {payment.confidence_score != null ? (
                  <span
                    className={`font-mono font-medium ${confidenceColor(payment.confidence_score)}`}
                  >
                    {Math.round(payment.confidence_score)}%
                  </span>
                ) : (
                  "\u2014"
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {relativeTime(payment.created_at)}
              </TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                No payments match your search.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
