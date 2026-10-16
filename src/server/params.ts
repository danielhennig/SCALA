import { z } from "zod";
import { AppError } from "./errors";

const uuid = z.uuid();

/** Route params are user input: a malformed id is simply "not found". */
export function assertUuid(value: string, notFoundMessage: string): void {
  if (!uuid.safeParse(value).success) {
    throw new AppError("NOT_FOUND", notFoundMessage);
  }
}
