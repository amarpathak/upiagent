"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface WebhookDelivery {
  id: string;
  status_code: number | null;
  attempt_number: number;
  created_at: string;
  payment_id: string;
  payments: {
    amount: number;
    amount_with_paisa: number | null;
  }[] | { amount: number; amount_with_paisa: number | null } | null;
}

function formatAmount(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusCodeColor(code: number | null): string {
  if (code === null) return "bg-gray-500/15 text-gray-700 dark:text-gray-400";
  if (code >= 200 && code < 300)
    return "bg-green-500/15 text-green-700 dark:text-green-400";
  if (code >= 400 && code < 500)
    return "bg-red-500/15 text-red-700 dark:text-red-400";
  if (code >= 500)
    return "bg-red-500/15 text-red-700 dark:text-red-400";
  return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400";
}

function statusCodeVariant(code: number | null) {
  if (code === null) return "secondary" as const;
  if (code >= 200 && code < 300) return "default" as const;
  return "destructive" as const;
}

export function WebhookLog({
  deliveries,
}: {
  deliveries: WebhookDelivery[];
}) {
  if (deliveries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No webhook deliveries yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Timestamp</TableHead>
          <TableHead>Payment Amount</TableHead>
          <TableHead>Status Code</TableHead>
          <TableHead>Attempt</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {deliveries.map((delivery) => (
          <TableRow key={delivery.id}>
            <TableCell className="text-muted-foreground">
              {formatDate(delivery.created_at)}
            </TableCell>
            <TableCell className="font-mono font-medium">
              {delivery.payments
                ? (() => {
                    const p = Array.isArray(delivery.payments)
                      ? delivery.payments[0]
                      : delivery.payments;
                    return p
                      ? formatAmount(p.amount_with_paisa ?? p.amount)
                      : "\u2014";
                  })()
                : "\u2014"}
            </TableCell>
            <TableCell>
              <Badge
                variant={statusCodeVariant(delivery.status_code)}
                className={statusCodeColor(delivery.status_code)}
              >
                {delivery.status_code ?? "pending"}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              #{delivery.attempt_number}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
