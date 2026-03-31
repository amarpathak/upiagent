import { createClient } from "@/lib/supabase/server";

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="flex h-12 items-center justify-end border-b border-border px-4">
      <span className="text-sm text-muted-foreground">
        {user?.email}
      </span>
    </header>
  );
}
