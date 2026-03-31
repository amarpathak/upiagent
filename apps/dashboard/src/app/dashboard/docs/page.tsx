import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DocsContent } from "@/components/docs-content";

export default async function DocsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: merchant } = await supabase
    .from("merchants")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!merchant) redirect("/onboarding");

  // Get first API key prefix for examples
  const { data: apiKeys } = await supabase
    .from("api_keys")
    .select("key_prefix")
    .eq("merchant_id", merchant.id)
    .limit(1);

  const keyPrefix = apiKeys?.[0]?.key_prefix || "upi_ak_your_key_here";

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">API Documentation</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Quick start guides and code snippets for integrating upiagent.
      </p>
      <DocsContent merchantId={merchant.id} apiKeyPrefix={keyPrefix} upiId={merchant.upi_id} />
    </div>
  );
}
