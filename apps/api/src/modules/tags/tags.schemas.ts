import { z } from "zod";

export const createTagSchema = z.object({
  name: z.string().trim().min(1).max(50),
  color: z.string().trim().regex(/^#([A-Fa-f0-9]{6})$/)
});

export const updateTagSchema = createTagSchema.partial();
