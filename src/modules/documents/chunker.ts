export interface Chunk {
  content: string;
  index: number;
  tokenCount: number;
  pageNumber?: number;
  metadata?: Record<string, unknown>;
}

export interface ChunkerOptions {
  chunkSize?: number;
  overlap?: number;
}

export function chunkText(
  text: string,
  options: ChunkerOptions = {}
): Chunk[] {
  const chunkSize = options.chunkSize ?? 1500;
  const overlap = options.overlap ?? 150;

  const paragraphs = text.split("\n\n").filter((p) => p.trim().length > 0);
  const chunks: Chunk[] = [];
  let currentChunk = "";
  let currentIndex = 0;

  for (const paragraph of paragraphs) {
    const normalized = paragraph.replace(/\s+/g, " ").trim();

    if (currentChunk.length + normalized.length + 2 <= chunkSize) {
      currentChunk = currentChunk ? `${currentChunk}\n\n${normalized}` : normalized;
    } else {
      if (currentChunk) {
        chunks.push(createChunk(currentChunk, currentIndex));
        currentIndex++;
      }

      if (normalized.length > chunkSize) {
        // Párrafo muy largo: dividirlo forzosamente
        for (let i = 0; i < normalized.length; i += chunkSize - overlap) {
          const piece = normalized.slice(i, i + chunkSize);
          chunks.push(createChunk(piece, currentIndex));
          currentIndex++;
          if (i + chunkSize >= normalized.length) break;
        }
        currentChunk = "";
      } else {
        currentChunk = normalized;
      }
    }
  }

  if (currentChunk) {
    chunks.push(createChunk(currentChunk, currentIndex));
  }

  return chunks;
}

function createChunk(content: string, index: number): Chunk {
  return {
    content: content.trim(),
    index,
    tokenCount: Math.ceil(content.length / 4),
  };
}
