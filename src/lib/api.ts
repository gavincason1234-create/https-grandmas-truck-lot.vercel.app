import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "./auth/session";
import { StoreError } from "./store/types";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
    public readonly code: string = "bad_request",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function json<T>(body: T, init?: number | ResponseInit): NextResponse {
  const opts = typeof init === "number" ? { status: init } : init;
  return NextResponse.json(body, { ...opts, headers: { "Cache-Control": "no-store", ...(opts?.headers ?? {}) } });
}

/** Turn any thrown thing into a tidy JSON error the UI can show. */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) return json({ error: err.message, code: err.code }, err.status);
  if (err instanceof AuthError) return json({ error: err.message, code: err.status === 401 ? "unauthenticated" : "forbidden" }, err.status);
  if (err instanceof StoreError) return json({ error: err.message, code: err.code }, err.status);
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const path = first?.path?.join(".") ?? "";
    return json({ error: first?.message ?? "Invalid input", code: "invalid", field: path }, 400);
  }
  console.error("unhandled API error", err);
  return json({ error: "Something went wrong on our end. Try again or call the lot.", code: "internal" }, 500);
}

/** Wrap a route handler so thrown errors become responses. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<NextResponse>) {
  return async (...args: A): Promise<NextResponse> => {
    try {
      return await fn(...args);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
