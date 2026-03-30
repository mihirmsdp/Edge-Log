import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { createJournalEntry, deleteJournalEntry, getJournalCalendar, getJournalDay, listJournalEntries, updateJournalEntry } from "./journal.controller.js";
import { getLiveNiftyPrice, streamPostmarketAnalysis } from "./postmarket.controller.js";
import { streamPremarketAnalysis } from "./premarket.controller.js";

export const journalRouter = Router();

journalRouter.use(requireAuth);
journalRouter.get("/live-price", getLiveNiftyPrice);
journalRouter.get("/premarket", streamPremarketAnalysis);
journalRouter.get("/postmarket", streamPostmarketAnalysis);
journalRouter.get("/calendar", getJournalCalendar);
journalRouter.get("/day", getJournalDay);
journalRouter.get("/", listJournalEntries);
journalRouter.post("/", createJournalEntry);
journalRouter.patch("/:entryId", updateJournalEntry);
journalRouter.delete("/:entryId", deleteJournalEntry);
