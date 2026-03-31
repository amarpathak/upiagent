"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: "~" },
  { href: "/dashboard/payments", label: "Payments", icon: "$" },
  { href: "/dashboard/create", label: "Create", icon: "+" },
  { href: "/dashboard/settings", label: "Settings", icon: "*" },
  { href: "/dashboard/api-keys", label: "API Keys", icon: "#" },
  { href: "/dashboard/webhooks", label: "Webhooks", icon: ">" },
  { href: "/dashboard/embed", label: "Embed", icon: "<" },
  { href: "/dashboard/operations", label: "Operations", icon: "%" },
];

interface SidebarProps {
  merchantName: string;
}

export function Sidebar({ merchantName }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-56 flex-col border-r border-border bg-surface">
      <div className="flex h-12 items-center border-b border-border px-4">
        <span className="text-sm font-semibold text-foreground">
          {merchantName}
        </span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                isActive
                  ? "bg-accent/10 text-accent"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <span className="w-4 text-center font-mono text-xs">
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
