"use server";

import {
  getSettings as getSettingsImpl,
  saveSettings as saveSettingsImpl,
  getEffectiveSettings as getEffectiveSettingsImpl,
} from "../settings";
import type { AppSettings } from "./types";

export async function getSettings(): Promise<AppSettings | null> {
  return getSettingsImpl();
}

export async function saveSettings(
  data: Omit<AppSettings, "id" | "createdAt" | "updatedAt">
): Promise<ReturnType<typeof saveSettingsImpl>> {
  return saveSettingsImpl(data);
}

export async function getEffectiveSettings(): Promise<AppSettings> {
  return getEffectiveSettingsImpl();
}
