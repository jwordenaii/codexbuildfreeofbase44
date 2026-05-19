import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { SERVICES, AREAS, SITE } from '@/config/site.js'
import { trackQuoteSubmit } from '@/lib/analytics.js'
import { cn } from '@/lib/utils.js'

const SERVICE_OPTIONS = SERVICES.map((s) => s.title)
const AREA_OPTIONS = [
  ...AREAS.primary.map((a) => a.name),
  ...AREAS.growing.map((a) => a.name),
  ...AREAS.mainland.map((a) => a.name),
  'Other / Not Listed',
]

export default function QuoteForm({ className }) {
  const [status, setStatus] = useState('idle') // idle | loading | success | error

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm()

  const onSubmit = async (data) => {
    setStatus('loading')
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL
      if (apiUrl) {
        await fetch(`${apiUrl}/api/v1/leads/quote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.name,
            email: data.email,
            phone: data.phone,
            address: data.address,
            service: data.service,
            serviceArea: data.serviceArea,
            message: data.message,
            source: 'obx-paving-website',
          }),
        })
      }
      // Fire conversion even if no API configured (for testing)
      trackQuoteSubmit()
      setStatus('success')
      reset()
    } catch {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className={cn('flex flex-col items-center justify-center gap-4 py-16 text-center', className)}>
        <div className="w-16 h-16 rounded-full bg-teal/10 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-teal" />
        </div>
        <h3 className="font-display text-2xl uppercase text-navy tracking-tight">
          Quote Request Received!
        </h3>
        <p className="text-slate-500 text-sm max-w-sm leading-relaxed">
          We'll review your project details and reach out within one business day to schedule
          your free site assessment.
        </p>
        <button
          onClick={() => setStatus('idle')}
          className="btn-ghost mt-2 text-sm"
        >
          Submit another request
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={cn('space-y-5', className)}
      noValidate
    >
      {/* Name + Phone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="form-label">Full Name *</label>
          <input
            type="text"
            placeholder="John Smith"
            className={cn('form-input', errors.name && 'border-red-400 focus:ring-red-300')}
            {...register('name', { required: 'Name is required' })}
          />
          {errors.name && <p className="form-error">{errors.name.message}</p>}
        </div>
        <div>
          <label className="form-label">Phone *</label>
          <input
            type="tel"
            placeholder="(252) 555-0100"
            className={cn('form-input', errors.phone && 'border-red-400 focus:ring-red-300')}
            {...register('phone', { required: 'Phone number is required' })}
          />
          {errors.phone && <p className="form-error">{errors.phone.message}</p>}
        </div>
      </div>

      {/* Email */}
      <div>
        <label className="form-label">Email Address *</label>
        <input
          type="email"
          placeholder="john@example.com"
          className={cn('form-input', errors.email && 'border-red-400 focus:ring-red-300')}
          {...register('email', {
            required: 'Email is required',
            pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email' },
          })}
        />
        {errors.email && <p className="form-error">{errors.email.message}</p>}
      </div>

      {/* Service + Area */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="form-label">Service Needed *</label>
          <select
            className={cn('form-input', errors.service && 'border-red-400')}
            {...register('service', { required: 'Please select a service' })}
          >
            <option value="">Select a service…</option>
            {SERVICE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
            <option value="Multiple / Not Sure">Multiple / Not Sure</option>
          </select>
          {errors.service && <p className="form-error">{errors.service.message}</p>}
        </div>
        <div>
          <label className="form-label">Service Area *</label>
          <select
            className={cn('form-input', errors.serviceArea && 'border-red-400')}
            {...register('serviceArea', { required: 'Please select your area' })}
          >
            <option value="">Select your area…</option>
            {AREA_OPTIONS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          {errors.serviceArea && <p className="form-error">{errors.serviceArea.message}</p>}
        </div>
      </div>

      {/* Property address */}
      <div>
        <label className="form-label">Property Address</label>
        <input
          type="text"
          placeholder="123 Beach Rd, Nags Head, NC"
          className="form-input"
          {...register('address')}
        />
      </div>

      {/* Message */}
      <div>
        <label className="form-label">Project Details</label>
        <textarea
          rows={4}
          placeholder="Tell us about your project — size, current condition, any special requirements…"
          className="form-input resize-none"
          {...register('message')}
        />
      </div>

      {/* Error message */}
      {status === 'error' && (
        <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 border border-red-100 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Submission failed. Please call us directly at {SITE.phone}.
        </div>
      )}

      <button
        type="submit"
        disabled={status === 'loading'}
        className="btn-primary w-full py-4 text-base disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {status === 'loading' ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Sending…
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Request Free Quote
          </>
        )}
      </button>

      <p className="text-slate-400 text-xs text-center">
        No spam. We typically respond within 1 business day.
      </p>
    </form>
  )
}
