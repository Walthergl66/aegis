const TOKEN_KEY = 'sb_access_token'
const REFRESH_PATH = '/api/auth/refresh'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  constructor(message, status = 0, data = null) {
    super(message)
    this.status = status
    this.data = data
  }
}

// Renovación del access token vía refresh token en cookie HttpOnly.
// Se comparte entre llamadas simultáneas (una sola petición de refresh).
let refreshing = null

async function refreshAccessToken() {
  if (!refreshing) {
    refreshing = fetch(REFRESH_PATH, { method: 'POST', credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new ApiError('Sesión expirada', res.status)
        const data = await res.json()
        setToken(data.access_token)
        return data.access_token
      })
      .finally(() => {
        refreshing = null
      })
  }
  return refreshing
}

async function redirectToLogin() {
  clearToken()
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login'
  }
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) }
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: options.credentials || 'include',
  })

  if (res.status === 401 && !options._retried && path !== REFRESH_PATH && path !== '/api/auth/login') {
    try {
      await refreshAccessToken()
      return request(path, { ...options, _retried: true })
    } catch {
      await redirectToLogin()
      throw new ApiError('Sesión expirada', 401)
    }
  }

  if (res.status === 401 && path !== REFRESH_PATH && path !== '/api/auth/login') {
    await redirectToLogin()
    throw new ApiError('Sesión expirada', 401)
  }

  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) {
    const detail = data?.detail || `Error HTTP ${res.status}`
    throw new ApiError(typeof detail === 'string' ? detail : JSON.stringify(detail), res.status, data)
  }
  return data
}

async function download(path, options = {}, retried = false) {
  const headers = { ...(options.headers || {}) }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(path, { ...options, headers, credentials: 'include' })

  if (res.status === 401 && !retried) {
    try {
      await refreshAccessToken()
      return download(path, options, true)
    } catch {
      await redirectToLogin()
      throw new ApiError('Sesión expirada', 401)
    }
  }
  if (res.status === 401) {
    await redirectToLogin()
    throw new ApiError('Sesión expirada', 401)
  }
  if (!res.ok) {
    let data = null
    try { data = await res.json() } catch { data = null }
    const detail = data?.detail || `Error HTTP ${res.status}`
    throw new ApiError(typeof detail === 'string' ? detail : JSON.stringify(detail), res.status, data)
  }

  const disposition = res.headers.get('Content-Disposition') || ''
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  const plainName = disposition.match(/filename="?([^";]+)"?/i)?.[1]
  let filename = plainName || 'backup.dump'
  if (encodedName) {
    try { filename = decodeURIComponent(encodedName) } catch { filename = 'backup.dump' }
  }
  return { blob: await res.blob(), filename }
}

export const api = {
  get: (path, options = {}) => request(path, options),
  post: (path, body, options = {}) => request(path, { ...options, method: 'POST', body: JSON.stringify(body ?? {}) }),
  put: (path, body, options = {}) => request(path, { ...options, method: 'PUT', body: JSON.stringify(body ?? {}) }),
  del: (path, options = {}) => request(path, { ...options, method: 'DELETE' }),
  download,
}
