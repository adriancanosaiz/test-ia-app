"use client";

import { useState, useCallback } from "react";
import { useErrorMessage } from "@/hooks/use-error-message";
import { ActionResult, FieldErrors } from "@/lib/errors";

interface UseFormActionOptions<T> {
  action: (data: FormData) => Promise<ActionResult<T>>;
  onSuccess?: (data: T) => void;
}

interface UseFormActionState {
  isLoading: boolean;
  globalError: string | null;
  fieldErrors: Record<string, string>;
}

interface UseFormActionReturn<T> extends UseFormActionState {
  handleSubmit: (formData: FormData) => Promise<ActionResult<T> | undefined>;
  resetErrors: () => void;
}

function normalizeFieldErrors(
  fieldErrors?: FieldErrors
): Record<string, string> {
  if (!fieldErrors) return {};

  const normalized: Record<string, string> = {};
  for (const [key, messages] of Object.entries(fieldErrors)) {
    if (messages && messages.length > 0) {
      normalized[key] = messages[0];
    }
  }
  return normalized;
}

export function useFormAction<T>({
  action,
  onSuccess,
}: UseFormActionOptions<T>): UseFormActionReturn<T> {
  const getErrorMessage = useErrorMessage();
  const [isLoading, setIsLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const resetErrors = useCallback(() => {
    setGlobalError(null);
    setFieldErrors({});
  }, []);

  const handleSubmit = useCallback(
    async (formData: FormData) => {
      resetErrors();
      setIsLoading(true);

      try {
        const result = await action(formData);

        if (result.success) {
          onSuccess?.(result.data);
          return result;
        }

        const normalized = normalizeFieldErrors(result.fieldErrors);
        setFieldErrors(normalized);

        if (Object.keys(normalized).length === 0) {
          setGlobalError(getErrorMessage(result.error));
        }

        return result;
      } catch (error) {
        setGlobalError(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    },
    [action, onSuccess, resetErrors, getErrorMessage]
  );

  return {
    isLoading,
    globalError,
    fieldErrors,
    handleSubmit,
    resetErrors,
  };
}
