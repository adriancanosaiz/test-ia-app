export function getLocaleFromPayload(payload: unknown): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "locale" in payload
  ) {
    const locale = (payload as { locale: unknown }).locale;
    if (typeof locale === "string" && locale) {
      return locale;
    }
  }
  return "es";
}

export function getJobMessage(
  locale: string,
  key:
    | "cancelled"
    | "unknownError"
    | "documentNotReady"
    | "generationError"
    | "maxAttemptsReached"
    | "noRegisteredRunner"
    | "jobCancelled"
): string {
  const messages: Record<string, Record<string, string>> = {
    en: {
      cancelled: "Generation cancelled",
      unknownError: "Unknown error",
      documentNotReady: "The document is not ready to summarize",
      generationError: "An error occurred while generating the response",
      maxAttemptsReached: "Maximum attempts reached",
      noRegisteredRunner: "No runner registered for",
      jobCancelled: "Job cancelled",
    },
    es: {
      cancelled: "Generación cancelada",
      unknownError: "Error desconocido",
      documentNotReady: "El documento no está listo para resumir",
      generationError: "Ha ocurrido un error al generar la respuesta",
      maxAttemptsReached: "Máximo de intentos alcanzado",
      noRegisteredRunner: "No hay runner registrado para",
      jobCancelled: "Job cancelado",
    },
  };
  return messages[locale]?.[key] ?? messages.es[key];
}
