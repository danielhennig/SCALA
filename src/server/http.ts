import "server-only";
import { z } from "zod";
import { AppError } from "./errors";

export function jsonError(error: AppError): Response {
  return Response.json(
    {
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    },
    { status: error.status },
  );
}

// Wraps a Route Handler so every failure becomes the API's standard error shape.
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof AppError) {
        if (error.status >= 500) console.error(error, error.cause);
        return jsonError(error);
      }
      console.error(error);
      return jsonError(new AppError("INTERNAL_ERROR", "Erro inesperado."));
    }
  };
}

export async function parseJsonBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.output<T>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError(
      "BAD_REQUEST",
      "Corpo da requisição não é um JSON válido.",
    );
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Dados inválidos.",
      z.flattenError(result.error),
    );
  }
  return result.data;
}
