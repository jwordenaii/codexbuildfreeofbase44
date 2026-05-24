import { api } from './client'

// Submit photo for AI condition assessment
// type: 'compaction' | 'base' | 'existing' | 'asphalt'
export async function analyzePhoto(file, type = 'compaction', context = {}) {
  const form = new FormData()
  form.append('photo', file)
  form.append('scan_type', type)
  if (context.jobId)    form.append('job_id',    String(context.jobId))
  if (context.siteId)   form.append('site_id',   String(context.siteId))
  if (context.rolerId)  form.append('roller_id', context.rolerId)
  if (context.notes)    form.append('notes',     context.notes)
  return api.post('/api/v1/ai/photo-inspect', { form })
}

// Log asphalt temp from truck
export async function logAsphaltTemp({ truckId, tempF, jobId, lat, lng }) {
  return api.post('/api/v1/thermal/log', {
    body: { truck_id: truckId, temp_f: tempF, job_id: jobId, lat, lng }
  })
}
