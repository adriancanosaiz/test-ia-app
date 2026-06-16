import * as React from "react";

import { cn } from "@/lib/utils";

interface ProgressProps extends React.ComponentProps<"progress"> {
  value?: number;
  max?: number;
  label?: string;
}

function Progress({
  className,
  value = 0,
  max = 100,
  label,
  ...props
}: ProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={cn("w-full", className)} role="group" aria-label={label}>
      {label && (
        <div className="mb-2 flex justify-between text-sm text-muted-foreground">
          <span>{label}</span>
          <span aria-hidden="true">{Math.round(percentage)}%</span>
        </div>
      )}
      <progress
        value={value}
        max={max}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        className={cn(
          "h-2 w-full overflow-hidden rounded-full bg-muted",
          "[&::-webkit-progress-bar]:bg-muted",
          "[&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary [&::-webkit-progress-value]:transition-all",
          "[&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-primary",
          className
        )}
        {...props}
      />
    </div>
  );
}

export { Progress };
