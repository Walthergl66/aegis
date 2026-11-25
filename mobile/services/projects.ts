import type { SessionRequest } from './session';

export type Project = {
  id: number;
  slug: string;
  nombre: string;
  provider: string;
  account_nombre?: string | null;
  connection_masked?: string | null;
  account_id?: number | null;
  project_ref?: string;
  schedule?: string | null;
  backup_options?: { no_owner?: boolean; no_privileges?: boolean };
  activo: boolean;
  ultimo_backup?: string | null;
  tamaño_archivo?: number | null;
};

export type BackupJob = {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'interrupted';
  detail?: string | null;
  slug?: string;
  history_id?: number | null;
};

export type BackupHistoryItem = {
  id: number;
  fecha: string;
  tamaño_archivo?: number | null;
  resultado: string;
  detalle?: string | null;
};

export type ProjectHistory = {
  project: Project;
  rows: BackupHistoryItem[];
  stats: Record<string, unknown>;
};

export type AvailableSupabaseProject = { ref: string; name: string };

export async function listProjects(request: SessionRequest, estado: 'activos' | 'eliminados' = 'activos') {
  return request<Project[]>('/projects?estado=' + estado);
}

export async function testPostgresConnection(request: SessionRequest, connection: string, provider = 'postgres') {
  return request<{ ok: boolean; detalle: string; server_version?: string; latency_ms?: number }>(
    '/projects/test-connection',
    { method: 'POST', body: JSON.stringify({ connection, provider }) },
  );
}

export async function getProject(request: SessionRequest, projectId: number) {
  return request<Project>('/projects/' + projectId);
}

export async function updateProject(request: SessionRequest, projectId: number, data: {
  nombre: string;
  provider: string;
  account_id?: number | null;
  project_ref?: string;
  connection?: string;
  schedule: string;
  activo: boolean;
  backup_options?: { no_owner: boolean; no_privileges: boolean };
}) {
  return request<{ ok: boolean }>('/projects/' + projectId, { method: 'PUT', body: JSON.stringify(data) });
}

export async function archiveProject(request: SessionRequest, projectId: number) {
  return request<{ ok: boolean }>('/projects/' + projectId, { method: 'DELETE' });
}

export async function restoreProject(request: SessionRequest, projectId: number) {
  return request<{ ok: boolean }>('/projects/' + projectId + '/restore', { method: 'POST', body: JSON.stringify({}) });
}

export async function fetchSupabaseProjects(request: SessionRequest, pat: string) {
  return request<{ available: AvailableSupabaseProject[]; existing_count: number }>('/import/fetch', {
    method: 'POST',
    body: JSON.stringify({ pat }),
  });
}

export async function importSupabaseProjects(request: SessionRequest, payload: {
  pat: string;
  account_name: string;
  selected_projects: string[];
  db_password?: string;
  pooler_mode: 'session' | 'transaction';
  test_connection: boolean;
}) {
  return request<{ created: number; errors: string[]; account_name: string }>(
    '/import/create',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function createPostgresProject(request: SessionRequest, data: {
  slug?: string;
  nombre: string;
  connection: string;
  schedule?: string;
  backup_options: { no_owner: boolean; no_privileges: boolean };
}) {
  return request<{ id: number }>('/projects', { method: 'POST', body: JSON.stringify({ ...data, provider: 'postgres' }) });
}

export async function startBackup(request: SessionRequest, projectId: number, idempotencyKey: string) {
  return request<BackupJob>('/projects/' + projectId + '/backup-jobs', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({}),
  });
}

export async function getBackupJob(request: SessionRequest, jobId: string) {
  return request<BackupJob>('/backups/jobs/' + jobId);
}

export async function getProjectHistory(request: SessionRequest, projectId: number) {
  return request<ProjectHistory>('/projects/' + projectId + '/history');
}
