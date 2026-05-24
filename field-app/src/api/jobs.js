import { api, offlinePost } from './client'

export async function getJobs() {
  return api.get('/api/v1/admin/dispatch/jobs')
}

export async function getTrucks() {
  return api.get('/api/v1/admin/dispatch/trucks')
}

export async function getDispatchSnapshot() {
  return api.get('/api/v1/admin/dispatch/snapshot')
}

export async function getThermalWindow({ lat, lng, mixTempF = 290, liftIn = 2 }) {
  const params = new URLSearchParams({
    lat: String(lat), lng: String(lng),
    mix_temp_f: String(mixTempF),
    lift_in: String(liftIn),
  })
  return api.get(`/api/v1/thermal/window?${params}`)
}

export async function postCompactionPing(ping) {
  return offlinePost('/api/v1/iot/compaction-ping', ping, 'compaction')
}

export async function getCompactionSummary(siteId) {
  return api.get(`/api/v1/iot/compaction-summary/${siteId}`)
}

export async function logMaterials(jobId, materials) {
  return offlinePost('/api/v1/staff/job-materials', { jobId, materials }, 'materials')
}

export async function submitCompletion(payload) {
  return offlinePost('/api/v1/staff/job-complete', payload, 'completion')
}

export async function getWeather(lat, lng) {
  return api.get(`/api/v1/weather?lat=${lat}&lng=${lng}`)
}
