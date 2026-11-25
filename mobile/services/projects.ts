import type { SessionRequest } from './session';

export type Project = {
  id: number;
  slug: string;
  nombre: string;
  provider: string;
  account_nombre?: string | null;
  connection_masked?: string | null;
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

export async function listProjects(request: SessionRequest) {
  return request<Project[]>('/projects?estado=activos');
}

export async function testPostgresConnection(request: SessionRequest, connection: string) {
  return request<{ ok: boolean; detalle: string; server_version?: string; latency_ms?: number }>(
    '/projects/test-connection',
    { method: 'POST', body: JSON.stringify({ connection, provider: 'postgres' }) },
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
