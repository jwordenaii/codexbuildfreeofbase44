import { api, offlinePost } from './client'

export async function login(username, password) {
  return api.post('/api/v1/staff/login', { body: { username, password } })
}

export async function me() {
  return api.get('/api/v1/staff/me')
}

export async function clockIn({ lat, lng, note, photo } = {}) {
  const form = new FormData()
  if (note)  form.append('note', note)
  if (lat)   form.append('gps_lat', String(lat))
  if (lng)   form.append('gps_lng', String(lng))
  if (photo) form.append('photo', photo)
  return api.post('/api/v1/staff/checkin', { form })
}

export async function myCheckins() {
  return api.get('/api/v1/staff/checkins')
}

export async function myProfile() {
  return api.get('/api/v1/staff/my-profile')
}
