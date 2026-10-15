// Client-side helper for calling /api/v1. Unwraps `{ data }` on success and
// turns the API's `{ error }` shape into an ApiClientError.

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    details?: { fieldErrors?: Record<string, string[] | undefined> } | unknown;
  };
};

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly fieldErrors: Record<string, string[] | undefined> = {},
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiClientError("Sem conexão com o servidor. Tente novamente.", 0);
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (body as ApiErrorBody | null)?.error;
    const details = error?.details as
      { fieldErrors?: Record<string, string[]> } | undefined;
    throw new ApiClientError(
      error?.message ?? "Erro inesperado.",
      response.status,
      error?.code,
      details?.fieldErrors ?? {},
    );
  }

  return (body as { data: T }).data;
}
