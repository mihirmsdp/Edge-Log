import { z } from "zod";

export const createPlaybookSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(4000).nullable().optional(),
  rulesMarkdown: z.string().max(12000).default(""),
  entryCriteria: z.string().max(6000).default(""),
  exitCriteria: z.string().max(6000).default("")
});

export const updatePlaybookSchema = createPlaybookSchema.partial();
