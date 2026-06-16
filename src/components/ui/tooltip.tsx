"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

interface TooltipProps {
  children: React.ReactNode
  content: React.ReactNode
  side?: "top" | "bottom" | "left" | "right"
  align?: "start" | "center" | "end"
  sideOffset?: number
  delay?: number
  open?: boolean
  onOpenChange?: (open: boolean) => void
  disabled?: boolean
}

function Tooltip({
  children,
  content,
  side = "top",
  align = "center",
  sideOffset = 4,
  delay = 200,
  open,
  onOpenChange,
  disabled = false,
}: TooltipProps) {
  return (
    <TooltipPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      disabled={disabled}
    >
      <TooltipPrimitive.Trigger
        render={children as React.ReactElement}
        delay={delay}
      />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner
          side={side}
          align={align}
          sideOffset={sideOffset}
          className="isolate z-50"
        >
          <TooltipPrimitive.Popup
            className={cn(
              "rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10",
              "origin-(--transform-origin) data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
            )}
          >
            {content}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

export { Tooltip, TooltipProvider }
