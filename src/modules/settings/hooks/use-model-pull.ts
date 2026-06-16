"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseModelPullResult {
  pullingModel: string | null;
  pullProgress: number;
  pullStatus: string;
  error: string | null;
  pullModel: (model: string) => Promise<{ success: boolean; error?: string }>;
  resetError: () => void;
}

export function useModelPull(): UseModelPullResult {
  const [pullingModel, setPullingModel] = useState<string | null>(null);
  const [pullProgress, setPullProgress] = useState(0);
  const [pullStatus, setPullStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const resetError = useCallback(() => setError(null), []);

  const pullModel = useCallback(async (model: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPullingModel(model);
    setPullProgress(0);
    setPullStatus("");
    setError(null);

    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

    try {
      const response = await fetch("/api/ollama/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Error iniciando la descarga (${response.status} ${response.statusText})`
        );
      }

      if (!response.body) {
        throw new Error("La respuesta del servidor no contiene datos.");
      }

      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n");
        buffer = parts.pop() ?? "";

        for (const line of parts) {
          if (!line.trim()) continue;

          let data: unknown;
          try {
            data = JSON.parse(line);
          } catch {
            continue;
          }

          if (typeof data !== "object" || data === null) continue;

          const status =
            "status" in data && typeof data.status === "string"
              ? data.status
              : "";

          if (status === "error") {
            const message =
              "error" in data && typeof data.error === "string"
                ? data.error
                : "Error descargando el modelo";
            throw new Error(message);
          }

          setPullStatus(status);

          const completed =
            "completed" in data ? Number(data.completed) : Number.NaN;
          const total = "total" in data ? Number(data.total) : Number.NaN;

          if (
            !Number.isNaN(completed) &&
            !Number.isNaN(total) &&
            total > 0
          ) {
            setPullProgress(Math.min(100, Math.round((completed / total) * 100)));
          }
        }
      }

      return { success: true };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return { success: false, error: "Descarga cancelada" };
      }

      const message =
        err instanceof Error
          ? err.message
          : "Error desconocido descargando el modelo";
      setError(message);
      return { success: false, error: message };
    } finally {
      if (reader) {
        try {
          reader.releaseLock();
        } catch {
          // Ignorar errores al liberar el reader.
        }
      }
      setPullingModel(null);
    }
  }, []);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return {
    pullingModel,
    pullProgress,
    pullStatus,
    error,
    pullModel,
    resetError,
  };
}
