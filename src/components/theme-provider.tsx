"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import {
  type Theme,
  THEME_COOKIE_NAME,
  getInitialTheme,
} from "@/lib/theme"

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: "light" | "dark"
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

function subscribeSystemTheme(callback: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)")
  media.addEventListener("change", callback)
  return () => media.removeEventListener("change", callback)
}

interface ThemeProviderProps {
  children: ReactNode
  defaultTheme?: Theme
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() =>
    getInitialTheme(defaultTheme)
  )
  const systemTheme = useSyncExternalStore<"light" | "dark">(
    subscribeSystemTheme,
    getSystemTheme,
    () => "light"
  )
  const resolvedTheme: "light" | "dark" =
    theme === "system" ? systemTheme : theme

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.toggle("dark", resolvedTheme === "dark")
  }, [resolvedTheme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      document.cookie = `${THEME_COOKIE_NAME}=${encodeURIComponent(next)};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`
    } catch {
      // noop
    }
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
