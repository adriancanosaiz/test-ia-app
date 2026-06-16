import { useTranslations } from "next-intl";
import { isAppError } from "@/lib/errors";

export function useErrorMessage() {
  const t = useTranslations("errors");

  return function getErrorMessage(error: unknown): string {
    if (!isAppError(error)) {
      if (error instanceof Error) return error.message;
      if (typeof error === "string") return error;
      return t("unknownError");
    }

    if (error.code && hasErrorKey(t, error.code)) {
      return t(error.code);
    }

    return error.message || t("unknownError");
  };
}

function hasErrorKey(
  t: (key: string) => string,
  code: string
): boolean {
  const translation = t(code);
  return translation !== code;
}
