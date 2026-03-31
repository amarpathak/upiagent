"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { createPaymentAction } from "@/app/dashboard/create/actions";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Generating QR..." : "Generate QR"}
    </Button>
  );
}

export function CreatePaymentForm() {
  const [amount, setAmount] = useState("");
  const [addPaisa, setAddPaisa] = useState(true);

  const numericAmount = parseFloat(amount);
  const hasValidAmount = !isNaN(numericAmount) && numericAmount > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Payment</CardTitle>
        <CardDescription>
          Generate a UPI QR code for collecting payment.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={createPaymentAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="amount">Amount (INR)</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {hasValidAmount && (
              <p className="text-sm text-muted-foreground">
                {addPaisa
                  ? `Customer pays: \u20B9${numericAmount}.xx (random paisa)`
                  : `Customer pays: \u20B9${numericAmount.toFixed(2)}`}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Input
              id="note"
              name="note"
              type="text"
              placeholder="e.g. Coffee order #42"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="addPaisa"
              checked={addPaisa}
              onCheckedChange={(checked) => setAddPaisa(checked)}
            />
            <input type="hidden" name="addPaisa" value={addPaisa ? "on" : "off"} />
            <Label htmlFor="addPaisa" className="cursor-pointer">
              Add random paisa for unique amount
            </Label>
          </div>

          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}
