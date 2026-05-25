const TOKEN_KEY  = 'wf_token'
const USER_KEY   = 'wf_user'

export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY)) ?? null
  } catch {
    return null
  }
}

export function isOwner(user) {
  return user?.role === 'owner' || user?.role === 'admin'
}

export function isAuthenticated() {
  return !!getToken() && !!getUser()
}
