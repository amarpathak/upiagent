import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: merchant } = await supabase
    .from("merchants")
    .select("name, upi_id")
    .eq("user_id", user!.id)
    .single();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{merchant?.name}</h1>
        <p className="text-sm text-muted-foreground">{merchant?.upi_id}</p>
      </div>
      <p className="text-muted-foreground">Dashboard overview coming soon</p>
    </div>
  );
}
