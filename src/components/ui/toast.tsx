"use client"

import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "./button"
import type { Toast } from "@/hooks/use-toast"

interface ToastItemProps extends Toast {
  onDismiss: () => void
}

export function ToastItem({
  title,
  description,
  variant = "default",
  onDismiss,
}: ToastItemProps) {
  return (
    <div
      role={variant === "destructive" ? "alert" : "status"}
      aria-live={variant === "destructive" ? "assertive" : "polite"}
      className={cn(
        "pointer-events-auto relative flex w-full max-w-sm items-start gap-3 rounded-lg border p-4 shadow-lg",
        variant === "default" &&
          "bg-background text-foreground border-border",
        variant === "success" &&
          "bg-success text-success-foreground border-success/20",
        variant === "destructive" &&
          "bg-destructive text-destructive-foreground border-destructive/20"
      )}
    >
      <div className="flex-1 min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {description && (
          <p className="text-sm opacity-90">{description}</p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 -mr-1 -mt-1"
        onClick={onDismiss}
        aria-label="Cerrar notificación"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  )
}
