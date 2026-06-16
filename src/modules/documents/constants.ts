export const SUPPORTED_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
];

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function isSupportedMimeType(mimeType: string): boolean {
  return SUPPORTED_MIME_TYPES.includes(mimeType);
}
