"use client"

import { useTranslations } from "next-intl"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type DocumentStatus = "PENDING" | "PROCESSING" | "READY" | "ERROR"
export type TestStatus = "DRAFT" | "PROCESSING" | "READY" | "ERROR"
export type JobStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"

export type StatusBadgeValue = DocumentStatus | TestStatus | JobStatus

const statusKeyMap: Record<StatusBadgeValue, string> = {
  PENDING: "statusPending",
  PROCESSING: "statusProcessing",
  READY: "statusReady",
  ERROR: "statusError",
  DRAFT: "statusDraft",
  COMPLETED: "statusCompleted",
  FAILED: "statusFailed",
  CANCELLED: "statusCancelled",
}

const statusVariantMap: Record<
  StatusBadgeValue,
  "default" | "secondary" | "warning" | "success" | "destructive" | "info"
> = {
  PENDING: "warning",
  PROCESSING: "info",
  READY: "success",
  ERROR: "destructive",
  DRAFT: "secondary",
  COMPLETED: "success",
  FAILED: "destructive",
  CANCELLED: "secondary",
}

interface StatusBadgeProps {
  status: StatusBadgeValue
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const t = useTranslations("common")

  return (
    <Badge
      variant={statusVariantMap[status]}
      className={cn("capitalize", className)}
    >
      {t(statusKeyMap[status])}
    </Badge>
  )
}
