import { api } from './http.js'

export const listBackups = (page = 1, pageSize = 50, options) =>
  api.get(`/api/backups?page=${page}&page_size=${pageSize}`, options)

export const downloadBackup = (backupId, format = 'dump') =>
  api.download(`/api/backups/${backupId}/download?format=${encodeURIComponent(format)}`)
