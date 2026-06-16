import { z } from "zod";
import { isSupportedMimeType, MAX_FILE_SIZE } from "./constants";

export const uploadDocumentSchema = z.object({
  subjectId: z.string().min(1, "La asignatura es obligatoria"),
  file: z
    .instanceof(File, { message: "Debes seleccionar un archivo" })
    .refine((file) => file.size > 0, "El archivo está vacío")
    .refine(
      (file) => isSupportedMimeType(file.type),
      "Tipo de archivo no soportado"
    )
    .refine(
      (file) => file.size <= MAX_FILE_SIZE,
      "El archivo excede el tamaño máximo de 10 MB"
    ),
});

export const processDocumentSchema = z.object({
  documentId: z.string().min(1, "El documento es obligatorio"),
});

export const updateDocumentTitleSchema = z.object({
  title: z.string().min(1, "El título es obligatorio"),
});
