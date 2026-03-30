import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { createAccount, deleteAccount, listAccounts, updateAccount } from "./accounts.controller.js";

export const accountsRouter = Router();

accountsRouter.use(requireAuth);
accountsRouter.get("/", listAccounts);
accountsRouter.post("/", createAccount);
accountsRouter.patch("/:accountId", updateAccount);
accountsRouter.delete("/:accountId", deleteAccount);
