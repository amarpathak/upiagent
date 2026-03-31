import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ApiKeysList } from "@/components/api-keys-list";

export default async function ApiKeysPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (merchantError || !merchant) {
    console.error("Failed to load merchant:", merchantError);
    redirect("/onboarding");
  }

  const { data: apiKeys, error: keysError } = await supabase
    .from("api_keys")
    .select("id, key_prefix, name, last_used_at, created_at")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false });

  if (keysError) {
    console.error("Failed to load API keys:", keysError);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">API Keys</h1>
      <ApiKeysList apiKeys={apiKeys || []} />
    </div>
  );
}
