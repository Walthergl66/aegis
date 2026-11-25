import type { SessionRequest } from './session';

export type ManagedUser = {
  id: number;
  username: string;
  rol: 'admin' | 'viewer';
  activo: boolean;
  totp_enabled: boolean;
  created_at: string;
};

export function listManagedUsers(request: SessionRequest) {
  return request<ManagedUser[]>('/web-users');
}

export function getManagedUser(request: SessionRequest, id: number) {
  return request<ManagedUser>('/web-users/' + id);
}

export function createManagedUser(request: SessionRequest, data: {
  username: string;
  password: string;
  rol: 'admin' | 'viewer';
}) {
  return request<{ id: number }>('/web-users', { method: 'POST', body: JSON.stringify(data) });
}

export function updateManagedUser(request: SessionRequest, id: number, data: {
  username: string;
  password?: string;
  rol: 'admin' | 'viewer';
  activo: boolean;
}) {
  return request<{ ok: boolean }>('/web-users/' + id, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteManagedUser(request: SessionRequest, id: number) {
  return request<{ ok: boolean }>('/web-users/' + id, { method: 'DELETE' });
}
