"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { Menu, LayoutDashboard, MessageSquare, FlaskConical, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

const links = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/chat", labelKey: "chat", icon: MessageSquare },
  { href: "/tests", labelKey: "tests", icon: FlaskConical },
  { href: "/settings", labelKey: "settings", icon: Settings },
]

interface MobileNavProps {
  className?: string
}

export function MobileNav({ className }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const t = useTranslations("navigation")

  return (
    <div className={className}>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("openMobileNavigation")}
          >
            <Menu className="h-6 w-6" aria-hidden="true" />
          </Button>
        </DialogTrigger>
        <DialogContent className="w-full max-w-xs">
          <DialogHeader>
            <DialogTitle>{t("mobileNavigation")}</DialogTitle>
            <DialogDescription>
              {t("mobileNavigationDescription")}
            </DialogDescription>
          </DialogHeader>
          <nav aria-label={t("mobileNavigationAria")}>
            <ul className="space-y-2">
              {links.map((link) => {
                const isActive =
                  pathname === link.href || pathname.startsWith(`${link.href}/`)
                const Icon = link.icon
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isActive
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                      {t(link.labelKey)}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        </DialogContent>
      </Dialog>
    </div>
  )
}
