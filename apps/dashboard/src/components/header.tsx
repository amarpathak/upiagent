import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="flex h-12 items-center justify-end gap-3 border-b border-border px-4">
      <span className="text-sm text-muted-foreground">
        {user?.email}
      </span>
      {user && <LogoutButton />}
    </header>
  );
}
