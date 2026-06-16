import { describe, expect, it } from "vitest";
import { chunkText } from "./chunker";

describe("chunkText", () => {
  it("devuelve un único chunk para textos cortos", () => {
    const text = "Primer párrafo.\n\nSegundo párrafo.";
    const chunks = chunkText(text, { chunkSize: 1000, overlap: 100 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain("Primer párrafo.");
    expect(chunks[0].content).toContain("Segundo párrafo.");
    expect(chunks[0].index).toBe(0);
    expect(chunks[0].tokenCount).toBeGreaterThan(0);
  });

  it("divide un texto largo en varios chunks con overlap", () => {
    const paragraphs = Array.from({ length: 20 }, (_, i) => `Párrafo número ${i}.`);
    const text = paragraphs.join("\n\n");
    const chunks = chunkText(text, { chunkSize: 200, overlap: 50 });

    expect(chunks.length).toBeGreaterThan(1);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].index).toBe(i);
      expect(chunks[i].content.length).toBeLessThanOrEqual(250);
    }
  });

  it("divide forzosamente un párrafo demasiado largo", () => {
    const longParagraph = "palabra ".repeat(500);
    const chunks = chunkText(longParagraph, { chunkSize: 200, overlap: 50 });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(200);
    }
  });

  it("ignora líneas vacías", () => {
    const text = "\n\n\nSolo este párrafo.\n\n\n";
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("Solo este párrafo.");
  });
});
