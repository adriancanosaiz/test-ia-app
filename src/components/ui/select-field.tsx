"use client"

import { createContext, useContext, useId } from "react"
import { cn } from "@/lib/utils"
import { Label } from "./label"
import { FormError } from "./form-error"
import { SelectTrigger } from "./select"

interface SelectFieldContextValue {
  labelId: string
  selectId: string
  hasError: boolean
}

const SelectFieldContext = createContext<SelectFieldContextValue | null>(null)

interface SelectFieldProps {
  label: React.ReactNode
  error?: string | null
  children: React.ReactNode
  className?: string
}

export function SelectField({
  label,
  error,
  children,
  className,
}: SelectFieldProps) {
  const labelId = useId()
  const selectId = useId()
  const hasError = !!error

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={selectId} id={labelId} className="flex items-center gap-1">
        {label}
      </Label>
      <SelectFieldContext.Provider value={{ labelId, selectId, hasError }}>
        {children}
      </SelectFieldContext.Provider>
      {error && <FormError>{error}</FormError>}
    </div>
  )
}

export function AccessibleSelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectTrigger>) {
  const context = useContext(SelectFieldContext)

  return (
    <SelectTrigger
      id={context?.selectId}
      className={className}
      aria-labelledby={context?.labelId}
      aria-invalid={context?.hasError}
      {...props}
    >
      {children}
    </SelectTrigger>
  )
}
