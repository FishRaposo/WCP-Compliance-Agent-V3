const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

function getToken(): string | null {
  return localStorage.getItem("wcp_token");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const headers: Record<string, string> = {};
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (init?.headers) {
    Object.assign(headers, init.headers as Record<string, string>);
  }

  const url = BASE_URL ? `${BASE_URL}${path}` : path;
  const res = await fetch(url, {
    ...init,
    headers,
  });

  if (res.status === 401) {
    localStorage.removeItem("wcp_token");
    window.location.href = "/login";
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  postForm: <T>(path: string, form: FormData) =>
    request<T>(path, {
      method: "POST",
      body: form,
    }),
};
