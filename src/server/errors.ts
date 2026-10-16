export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.status = STATUS_BY_CODE[code];
  }
}

type PostgrestLikeError = {
  code?: string;
  message: string;
  details?: string | null;
};

// Maps Postgres/PostgREST error codes to API errors. Unknown codes become 500s
// and keep the original error as `cause` for logging.
export function fromPostgrestError(error: PostgrestLikeError): AppError {
  switch (error.code) {
    case "23505": // unique_violation
      return new AppError(
        "CONFLICT",
        "Registro já existe.",
        error.details ?? undefined,
      );
    case "23P01": // exclusion_violation (e.g. overlapping shifts)
      return new AppError("CONFLICT", "Conflito com um registro existente.");
    case "23514": // check_violation
    case "22023": // invalid_parameter_value
      return new AppError(
        "VALIDATION_ERROR",
        "Dados inválidos.",
        error.message,
      );
    case "23503": // foreign_key_violation
      return new AppError("VALIDATION_ERROR", "Referência inválida.");
    case "42501": // insufficient_privilege (also RLS violations on insert)
      return new AppError("FORBIDDEN", "Sem permissão para esta ação.");
    case "PGRST116": // .single() found no rows
      return new AppError("NOT_FOUND", "Recurso não encontrado.");
    // Business rules raised by our SQL functions/triggers (see migrations).
    case "SC001":
      return new AppError(
        "CONFLICT",
        "A organização precisa de pelo menos um administrador.",
      );
    case "SC002":
      return new AppError("BAD_REQUEST", "Convite inválido ou expirado.");
    case "SC003":
      return new AppError(
        "FORBIDDEN",
        "Este convite foi enviado para outro e-mail.",
      );
    case "SC004":
      return new AppError(
        "CONFLICT",
        "Essa pessoa já é membro da organização.",
      );
    default: {
      const appError = new AppError("INTERNAL_ERROR", "Erro inesperado.");
      appError.cause = error;
      return appError;
    }
  }
}
