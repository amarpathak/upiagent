"use client";

import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
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

interface SettingsFormProps {
  merchant: Merchant;
}

export function SettingsForm({ merchant }: SettingsFormProps) {
  const [saving, setSaving] = useState(false);
  const [llmProvider, setLlmProvider] = useState(
    merchant.llm_provider || "gemini"
  );
  const [enabledSources, setEnabledSources] = useState<string[]>(
    merchant.enabled_sources || []
  );
  const [showClientId, setShowClientId] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [showRefreshToken, setShowRefreshToken] = useState(false);
  const [showLlmKey, setShowLlmKey] = useState(false);

  function toggleSource(source: string) {
    setEnabledSources((prev) =>
      prev.includes(source)
        ? prev.filter((s) => s !== source)
        : [...prev, source]
    );
  }

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    formData.set("enabled_sources", enabledSources.join(","));
    formData.set("llm_provider", llmProvider);
    try {
      const result = await updateMerchant(formData);
      if (result.error) {
        console.error("Update failed:", result.error);
      }
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
          <CardDescription>Basic business details</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Business name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={merchant.name}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="upi_id">UPI ID</Label>
            <Input
              id="upi_id"
              name="upi_id"
              defaultValue={merchant.upi_id}
              required
            />
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Gmail Connection */}
      <Card>
        <CardHeader>
          <CardTitle>Gmail Connection</CardTitle>
          <CardDescription>
            Credentials for reading payment confirmation emails
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="gmail_client_id">Client ID</Label>
            <div className="relative">
              <Input
                id="gmail_client_id"
                name="gmail_client_id"
                type={showClientId ? "text" : "password"}
                defaultValue={merchant.gmail_client_id || ""}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowClientId(!showClientId)}
              >
                {showClientId ? (
                  <EyeOffIcon className="size-4" />
                ) : (
                  <EyeIcon className="size-4" />
                )}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="gmail_client_secret">Client Secret</Label>
            <div className="relative">
              <Input
                id="gmail_client_secret"
                name="gmail_client_secret"
                type={showClientSecret ? "text" : "password"}
                defaultValue={merchant.gmail_client_secret || ""}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowClientSecret(!showClientSecret)}
              >
                {showClientSecret ? (
                  <EyeOffIcon className="size-4" />
                ) : (
                  <EyeIcon className="size-4" />
                )}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="gmail_refresh_token">Refresh Token</Label>
            <div className="relative">
              <Input
                id="gmail_refresh_token"
                name="gmail_refresh_token"
                type={showRefreshToken ? "text" : "password"}
                defaultValue={merchant.gmail_refresh_token || ""}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowRefreshToken(!showRefreshToken)}
              >
                {showRefreshToken ? (
                  <EyeOffIcon className="size-4" />
                ) : (
                  <EyeIcon className="size-4" />
                )}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* LLM Provider */}
      <Card>
        <CardHeader>
          <CardTitle>LLM Provider</CardTitle>
          <CardDescription>
            Choose the AI provider for payment verification
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Provider</Label>
            <Select value={llmProvider} onValueChange={(val) => { if (val) setLlmProvider(val); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">Gemini</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="llm_api_key">API Key</Label>
            <div className="relative">
              <Input
                id="llm_api_key"
                name="llm_api_key"
                type={showLlmKey ? "text" : "password"}
                defaultValue={merchant.llm_api_key || ""}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowLlmKey(!showLlmKey)}
              >
                {showLlmKey ? (
                  <EyeOffIcon className="size-4" />
                ) : (
                  <EyeIcon className="size-4" />
                )}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Verification Sources */}
      <Card>
        <CardHeader>
          <CardTitle>Verification Sources</CardTitle>
          <CardDescription>
            Select which sources to use for payment verification
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
              Gmail
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="source-screenshot"
              checked={enabledSources.includes("screenshot")}
              onCheckedChange={() => toggleSource("screenshot")}
            />
            <Label htmlFor="source-screenshot" className="cursor-pointer">
              Screenshot
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">
            More verification sources coming soon.
          </p>
        </CardContent>
      </Card>

      <Separator />

      {/* Webhook */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook</CardTitle>
          <CardDescription>
            Receive payment verification events at this URL
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <Label htmlFor="webhook_url">Webhook URL</Label>
            <Input
              id="webhook_url"
              name="webhook_url"
              type="url"
              placeholder="https://example.com/webhook"
              defaultValue={merchant.webhook_url || ""}
            />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={saving} className="w-fit">
        {saving ? "Saving..." : "Save changes"}
      </Button>
    </form>
  );
}
