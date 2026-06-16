import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { getTranslations } from "next-intl/server";
import {
  MessageSquare,
  LayoutDashboard,
  FlaskConical,
  Settings,
} from "lucide-react";
import { NavLink } from "@/components/nav-link";
import { Footer } from "@/components/footer";
import { SkipLink } from "@/components/skip-link";
import { MobileNav } from "@/components/mobile-nav";
import { LogoLink } from "@/components/logo-link";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { ToastProvider } from "@/hooks/use-toast";
import { Toaster } from "@/components/toaster";
import { GlobalSearch } from "@/components/global-search";
import { getInitialTheme, getThemeScript } from "@/lib/theme";
import { getSearchIndex, type SearchItem } from "@/lib/search";
import { initializeJobs } from "@/lib/jobs/registry";
import { getLocale } from "@/lib/i18n/locale";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  return {
    title: t("appName"),
    description: t("appDescription"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const theme = getInitialTheme(cookieStore.get("theme")?.value);
  const locale = await getLocale();
  const t = await getTranslations("navigation");
  const messages = await getMessages();

  try {
    await initializeJobs();
  } catch {
    // Ignorar errores de inicialización de jobs; no bloquean la aplicación.
  }

  let searchItems: SearchItem[] = [];
  try {
    searchItems = await getSearchIndex();
  } catch {
    searchItems = [];
  }

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: getThemeScript(),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background">
        <ThemeProvider defaultTheme={theme}>
          <ToastProvider>
            <SkipLink />
            <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
                <LogoLink />
                <nav
                  className="hidden sm:flex items-center gap-1"
                  aria-label={t("mainNavigation")}
                >
                  <NavLink href="/dashboard">
                    <span className="flex items-center gap-2">
                      <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only sm:not-sr-only">{t("dashboard")}</span>
                    </span>
                  </NavLink>
                  <NavLink href="/chat">
                    <span className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only sm:not-sr-only">{t("chat")}</span>
                    </span>
                  </NavLink>
                  <NavLink href="/tests">
                    <span className="flex items-center gap-2">
                      <FlaskConical className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only sm:not-sr-only">{t("tests")}</span>
                    </span>
                  </NavLink>
                  <NavLink href="/settings">
                    <span className="flex items-center gap-2">
                      <Settings className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only sm:not-sr-only">
                        {t("settings")}
                      </span>
                    </span>
                  </NavLink>
                </nav>
                <div className="flex items-center gap-1">
                  <GlobalSearch items={searchItems} />
                  <ThemeToggle />
                  <MobileNav className="sm:hidden" />
                </div>
              </div>
            </header>
            <main
              id="main-content"
              className="flex-1 container mx-auto px-4 py-8 max-w-7xl"
              tabIndex={-1}
            >
              <NextIntlClientProvider messages={messages} locale={locale}>
                {children}
              </NextIntlClientProvider>
            </main>
            <Footer />
            <Toaster />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
