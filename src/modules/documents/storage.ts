import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "storage", "uploads");

export function generateStorageKey(): string {
  return randomUUID();
}

export async function ensureUploadDir(): Promise<void> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

function resolvePath(storageKey: string): string {
  // Prevenir path traversal: el storageKey debe ser un UUID válido
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storageKey)) {
    throw new Error("Invalid storage key");
  }
  return path.join(UPLOAD_DIR, storageKey);
}

export async function saveFile(
  file: Buffer,
  storageKey: string
): Promise<void> {
  await ensureUploadDir();
  const filePath = resolvePath(storageKey);
  await fs.writeFile(filePath, file);
}

export async function readFile(storageKey: string): Promise<Buffer> {
  const filePath = resolvePath(storageKey);
  return fs.readFile(filePath);
}

export async function deleteFile(storageKey: string): Promise<void> {
  const filePath = resolvePath(storageKey);
  await fs.unlink(filePath);
}
