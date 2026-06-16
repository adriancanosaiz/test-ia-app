"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen } from "lucide-react";

export function LogoLink() {
  const pathname = usePathname();
  const href = pathname === "/" ? "/" : "/dashboard";

  return (
    <Link
      href={href}
      className="flex items-center gap-2 font-bold text-xl tracking-tight hover:opacity-80 transition-opacity"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <BookOpen className="h-5 w-5" aria-hidden="true" />
      </div>
      TestForge
    </Link>
  );
}
