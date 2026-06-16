export type Theme = "light" | "dark" | "system"

export const THEME_COOKIE_NAME = "theme"

export function isValidTheme(value: string | undefined): value is Theme {
  return value === "light" || value === "dark" || value === "system"
}

export function getInitialTheme(value: string | undefined): Theme {
  return isValidTheme(value) ? value : "system"
}

export function getThemeScript(): string {
  return `
    (function() {
      try {
        const match = document.cookie.match(/(?:^|; )${THEME_COOKIE_NAME}=([^;]*)/);
        const theme = match ? decodeURIComponent(match[1]) : 'system';
        const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        document.documentElement.classList.toggle('dark', isDark);
      } catch (e) {
        // noop
      }
    })();
  `.trim()
}
