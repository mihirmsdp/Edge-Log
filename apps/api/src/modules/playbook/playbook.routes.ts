import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { createPlaybook, deletePlaybook, listPlaybooks, updatePlaybook } from "./playbook.controller.js";

export const playbookRouter = Router();

playbookRouter.use(requireAuth);
playbookRouter.get("/", listPlaybooks);
playbookRouter.post("/", createPlaybook);
playbookRouter.patch("/:setupId", updatePlaybook);
playbookRouter.delete("/:setupId", deletePlaybook);
