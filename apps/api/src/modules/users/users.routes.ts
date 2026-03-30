import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { getMe, updateMe } from "./users.controller.js";

export const usersRouter = Router();

usersRouter.use(requireAuth);
usersRouter.get("/me", getMe);
usersRouter.patch("/me", updateMe);
