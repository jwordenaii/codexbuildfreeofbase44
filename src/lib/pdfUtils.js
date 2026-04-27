/**
 * pdfUtils.js — Shared PDF download helper.
 *
 * Decodes a base64-encoded PDF string and triggers a browser download.
 */

/**
 * Decode a base64 PDF string and trigger a browser file download.
 *
 * @param {string} b64     - Base64-encoded PDF bytes
 * @param {string} filename - Suggested filename (e.g. 'proposal-lead-1.pdf')
 */
export function downloadPdf(b64, filename) {
  const bytes = atob(b64)
  const arr   = new Uint8Array(Array.from(bytes, (c) => c.charCodeAt(0)))
  const blob  = new Blob([arr], { type: 'application/pdf' })
  const url   = URL.createObjectURL(blob)
  const a     = document.createElement('a')
  a.href      = url
  a.download  = filename
  a.click()
  URL.revokeObjectURL(url)
}
