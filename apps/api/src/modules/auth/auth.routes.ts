import { Router } from "express";
import { signIn, signOut, signUp, getCurrentSession, refreshSession } from "./auth.controller.js";

export const authRouter = Router();

authRouter.post("/sign-up", signUp);
authRouter.post("/sign-in", signIn);
authRouter.post("/refresh", refreshSession);
authRouter.post("/sign-out", signOut);
authRouter.get("/me", getCurrentSession);
