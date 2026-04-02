import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/settings-form";

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: merchant, error } = await supabase
    .from("merchants")
    .select(
      "id, name, upi_id, gmail_client_id, gmail_client_secret, gmail_refresh_token, llm_provider, llm_model, llm_api_key, webhook_url, enabled_sources, display_name, upi_account_holder, contact_email, contact_phone, website_url, description"
    )
    .eq("user_id", user.id)
    .single();

  if (error || !merchant) {
    console.error("Failed to load merchant:", error);
    redirect("/onboarding");
  }

  // Never send the decrypted API key to the client
  const { llm_api_key, ...safeMerchant } = merchant;
  const merchantForClient = {
    ...safeMerchant,
    has_llm_api_key: !!llm_api_key,
    llm_model: merchant.llm_model ?? "gemini-flash-lite-latest",
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Settings</h1>
      <SettingsForm merchant={merchantForClient} />
    </div>
  );
}
