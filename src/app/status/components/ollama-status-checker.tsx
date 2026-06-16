"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { checkOllamaStatus, type OllamaStatus } from "@/modules/ai/actions";

interface OllamaStatusCheckerProps {
  initial: OllamaStatus;
}

export function OllamaStatusChecker({ initial }: OllamaStatusCheckerProps) {
  const t = useTranslations("status");
  const [status, setStatus] = useState<OllamaStatus>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheck() {
    setLoading(true);
    setError(null);
    const result = await checkOllamaStatus();
    setLoading(false);
    if (result.success) {
      setStatus(result.data);
    } else {
      setError(result.error);
    }
  }

  const chatModel = process.env.OLLAMA_CHAT_MODEL || "llama3.2:3b";
  const embeddingModel =
    process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text";

  return (
    <div className="space-y-4">
      <ul className="text-sm space-y-1">
        <li className="flex items-center gap-2">
          <span
            className={`inline-block size-2 rounded-full ${
              status.models.chatAvailable ? "bg-green-600" : "bg-red-600"
            }`}
            aria-hidden="true"
          />
          {t("chatModel", { model: chatModel })}
          {status.models.chatAvailable
            ? t("chatModelAvailable")
            : t("chatModelUnavailable")}
        </li>
        <li className="flex items-center gap-2">
          <span
            className={`inline-block size-2 rounded-full ${
              status.models.embeddingAvailable ? "bg-green-600" : "bg-red-600"
            }`}
            aria-hidden="true"
          />
          {t("embeddingModel", { model: embeddingModel })}
          {status.models.embeddingAvailable
            ? t("chatModelAvailable")
            : t("chatModelUnavailable")}
        </li>
        <li className="flex items-center gap-2">
          <span
            className={`inline-block size-2 rounded-full ${
              status.dimensions.valid ? "bg-green-600" : "bg-red-600"
            }`}
            aria-hidden="true"
          />
          {t("embeddingDimension", { dimension: status.dimensions.configured })}{" "}
          (
          {status.dimensions.valid
            ? t("matchesPrisma")
            : t("doesNotMatchPrisma")}
          )
        </li>
      </ul>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button onClick={handleCheck} disabled={loading}>
        {loading ? t("checking") : t("checkModels")}
      </Button>
    </div>
  );
}
