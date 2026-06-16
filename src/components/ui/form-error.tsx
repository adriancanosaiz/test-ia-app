import { cn } from "@/lib/utils"

interface FormErrorProps {
  id?: string
  children: React.ReactNode
  className?: string
}

export function FormError({ id, children, className }: FormErrorProps) {
  return (
    <p
      id={id}
      role="alert"
      className={cn(
        "text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md",
        className
      )}
    >
      {children}
    </p>
  )
}
