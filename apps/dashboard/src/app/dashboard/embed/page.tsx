import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmbedPreview } from "@/components/embed-preview";

export default async function EmbedPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: merchant } = await supabase
    .from("merchants")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!merchant) {
    redirect("/onboarding");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Embed Widget</h1>
        <p className="text-sm text-muted-foreground">
          Add a UPI payment widget to your website with a simple code snippet.
        </p>
      </div>
      <EmbedPreview merchantId={merchant.id} />
    </div>
  );
}
