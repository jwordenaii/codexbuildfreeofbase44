const BASE = import.meta.env.VITE_API_BASE_URL || ''

export async function fetchLocalProjects(city) {
  try {
    const res = await fetch(`${BASE}/api/v1/projects/local?city=${encodeURIComponent(city)}`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}
