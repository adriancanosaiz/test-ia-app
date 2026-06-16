import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { isSupportedMimeType, parseDocument } from "./parser";

describe("isSupportedMimeType", () => {
  it("acepta PDF, TXT y Markdown", () => {
    expect(isSupportedMimeType("application/pdf")).toBe(true);
    expect(isSupportedMimeType("text/plain")).toBe(true);
    expect(isSupportedMimeType("text/markdown")).toBe(true);
  });

  it("rechaza otros tipos", () => {
    expect(isSupportedMimeType("image/png")).toBe(false);
    expect(isSupportedMimeType("application/json")).toBe(false);
  });
});

describe("parseDocument", () => {
  it("normaliza texto de un archivo de texto", async () => {
    const buffer = Buffer.from("  Línea 1\r\n\r\n\r\nLínea 2  \n\n  ");
    const result = await parseDocument("text/plain", buffer);
    expect(result.text).toBe("Línea 1\n\nLínea 2");
  });

  it("normaliza markdown igual que texto plano", async () => {
    const buffer = Buffer.from("# Título\r\n\nContenido");
    const result = await parseDocument("text/markdown", buffer);
    expect(result.text).toBe("# Título\n\nContenido");
  });

  it("extrae texto y número de páginas de un PDF", async () => {
    const fixturePath = path.resolve(__dirname, "../../lib/test/fixtures/sample.pdf");
    const buffer = fs.readFileSync(fixturePath);
    const result = await parseDocument("application/pdf", buffer);

    expect(result.text).toContain("Hello PDF");
    expect(result.text).toContain("Second page");
    expect(result.pageCount).toBe(2);
  });

  it("lanza error para tipos no soportados", async () => {
    await expect(parseDocument("image/png", Buffer.from("x"))).rejects.toThrow(
      "Unsupported file type"
    );
  });
});
