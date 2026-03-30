import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        message: "Validation failed",
        details: error.flatten()
      }
    });
    return;
  }

  const status = typeof error === "object" && error && "status" in error && typeof error.status === "number" ? error.status : 500;
  const message = typeof error === "object" && error && "message" in error && typeof error.message === "string" ? error.message : "Internal server error";

  if (status >= 500) {
    console.error(error);
  }

  res.status(status).json({
    error: {
      message
    }
  });
}
