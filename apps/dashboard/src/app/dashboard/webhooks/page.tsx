import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WebhookLog } from "@/components/webhook-log";

export default async function WebhooksPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: merchant } = await supabase
    .from("merchants")
    .select("id, webhook_url")
    .eq("user_id", user.id)
    .single();

  if (!merchant) {
    redirect("/onboarding");
  }

  // Use service role client to query webhook_deliveries across tables
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: deliveries, error } = await serviceClient
    .from("webhook_deliveries")
    .select("id, status_code, attempt_number, created_at, payment_id, payments(amount, amount_with_paisa)")
    .eq("payments.merchant_id", merchant.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Failed to fetch webhook deliveries:", error);
  }

  // Filter out deliveries where the payment join returned null (not belonging to merchant)
  const deliveriesList = (deliveries ?? []).filter(
    (d) => d.payments !== null
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Webhooks</h1>
        <p className="text-sm text-muted-foreground">
          Receive real-time notifications when payments are verified.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Webhook URL</CardTitle>
          <CardDescription>
            We will POST payment events to this URL.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {merchant.webhook_url ? (
            <div className="flex items-center gap-3">
              <code className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm font-mono break-all">
                {merchant.webhook_url}
              </code>
              <a
                href="/dashboard/settings"
                className="shrink-0 text-sm text-primary hover:underline"
              >
                Edit
              </a>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                No webhook URL configured.
              </p>
              <a
                href="/dashboard/settings"
                className="text-sm text-primary hover:underline w-fit"
              >
                Configure in Settings
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold mb-3">Recent Deliveries</h2>
        {!merchant.webhook_url ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Configure a webhook URL to start receiving deliveries.
          </p>
        ) : (
          <WebhookLog deliveries={deliveriesList} />
        )}
      </div>
    </div>
  );
}
