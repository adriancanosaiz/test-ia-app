"use client"

import { Sun, Moon, Monitor } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { useTheme } from "./theme-provider"

const cycle: Record<"light" | "dark" | "system", "light" | "dark" | "system"> = {
  light: "dark",
  dark: "system",
  system: "light",
}

const icons = {
  light: Sun,
  dark: Moon,
  system: Monitor,
}

export function ThemeToggle() {
  const t = useTranslations("common")
  const { theme, setTheme } = useTheme()
  const Icon = icons[theme]
  const nextTheme = cycle[theme]
  const nextThemeKey = nextTheme.charAt(0).toUpperCase() + nextTheme.slice(1)
  const label = t(`theme${nextThemeKey}`)

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(nextTheme)}
      aria-label={label}
      title={label}
    >
      <Icon className="h-5 w-5" />
    </Button>
  )
}
