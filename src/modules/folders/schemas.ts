import { z } from "zod";

export const folderSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  description: z.string().optional(),
  color: z.string().optional(),
});
