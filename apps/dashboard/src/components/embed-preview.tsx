"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface EmbedPreviewProps {
  merchantId: string;
}

export function EmbedPreview({ merchantId }: EmbedPreviewProps) {
  const [amount, setAmount] = useState("499");
  const [note, setNote] = useState("");
  const [addPaisa, setAddPaisa] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [copied, setCopied] = useState(false);

  const dataAttributes = [
    `data-upiagent`,
    `data-merchant="${merchantId}"`,
    amount ? `data-amount="${amount}"` : "",
    note ? `data-note="${note}"` : "",
    addPaisa ? `data-add-paisa="true"` : "",
    theme !== "light" ? `data-theme="${theme}"` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const snippet = `<script src="https://upiagent.dev/embed.js" defer></script>\n<div ${dataAttributes}></div>`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>Customize your payment widget.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="amount">Amount (INR)</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="499"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">Note</Label>
            <Input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Payment for order #123"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="theme">Theme</Label>
            <select
              id="theme"
              value={theme}
              onChange={(e) => setTheme(e.target.value as "light" | "dark")}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={addPaisa}
                onChange={(e) => setAddPaisa(e.target.checked)}
                className="rounded border-input"
              />
              Add paisa for unique amounts
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Embed Code</CardTitle>
          <CardDescription>
            Copy this snippet and paste it into your website HTML.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <pre className="rounded-md border bg-muted p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap break-all">
            {snippet}
          </pre>
          <Button onClick={handleCopy} className="w-fit">
            {copied ? "Copied!" : "Copy to Clipboard"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            This is how the payment widget will appear on your site.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`max-w-sm mx-auto rounded-xl border p-6 flex flex-col items-center gap-4 ${
              theme === "dark"
                ? "bg-gray-900 text-white border-gray-700"
                : "bg-white text-gray-900 border-gray-200"
            }`}
          >
            <p className="text-sm font-medium">
              {note || "Pay with UPI"}
            </p>
            <div
              className={`w-40 h-40 rounded-lg flex items-center justify-center ${
                theme === "dark" ? "bg-gray-800" : "bg-gray-100"
              }`}
            >
              <span className="text-4xl">QR</span>
            </div>
            {amount && (
              <p className="text-2xl font-mono font-bold">
                ₹{Number(amount).toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            )}
            <p
              className={`text-xs ${
                theme === "dark" ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Powered by UPIAgent
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
