"use client"

import { useTranslations } from "next-intl"

export function SkipLink() {
  const t = useTranslations("navigation")

  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:ring-2 focus:ring-ring"
    >
      {t("skipToMainContent")}
    </a>
  )
}
