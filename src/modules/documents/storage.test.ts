import { describe, expect, it, beforeAll, afterAll } from "vitest";
import fs from "fs/promises";
import path from "path";
import {
  generateStorageKey,
  saveFile,
  readFile,
  deleteFile,
} from "./storage";

const UPLOAD_DIR = path.join(process.cwd(), "storage", "uploads");

describe("storage", () => {
  beforeAll(async () => {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  });

  afterAll(async () => {
    // No limpiamos el directorio completo para no afectar otros datos
  });

  it("generateStorageKey devuelve un UUID válido", () => {
    const key = generateStorageKey();
    expect(key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it("guarda, lee y borra un archivo", async () => {
    const key = generateStorageKey();
    const content = Buffer.from("contenido de prueba");

    await saveFile(content, key);
    const read = await readFile(key);
    expect(read.toString()).toBe("contenido de prueba");

    await deleteFile(key);
    await expect(readFile(key)).rejects.toThrow();
  });

  it("rechaza storageKey con path traversal", async () => {
    const maliciousKey = "../../../etc/passwd";
    await expect(saveFile(Buffer.from("x"), maliciousKey)).rejects.toThrow(
      "Invalid storage key"
    );
    await expect(readFile(maliciousKey)).rejects.toThrow("Invalid storage key");
  });
});
