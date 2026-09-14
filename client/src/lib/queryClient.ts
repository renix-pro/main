import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAuthHeaders } from "@/auth/AuthContext";

/** Error carrying the server's parsed JSON body, so callers can read `code`. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body: any,
  ) {
    super(message);
    this.name = "ApiError";
  }
  /** True when the write was refused because the project is closed/read-only. */
  get isProjectClosed() {
    return this.status === 403 && this.body?.code === "PROJECT_CLOSED";
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    let body: any = null;
    try {
      body = JSON.parse(text);
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, body?.message || `${res.status}: ${text}`, body);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: { 
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...getAuthHeaders(),
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch("/" + queryKey.join("/"), {
      credentials: "include",
      headers: getAuthHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

/**
 * Surfaces mutation failures the user would otherwise never see. Wired to a
 * toast in App.tsx; kept as a hook so this module stays UI-free.
 */
type MutationErrorHandler = (error: unknown) => void;
let mutationErrorHandler: MutationErrorHandler | null = null;
export function setMutationErrorHandler(handler: MutationErrorHandler | null) {
  mutationErrorHandler = handler;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      staleTime: 1000 * 60 * 2,
      retry: false,
    },
    mutations: {
      retry: false,
      onError: (error) => {
        mutationErrorHandler?.(error);
      },
    },
  },
});
