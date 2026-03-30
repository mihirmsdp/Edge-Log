export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function assertFound<T>(value: T | null | undefined, message: string): T {
  if (!value) {
    throw new ApiError(404, message);
  }

  return value;
}
