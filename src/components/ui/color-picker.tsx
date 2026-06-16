"use client";

import { useId, useRef } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Label } from "./label";
import { FormError } from "./form-error";

const PRESET_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#d946ef",
  "#6b7280",
  "#1f2937",
];

interface ColorPickerProps {
  label?: string;
  name?: string;
  value?: string | null;
  onChange?: (color: string) => void;
  error?: string | null;
  disabled?: boolean;
}

export function ColorPicker({
  label,
  name,
  value,
  onChange,
  error,
  disabled,
}: ColorPickerProps) {
  const t = useTranslations("common");
  const id = useId();
  const nativeInputRef = useRef<HTMLInputElement>(null);
  const hasError = !!error;
  const colorLabel = label ?? t("color");

  function handlePresetClick(color: string) {
    if (disabled) return;
    onChange?.(color);
  }

  function handleNativeChange(event: React.ChangeEvent<HTMLInputElement>) {
    onChange?.(event.target.value);
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-1">
        {colorLabel}
      </Label>
      <div className="flex flex-wrap items-center gap-2">
        {PRESET_COLORS.map((color) => {
          const isSelected = value?.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              onClick={() => handlePresetClick(color)}
              disabled={disabled}
              aria-label={t("selectColor", { color })}
              aria-pressed={isSelected}
              className={cn(
                "h-8 w-8 rounded-full border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                isSelected
                  ? "border-foreground scale-110"
                  : "border-transparent hover:scale-105"
              )}
              style={{ backgroundColor: color }}
            />
          );
        })}
        <label
          htmlFor={id}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg border border-input bg-background px-2.5 text-sm transition-colors hover:bg-muted focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            hasError && "border-destructive"
          )}
        >
          <input
            ref={nativeInputRef}
            id={id}
            name={name}
            type="color"
            value={value ?? "#3b82f6"}
            onChange={handleNativeChange}
            disabled={disabled}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${id}-error` : undefined}
            className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0 disabled:cursor-not-allowed"
          />
          <span className="text-muted-foreground">{t("custom")}</span>
        </label>
      </div>
      {error && <FormError id={`${id}-error`}>{error}</FormError>}
    </div>
  );
}
