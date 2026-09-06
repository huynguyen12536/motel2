import axios from "axios";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (
    axios.isAxiosError<{
      message?: string;
      code?: string;
      errors?: Record<string, string[]>;
    }>(error)
  ) {
    const data = error.response?.data;
    return new ApiError(
      error.response?.status ?? 0,
      typeof data?.message === "string" ? data.message : error.message,
      data?.code,
      data?.errors,
    );
  }
  return new ApiError(
    0,
    error instanceof Error ? error.message : "Unexpected error",
  );
}
