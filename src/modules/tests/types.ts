import { z } from "zod";
import { createTestSchema } from "./schemas";

export type CreateTestData = z.infer<typeof createTestSchema>;
