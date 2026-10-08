"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckSquare, Mic, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRODUCT_NAME } from "@/lib/config";

const LINKS = [
  { href: "/app", label: "Reuniones", icon: Mic },
  { href: "/app/tareas", label: "Tareas", icon: CheckSquare },
  { href: "/app/ajustes", label: "Ajustes", icon: Settings },
];

export function AppNav({ email, pendingTasks }: { email: string | null; pendingTasks: number }) {
  const pathname = usePathname();
  return (
    <header className="no-print sticky top-0 z-30 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4">
        <Link href="/app" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Mic className="size-4" />
          </span>
          <span>{PRODUCT_NAME}</span>
        </Link>
        <nav className="flex items-center gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === "/app" ? pathname === "/app" || pathname.startsWith("/app/r/") : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors sm:px-3",
                  active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{label}</span>
                {href === "/app/tareas" && pendingTasks > 0 && (
                  <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-4 text-primary-foreground">
                    {pendingTasks > 99 ? "99+" : pendingTasks}
                  </span>
                )}
              </Link>
            );
          })}
          <Link
            href="/app/ajustes"
            className="ml-1 hidden max-w-40 truncate text-xs text-muted-foreground hover:text-foreground sm:block"
            title={email ?? "Sin cuenta"}
          >
            {email ?? "Sin cuenta"}
          </Link>
        </nav>
      </div>
    </header>
  );
}
