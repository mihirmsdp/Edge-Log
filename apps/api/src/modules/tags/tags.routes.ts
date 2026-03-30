import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { createTag, deleteTag, listTags, updateTag } from "./tags.controller.js";

export const tagsRouter = Router();

tagsRouter.use(requireAuth);
tagsRouter.get("/", listTags);
tagsRouter.post("/", createTag);
tagsRouter.patch("/:tagId", updateTag);
tagsRouter.delete("/:tagId", deleteTag);
