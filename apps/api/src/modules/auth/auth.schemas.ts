import { z } from "zod";

export const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().trim().min(2).max(80)
});

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});
