"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { ClipboardList, Database, FileText, Settings, type LucideIcon } from "lucide-react";
import { workspaceNavGroups, type WorkspaceNavIcon } from "@/lib/navigation";

const icons: Record<WorkspaceNavIcon, LucideIcon> = {
  dashboard: ClipboardList,
  reports: FileText,
  sources: Database,
  settings: Settings,
};

export function WorkspaceNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Workspace" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:gap-5 lg:overflow-visible lg:pb-0">
      {workspaceNavGroups.map((group) => (
        <div key={group.label} className="flex gap-1 lg:flex-col">
          <p className="hidden px-3 pb-1 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-brand-200/50 lg:block">{group.label}</p>
          {group.items.map((item) => {
            const Icon = icons[item.icon];
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "group relative flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-white/10 text-white" : "text-brand-100/75 hover:bg-white/5 hover:text-white",
                )}
              >
                {active ? <span aria-hidden className="absolute inset-y-1.5 left-0 hidden w-0.5 rounded-full bg-accent-300 lg:block" /> : null}
                <Icon aria-hidden className={clsx("h-4 w-4", active ? "text-accent-300" : "text-brand-200/60 group-hover:text-brand-100")} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
