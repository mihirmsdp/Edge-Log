import { Router } from "express";
import { accountsRouter } from "../modules/accounts/accounts.routes.js";
import { analyticsRouter } from "../modules/analytics/analytics.routes.js";
import { authRouter } from "../modules/auth/auth.routes.js";
import { dashboardRouter } from "../modules/dashboard/dashboard.routes.js";
import { journalRouter } from "../modules/journal/journal.routes.js";
import { marketRouter } from "../modules/market/market.routes.js";
import { playbookRouter } from "../modules/playbook/playbook.routes.js";
import { tagsRouter } from "../modules/tags/tags.routes.js";
import { tradesRouter } from "../modules/trades/trades.routes.js";
import { upstoxRouter } from "../modules/upstox/upstox.routes.js";
import { usersRouter } from "../modules/users/users.routes.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/analytics", analyticsRouter);
apiRouter.use("/accounts", accountsRouter);
apiRouter.use("/trades", tradesRouter);
apiRouter.use("/tags", tagsRouter);
apiRouter.use("/playbook-setups", playbookRouter);
apiRouter.use("/journal", journalRouter);
apiRouter.use("/journal-entries", journalRouter);
apiRouter.use("/market", marketRouter);
apiRouter.use("/upstox", upstoxRouter);


