import type { NextFunction, Request, Response } from "express";

export function asyncHandler<T extends Request, U extends Response>(
  fn: (req: T, res: U, next: NextFunction) => Promise<unknown>
) {
  return (req: T, res: U, next: NextFunction) => {
    void fn(req, res, next).catch(next);
  };
}
