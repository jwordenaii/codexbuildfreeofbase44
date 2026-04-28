import { useEffect, useRef, useState } from 'react'

/**
 * Animates a number from 0 to `end` when the element scrolls into view.
 * Renders `prefix + formattedNumber + suffix`.
 *
 * Props:
 *   end      — target number (required)
 *   prefix   — string prepended to the number (default "")
 *   suffix   — string appended to the number (default "")
 *   duration — animation duration in ms (default 1800)
 *   decimals — decimal places to show (default 0)
 */
export default function CountUp({ end, prefix = '', suffix = '', duration = 1800, decimals = 0 }) {
  const [value, setValue] = useState(0)
  const ref = useRef(null)
  const hasRun = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || hasRun.current) return
        hasRun.current = true

        const start = performance.now()
        const tick = (now) => {
          const elapsed = now - start
          const progress = Math.min(elapsed / duration, 1)
          // ease-out cubic
          const eased = 1 - Math.pow(1 - progress, 3)
          setValue(parseFloat((eased * end).toFixed(decimals)))
          if (progress < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      },
      { threshold: 0.4 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [end, duration, decimals])

  const display = decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString()

  return (
    <span ref={ref}>
      {prefix}
      {display}
      {suffix}
    </span>
  )
}
