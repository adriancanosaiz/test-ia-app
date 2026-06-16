import { z } from "zod";
import { folderSchema } from "./schemas";

export type FolderFormData = z.infer<typeof folderSchema>;
