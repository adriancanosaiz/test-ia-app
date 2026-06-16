/* eslint-disable @typescript-eslint/no-unused-vars */
import type {
  AIProvider,
  ChatMessage,
  ChatProvider,
  EmbeddingProvider,
  GenerateOptions,
} from "@/modules/ai/provider";
import { z } from "zod";

export const EMBEDDING_DIMENSIONS = 768;

export function createFakeEmbedding(text: string): number[] {
  // Vector determinista a partir del texto: suficiente para tests de similitud
  const base = Array.from(text).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => {
    const value = Math.sin(base + i) * 0.5 + 0.5;
    return Number(value.toFixed(6));
  });
}

class MockEmbeddingProvider implements EmbeddingProvider {
  async embed(text: string): Promise<number[]> {
    return createFakeEmbedding(text);
  }

  getDimensions(): number {
    return EMBEDDING_DIMENSIONS;
  }
}

export type ChatStreamFixture = string[];

let chatStreamFixture: ChatStreamFixture = [];
let completeJSONFixture: unknown = {};
let completeFixture: string = "";

export function setChatStreamFixture(fixture: ChatStreamFixture): void {
  chatStreamFixture = fixture;
}

export function setCompleteJSONFixture<T>(fixture: T): void {
  completeJSONFixture = fixture;
}

export function setCompleteFixture(fixture: string): void {
  completeFixture = fixture;
}

class MockChatProvider implements ChatProvider {
  async health(): Promise<boolean> {
    return true;
  }

  async complete(
    _messages: ChatMessage[],
    _options?: GenerateOptions
  ): Promise<string> {
    return completeFixture;
  }

  async *chatStream(
    _messages: ChatMessage[],
    _options?: GenerateOptions
  ): AsyncIterable<string> {
    for (const chunk of chatStreamFixture) {
      yield chunk;
    }
  }

  async completeJSON<T>(
    _messages: ChatMessage[],
    schema: z.ZodSchema<T>,
    _options?: GenerateOptions
  ): Promise<T> {
    return schema.parse(completeJSONFixture);
  }
}

export const mockOllamaProvider: AIProvider = {
  embedding: new MockEmbeddingProvider(),
  chat: new MockChatProvider(),
};

export default mockOllamaProvider;
