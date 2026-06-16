import { cn } from "@/lib/utils"
import { Label } from "./label"
import { FormError } from "./form-error"

interface FormFieldProps {
  id?: string
  label: React.ReactNode
  required?: boolean
  error?: string | null
  children: React.ReactNode
  className?: string
}

export function FormField({
  id,
  label,
  required,
  error,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id} className="flex items-center gap-1">
        {label}
        {required && (
          <span aria-label="obligatorio" className="text-destructive">
            *
          </span>
        )}
      </Label>
      {children}
      {error && <FormError id={id ? `${id}-error` : undefined}>{error}</FormError>}
    </div>
  )
}
