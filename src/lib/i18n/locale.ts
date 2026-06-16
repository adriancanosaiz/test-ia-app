import { cookies } from "next/headers";
import { getSettings } from "@/lib/settings";
import { Locale, routing } from "@/i18n/routing";
import { isValidLocale, LOCALE_COOKIE } from "./constants";

export async function getLocale(): Promise<Locale> {
  try {
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;

    if (cookieLocale && isValidLocale(cookieLocale)) {
      return cookieLocale;
    }
  } catch {
    // cookies() solo está disponible en Server Components / Server Actions.
    // En tests u otros contextos continuamos con el siguiente fallback.
  }

  try {
    const settings = await getSettings();
    if (settings?.language && isValidLocale(settings.language)) {
      return settings.language;
    }
  } catch {
    // Fall back to default if settings can't be read
  }

  return routing.defaultLocale;
}

export * from "./constants";
