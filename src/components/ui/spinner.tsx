"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const spinnerVariants = cva(
  "inline-block animate-spin rounded-full border-2 border-current border-t-transparent text-current",
  {
    variants: {
      size: {
        xs: "size-3",
        sm: "size-4",
        default: "size-5",
        lg: "size-6",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

interface SpinnerProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof spinnerVariants> {
  label?: string
}

export function Spinner({
  className,
  size,
  label,
  ...props
}: SpinnerProps) {
  const t = useTranslations("common")
  const loadingLabel = label ?? t("loadingLabel")

  return (
    <span
      role="status"
      aria-label={loadingLabel}
      aria-live="polite"
      className={cn(spinnerVariants({ size }), className)}
      {...props}
    >
      <span className="sr-only">{loadingLabel}</span>
    </span>
  )
}

export { spinnerVariants }
