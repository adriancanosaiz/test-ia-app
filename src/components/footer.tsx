"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

const links = [
  { href: "/dashboard", labelKey: "dashboard" },
  { href: "/chat", labelKey: "chat" },
  { href: "/tests", labelKey: "tests" },
];

export function Footer() {
  const t = useTranslations("navigation");

  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <p>{t("copyright", { year: new Date().getFullYear() })}</p>
        <nav aria-label={t("footerLinks")}>
          <ul className="flex gap-4">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                >
                  {t(link.labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
