import { z } from "zod";
import { subjectSchema } from "./schemas";

export type SubjectFormData = z.infer<typeof subjectSchema>;
