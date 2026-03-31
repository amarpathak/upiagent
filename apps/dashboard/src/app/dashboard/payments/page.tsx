import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PaymentsTable } from "@/components/payments-table";

export default async function PaymentsPage() {
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

  const { data: payments, error } = await supabase
    .from("payments")
    .select("*")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Failed to fetch payments:", error);
  }

  const paymentsList = payments ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Payments</h1>
          <p className="text-sm text-muted-foreground">
            {paymentsList.length} payment{paymentsList.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
      <PaymentsTable payments={paymentsList} />
    </div>
  );
}
