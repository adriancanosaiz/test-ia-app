import { getRequestConfig } from "next-intl/server";
import { getLocale } from "@/lib/i18n/locale";

const namespaces = [
  "common",
  "navigation",
  "errors",
  "settings",
  "setup",
  "status",
  "emptyState",
  "confirmDialog",
  "dashboard",
  "landing",
  "folders",
  "subjects",
  "documents",
  "tests",
  "chat",
  "summaries",
];

export default getRequestConfig(async () => {
  const locale = await getLocale();

  const messages: Record<string, unknown> = {};
  for (const namespace of namespaces) {
    messages[namespace] = (
      await import(`../../messages/${locale}/${namespace}.json`)
    ).default;
  }

  return {
    locale,
    messages,
  };
});
