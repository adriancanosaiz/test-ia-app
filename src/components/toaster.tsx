"use client"

import { useTranslations } from "next-intl"
import { useToast } from "@/hooks/use-toast"
import { ToastItem } from "@/components/ui/toast"

export function Toaster() {
  const t = useTranslations("common")
  const { toasts, dismiss } = useToast()

  if (toasts.length === 0) return null

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label={t("notifications")}
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2"
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          {...toast}
          onDismiss={() => dismiss(toast.id)}
        />
      ))}
    </div>
  )
}
