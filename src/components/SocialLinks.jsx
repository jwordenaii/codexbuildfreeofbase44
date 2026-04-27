/**
 * SocialLinks — reusable platform icon links.
 *
 * Props:
 *   platforms  — array of platform keys to show, e.g. ['facebook','instagram']
 *                Defaults to SOCIAL_DISPLAY_ORDER (all platforms).
 *   size       — 'sm' | 'md' | 'lg'  (defaults to 'md')
 *   variant    — 'icon' | 'badge'
 *                'icon'  — icon only with tooltip
 *                'badge' — icon + label text
 *   className  — extra classes on the wrapper
 */

import { SOCIAL_PROFILES, SOCIAL_DISPLAY_ORDER } from '../lib/social'

/* ── SVG icon paths ──────────────────────────────────────────────────── */
function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-full h-full">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.883v2.258h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-full h-full">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  )
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-full h-full">
      <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/>
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-full h-full">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  )
}

function TwitterXIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-full h-full">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  )
}

function NextdoorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-full h-full">
      <path d="M12 2L3 8.5V21h7v-6h4v6h7V8.5L12 2zm0 2.5l6 4.25V19h-3v-6H9v6H6V8.75L12 4.5z"/>
    </svg>
  )
}

const ICONS = {
  facebook:  FacebookIcon,
  instagram: InstagramIcon,
  youtube:   YouTubeIcon,
  linkedin:  LinkedInIcon,
  twitter:   TwitterXIcon,
  nextdoor:  NextdoorIcon,
}

const SIZES = {
  sm: { box: 'w-7 h-7',  icon: 'w-3.5 h-3.5', text: 'text-xs' },
  md: { box: 'w-9 h-9',  icon: 'w-4.5 h-4.5', text: 'text-sm' },
  lg: { box: 'w-11 h-11', icon: 'w-5 h-5',    text: 'text-sm' },
}

export default function SocialLinks({
  platforms = SOCIAL_DISPLAY_ORDER,
  size      = 'md',
  variant   = 'icon',
  className = '',
}) {
  const s = SIZES[size] || SIZES.md

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {platforms.map((key) => {
        const profile = SOCIAL_PROFILES[key]
        if (!profile) return null
        const Icon = ICONS[key]

        if (variant === 'badge') {
          return (
            <a
              key={key}
              href={profile.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Follow us on ${profile.label}`}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-full transition-colors"
            >
              <span className={`${s.icon} flex-shrink-0`}>
                {Icon && <Icon />}
              </span>
              <span className={s.text}>{profile.label}</span>
            </a>
          )
        }

        // Default: icon only
        return (
          <a
            key={key}
            href={profile.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Follow us on ${profile.label}`}
            title={profile.label}
            className={`${s.box} rounded-lg bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-all hover:scale-110 flex-shrink-0`}
          >
            <span className={s.icon}>
              {Icon && <Icon />}
            </span>
          </a>
        )
      })}
    </div>
  )
}
