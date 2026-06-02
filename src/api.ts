import type { MapCatalog, Point, RouteRead, TokenResponse, User } from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

type RequestOptions = {
  token?: string | null;
  method?: "GET" | "POST";
  body?: unknown;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers();

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    const message = await response.text();
    const error = new Error(message || response.statusText);
    error.name = String(response.status);
    throw error;
  }

  return response.json() as Promise<T>;
}

export const api = {
  apiUrl: API_URL,

  register(email: string, password: string) {
    return request<User>("/auth/register", {
      method: "POST",
      body: { email, password },
    });
  },

  login(email: string, password: string) {
    return request<TokenResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
  },

  verifyEmail(token: string) {
    return request<{ email_verified: boolean; message: string }>(`/auth/verify-email?token=${encodeURIComponent(token)}`);
  },

  me(token: string) {
    return request<User>("/auth/me", { token });
  },

  maps(token: string) {
    return request<MapCatalog>("/api/maps", { token });
  },

  currentRoute(token: string) {
    return request<RouteRead>("/api/routes/current", { token });
  },

  saveRoute(token: string, mapId: string, start: Point, end: Point) {
    return request<RouteRead>("/api/routes", {
      token,
      method: "POST",
      body: {
        map_id: mapId,
        start,
        end,
      },
    });
  },

  cameraUrl(token: string) {
    return `${API_URL}/api/camera/stream?access_token=${encodeURIComponent(token)}`;
  },
};
