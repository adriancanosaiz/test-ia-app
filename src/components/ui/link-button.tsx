import Link from "next/link"
import { type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { buttonVariants } from "./button"

interface LinkButtonProps extends VariantProps<typeof buttonVariants> {
  href: string
  children: React.ReactNode
  className?: string
}

export function LinkButton({
  href,
  children,
  className,
  variant,
  size,
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant, size }), className)}
    >
      {children}
    </Link>
  )
}
