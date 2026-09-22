const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

async function request<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error((data as { message?: string }).message || "Request failed.");
  }

  return data as T;
}

export function listAuditRuns(token: string) {
  return request<{ success: boolean; data?: { runs?: unknown[] } }>("/api/audit", token, {
    method: "GET",
  });
}

export function getAuditRun(id: string, token: string) {
  return request<{ success: boolean; data?: { run?: unknown; tests?: unknown[]; findings?: unknown[] } }>(`/api/audit/${id}`, token, {
    method: "GET",
  });
}

export function generateAuditDiagnosis(id: string, token: string) {
  return request<{ success: boolean; data?: { diagnosis?: unknown } }>(`/api/audit/${id}/diagnose`, token, {
    method: "POST",
  });
}

export function rerunAudit(id: string, token: string) {
  return request<{ success: boolean; data?: { run?: unknown; diagnosis?: unknown } }>(`/api/audit/${id}/execute`, token, {
    method: "POST",
  });
}
