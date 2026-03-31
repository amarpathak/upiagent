"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { updateMerchant } from "@/app/dashboard/settings/actions";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { EyeIcon, EyeOffIcon } from "lucide-react";

interface Merchant {
  id: string;
  name: string;
  upi_id: string;
  gmail_client_id: string | null;
  gmail_client_secret: string | null;
  gmail_refresh_token: string | null;
  llm_provider: string | null;
  llm_api_key: string | null;
  webhook_url: string | null;
  enabled_sources: string[] | null;
}

export function SettingsForm({ merchant }: { merchant: Merchant }) {
  const [saving, setSaving] = useState(false);
  const [enabledSources, setEnabledSources] = useState<string[]>(
    merchant.enabled_sources || ["gmail"],
  );
  const [showLlmKey, setShowLlmKey] = useState(false);
  const searchParams = useSearchParams();

  const gmailStatus = searchParams.get("gmail");
  const gmailConnected = !!merchant.gmail_refresh_token;

  function toggleSource(source: string) {
    setEnabledSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source],
    );
  }

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    formData.set("enabled_sources", enabledSources.join(","));
    formData.set("llm_provider", "gemini"); // default
    try {
      await updateMerchant(formData);
    } catch (err) {
      console.error("Update failed:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-6 max-w-2xl">
      {/* Merchant Info */}
      <Card>
        <CardHeader>
          <CardTitle>Merchant Info</CardTitle>
          <CardDescription>Your business details</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Business name</Label>
            <Input id="name" name="name" defaultValue={merchant.name} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="upi_id">UPI ID</Label>
            <Input
              id="upi_id"
              name="upi_id"
              defaultValue={merchant.upi_id}
              required
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              The UPI ID where customers send payments
            </p>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Gmail Connection — one-click OAuth */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gmail Connection</CardTitle>
              <CardDescription>
                Connect your Gmail to read bank alert emails for payment verification
              </CardDescription>
            </div>
            {gmailConnected && (
              <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                Connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {gmailStatus === "connected" && (
            <div className="p-3 rounded-lg border border-green-500/20 bg-green-500/5 text-sm text-green-400">
              Gmail connected successfully!
              {searchParams.get("email") && (
                <span className="font-mono"> ({searchParams.get("email")})</span>
              )}
            </div>
          )}
          {gmailStatus === "error" && (
            <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-sm text-red-400">
              Failed to connect Gmail: {searchParams.get("message") || "Unknown error"}
            </div>
          )}

          {gmailConnected ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 p-3 rounded-lg border border-green-500/20 bg-green-500/5">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <div className="text-sm">
                  <span className="text-green-400 font-medium">Gmail connected</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Monitoring alerts from HDFC, SBI, ICICI, Axis, Kotak and other banks
                  </p>
                </div>
              </div>
              <a href="/api/gmail/connect" className="w-fit">
                <Button type="button" variant="outline" size="sm">
                  Reconnect with different account
                </Button>
              </a>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Connect your Gmail account to automatically detect UPI payment alerts.
                We only request <span className="font-medium text-foreground">read-only</span> access
                — upiagent never sends or modifies emails.
              </p>
              <a href="/api/gmail/connect">
                <Button type="button" className="w-fit">
                  <svg className="mr-2 w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Connect Gmail
                </Button>
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* LLM Provider */}
      <Card>
        <CardHeader>
          <CardTitle>AI Verification</CardTitle>
          <CardDescription>
            Powered by Gemini — free, included with upiagent
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm">Gemini 2.5 Flash — active</span>
            <Badge variant="outline" className="ml-auto text-xs">Free</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            upiagent uses Gemini for parsing bank alert emails. This is free and included.
            Usage is tracked per merchant.
          </p>

          <Separator />

          <details className="group">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              Bring your own API key (optional)
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                Use your own OpenAI or Anthropic key instead of the default Gemini.
              </p>
              <div className="flex flex-col gap-2">
                <Label htmlFor="llm_api_key" className="text-xs">API Key</Label>
                <div className="relative">
                  <Input
                    id="llm_api_key"
                    name="llm_api_key"
                    type={showLlmKey ? "text" : "password"}
                    placeholder="sk-... or AIza..."
                    defaultValue={merchant.llm_api_key || ""}
                    className="font-mono text-xs"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowLlmKey(!showLlmKey)}
                  >
                    {showLlmKey ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                  </button>
                </div>
              </div>
            </div>
          </details>
        </CardContent>
      </Card>

      <Separator />

      {/* Verification Sources */}
      <Card>
        <CardHeader>
          <CardTitle>Verification Sources</CardTitle>
          <CardDescription>
            How payments are verified — enable multiple for higher confidence
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="source-gmail"
              checked={enabledSources.includes("gmail")}
              onCheckedChange={() => toggleSource("gmail")}
            />
            <Label htmlFor="source-gmail" className="cursor-pointer">
              Gmail bank alerts
            </Label>
            {gmailConnected && (
              <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-500 border-green-500/30">
                Active
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="source-screenshot"
              checked={enabledSources.includes("screenshot")}
              onCheckedChange={() => toggleSource("screenshot")}
            />
            <Label htmlFor="source-screenshot" className="cursor-pointer">
              Payment screenshot upload
            </Label>
            <Badge variant="outline" className="text-[10px]">Coming soon</Badge>
          </div>
          <div className="flex items-center gap-2 opacity-40">
            <Checkbox id="source-sms" disabled />
            <Label htmlFor="source-sms">SMS alerts</Label>
            <Badge variant="outline" className="text-[10px]">Planned</Badge>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Webhook */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook</CardTitle>
          <CardDescription>
            Get notified when a payment is verified
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <Label htmlFor="webhook_url">Webhook URL</Label>
            <Input
              id="webhook_url"
              name="webhook_url"
              type="url"
              placeholder="https://yourapp.com/api/payment-webhook"
              defaultValue={merchant.webhook_url || ""}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              We&apos;ll POST payment data here when verified. HMAC-signed for security.
            </p>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={saving} className="w-fit">
        {saving ? "Saving..." : "Save changes"}
      </Button>
    </form>
  );
}
