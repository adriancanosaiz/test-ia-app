import { Locale, routing } from "@/i18n/routing";
import { Language } from "@/lib/settings/types";

export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isValidLocale(value: string): value is Locale {
  return routing.locales.includes(value as Locale);
}

export function getLanguageFromLocale(locale: Locale): Language {
  return locale === "en" ? Language.EN : Language.ES;
}

export { Language };
