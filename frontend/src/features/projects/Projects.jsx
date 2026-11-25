import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { deleteProject, enqueueBackup, getBackupJob, listProjects, restoreProject } from '../../services/projects.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { useAbort, isAbortError } from '../../hooks/useAbort.js'
import PageHead from '../../components/ui/PageHead.jsx'
import { useToast } from '../../components/ui/Toast.jsx'
import { useDialog } from '../../components/ui/ConfirmDialog.jsx'
import Badge from '../../components/ui/Badge.jsx'

const PROVIDER_LABELS = { supabase: 'Supabase', postgres: 'PostgreSQL' }
const JOB_LABELS = {
  queued: 'En cola',
  running: 'En ejecución',
  completed: 'Completado',
  failed: 'Falló',
  interrupted: 'Interrumpido',
}

export default function Projects() {
  const toast = useToast()
  const { confirm, prompt } = useDialog()
  const signal = useAbort()
  const [projects, setProjects] = useState([])
  const [backupJobs, setBackupJobs] = useState({})
  const [startingBackup, setStartingBackup] = useState(null)
  const [error, setError] = useState('')
  const completedJobs = useRef(new Set())
  const [params, setParams] = useSearchParams()
  const estado = params.get('estado') || 'activos'
  const provider = params.get('provider') || ''

  const setParam = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next)
  }

  const load = () => {
    listProjects(estado, provider, { signal })
      .then((items) => {
        setProjects(items)
        const savedJobs = {}
        items.forEach((project) => {
          const jobId = localStorage.getItem(`sb_backup_job_${project.id}`)
          if (jobId) savedJobs[project.id] = { id: jobId, status: 'queued' }
        })
        if (Object.keys(savedJobs).length) setBackupJobs((current) => ({ ...savedJobs, ...current }))
      })
      .catch((e) => {
        if (!isAbortError(e)) setError(e.message)
      })
  }

  useEffect(() => {
    setError('')
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, provider])

  useEffect(() => {
    if (error) toast.err(error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error])

  useEffect(() => {
    const active = Object.entries(backupJobs).filter(([, job]) =>
      ['queued', 'running'].includes(job.status),
    )
    if (!active.length) return undefined
    const timer = setTimeout(async () => {
      const results = await Promise.all(active.map(async ([projectId, job]) => {
        try {
          return [projectId, await getBackupJob(job.id)]
        } catch (err) {
          if (err.status === 404) {
            return [projectId, { id: job.id, status: 'interrupted', detail: 'No se encontró el trabajo guardado.' }]
          }
          return [projectId, job]
        }
      }))
      setBackupJobs((current) => {
        const next = { ...current }
        results.forEach(([projectId, job]) => {
          next[projectId] = job
          if (!['queued', 'running'].includes(job.status)) {
            localStorage.removeItem(`sb_backup_job_${projectId}`)
            if (!completedJobs.current.has(job.id)) {
              completedJobs.current.add(job.id)
              if (job.status === 'completed') toast.ok(`Backup de ${job.slug || projectId} completado.`)
              else toast.err(job.detail || `El backup de ${job.slug || projectId} no se completó.`)
            }
          }
        })
        return next
      })
    }, 1800)
    return () => clearTimeout(timer)
  }, [backupJobs, toast])

  const del = async (p) => {
    const ok = await confirm(`¿Eliminar el proyecto "${p.slug}"? Se conserva su historial.`, {
      title: 'Eliminar proyecto',
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteProject(p.id)
      toast.ok(`Proyecto "${p.slug}" eliminado.`)
      load()
    } catch (e) {
      toast.err(e.message)
    }
  }

  const restore = async (p) => {
    const slug = await prompt('Indica el slug con el que se restaurará el proyecto:', {
      title: 'Restaurar proyecto',
      confirmLabel: 'Restaurar',
      initial: p.slug.replace(/^\(eliminado\)-\d+-/, ''),
    })
    if (slug == null) return
    try {
      await restoreProject(p.id, slug)
      toast.ok(`Proyecto "${slug}" restaurado.`)
      load()
    } catch (e) {
      toast.err(e.message)
    }
  }

  const startBackup = async (project) => {
    setStartingBackup(project.id)
    const requestKey = `sb_backup_request_${project.id}`
    try {
      const key = localStorage.getItem(requestKey) || crypto.randomUUID()
      localStorage.setItem(requestKey, key)
      const job = await enqueueBackup(project.id, key)
      localStorage.removeItem(requestKey)
      localStorage.setItem(`sb_backup_job_${project.id}`, job.id)
      completedJobs.current.delete(job.id)
      setBackupJobs((current) => ({ ...current, [project.id]: job }))
    } catch (err) {
      toast.err(err.message)
    } finally {
      setStartingBackup(null)
    }
  }

  const { user } = useAuth()
  const isAdmin = user?.rol === 'admin'

  return (
    <>
      <PageHead title="Proyectos" sub="Las bases PostgreSQL conectadas con su respaldo automático.">
        <div className="inline-actions">
          <select
            className="select"
            style={{ width: 'auto' }}
            value={provider}
            onChange={(e) => setParam('provider', e.target.value)}
            aria-label="Filtrar por proveedor"
          >
            <option value="">Todos los proveedores</option>
            <option value="postgres">PostgreSQL</option>
            <option value="supabase">Supabase</option>
          </select>
          {isAdmin && (
            <Link className="btn btn-ghost" to={`/proyectos?estado=${estado === 'eliminados' ? 'activos' : 'eliminados'}${provider ? `&provider=${provider}` : ''}`}>
              {estado === 'eliminados' ? 'Ver activos' : 'Ver eliminados'}
            </Link>
          )}
          {isAdmin && (
            <Link className="btn btn-primary" to="/proyectos/nuevo">Nuevo proyecto</Link>
          )}
        </div>
      </PageHead>

      <div className="card">
        <div className="table-scroll">
          <table className="t">
            <thead>
              <tr>
                <th>Identificador</th>
                <th>Nombre</th>
                <th>Proveedor</th>
                <th>Cuenta</th>
                <th>Código</th>
                <th>Estado</th>
                <th className="td-actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.slug}</td>
                  <td>{p.nombre}</td>
                  <td>
                    <Badge tone={p.provider === 'supabase' ? 'info' : 'mid'}>
                      {PROVIDER_LABELS[p.provider] || 'PostgreSQL'}
                    </Badge>
                  </td>
                  <td className="muted">{p.account_nombre}</td>
                  <td className="mono muted">{p.project_ref ? p.project_ref.slice(0, 8) + '…' : '-'}</td>
                  <td>
                    {p.activo ? (
                      <Badge tone="ok">Activo</Badge>
                    ) : (
                      <Badge tone="mid">Eliminado</Badge>
                    )}
                  </td>
                  <td className="td-actions">
                    {p.activo ? (
                      <>
                        {backupJobs[p.id] && (
                          <span className="muted" role="status">
                            {JOB_LABELS[backupJobs[p.id].status] || 'Estado desconocido'}
                          </span>
                        )}
                        {isAdmin && (
                          <button
                            className="btn-link"
                            onClick={() => startBackup(p)}
                            disabled={startingBackup === p.id || ['queued', 'running'].includes(backupJobs[p.id]?.status)}
                          >
                            {startingBackup === p.id ? 'Enviando…' : 'Respaldar ahora'}
                          </button>
                        )}
                        <Link className="btn-link" to={`/proyectos/${p.id}/historial`}>Historial</Link>
                        {isAdmin && (
                          <>
                            <Link className="btn-link" to={`/proyectos/${p.id}/editar`}>Editar</Link>
                            <button className="btn-link btn-link-danger" onClick={() => del(p)}>Eliminar</button>
                          </>
                        )}
                      </>
                    ) : (
                      isAdmin && <button className="btn-link" onClick={() => restore(p)}>Restaurar</button>
                    )}
                  </td>
                </tr>
              ))}
              {!projects.length && (
                <tr className="empty"><td colSpan={7}>No hay proyectos en esta vista.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
