export type MobileUser = {
  id: number;
  username: string;
  rol: string;
  totp_enabled: boolean;
};

export type SessionTokens = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'bearer';
  user: MobileUser;
};

const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message: string, public status: number, public totpRequired = false) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit, accessToken?: string): Promise<T> {
  if (!API_URL) {
    throw new ApiError('Configura EXPO_PUBLIC_API_URL en mobile/.env.local.', 0);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Revisa la red y la URL de API.', 0);
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      body.detail || 'No se pudo completar la solicitud.',
      response.status,
      Boolean(body.totp_required),
    );
  }
  return body as T;
}

export const api = {
  login: (username: string, password: string, code: string) =>
    request<SessionTokens>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, code, client_type: 'native' }),
    }),
  refresh: (refreshToken: string) =>
    request<SessionTokens>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    }),
  logout: (refreshToken: string, accessToken: string) =>
    request<{ ok: boolean }>('/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }),
  authenticated: async <T,>(
    path: string,
    init: RequestInit,
    accessToken: string,
    refreshToken: string,
    onRefresh: (tokens: SessionTokens) => Promise<void>,
  ): Promise<T> => {
    try {
      return await request<T>(path, init, accessToken);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401 || !refreshToken) throw error;
      const tokens = await api.refresh(refreshToken);
      await onRefresh(tokens);
      return request<T>(path, init, tokens.access_token);
    }
  },
};
