import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Sparkles, Camera, AlertTriangle, CheckCircle2, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/api/client';
import { trackPhotoAnalysis, trackEvent } from '@/lib/analytics';

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function polygonArea(points) {
  if (!Array.isArray(points) || points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return Math.abs(sum / 2);
}

const GRADE_STYLES = {
  excellent: { bg: 'bg-green-500/10', border: 'border-green-500/40', text: 'text-green-400', icon: CheckCircle2, label: 'Excellent' },
  good: { bg: 'bg-primary/10', border: 'border-primary/40', text: 'text-primary', icon: CheckCircle2, label: 'Good' },
  fair: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/40', text: 'text-yellow-400', icon: Wrench, label: 'Fair' },
  poor: { bg: 'bg-orange-500/10', border: 'border-orange-500/40', text: 'text-orange-400', icon: AlertTriangle, label: 'Poor' },
  failed: { bg: 'bg-destructive/10', border: 'border-destructive/40', text: 'text-destructive', icon: AlertTriangle, label: 'Failed' },
};

export default function AIPhotoInspector() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [markupPoints, setMarkupPoints] = useState([]);
  const inputRef = useRef(null);
  const markupRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!selected.type.startsWith('image/')) {
      toast.error('Please upload an image file.');
      return;
    }
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setAnalysis(null);
    setMarkupPoints([]);
  };

  const handleMarkupPointer = (e) => {
    if (!previewUrl || loading || analysis || !markupRef.current) return;

    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const rect = markupRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const point = {
      x: clamp01((e.clientX - rect.left) / rect.width),
      y: clamp01((e.clientY - rect.top) / rect.height),
    };

    setMarkupPoints((prev) => (prev.length >= 24 ? prev : [...prev, point]));
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    trackEvent('photo_analysis_started');

    try {
      const markedAreaPercent = polygonArea(markupPoints) * 100;
      const markup = {
        points: markupPoints.map((p) => ({
          x: Number(p.x.toFixed(4)),
          y: Number(p.y.toFixed(4)),
        })),
        point_count: markupPoints.length,
        marked_area_percent: Number(markedAreaPercent.toFixed(2)),
      };

      const markupSummary =
        markupPoints.length >= 3
          ? `Customer marked the target paving area with ${markup.point_count} points. Marked area estimate: ${markup.marked_area_percent}% of the photo frame. Use this region as the primary scope for condition findings and required prep before paving.`
          : '';

      const enrichedContext = [context.trim(), markupSummary].filter(Boolean).join(' ');

      // Upload file to get a public URL
      const { file_url } = await api.integrations.Core.UploadFile({ file });

      // Call the Claude Opus-powered backend function
      const response = await api.functions.invoke('analyzeDrivewayPhoto', {
        imageUrl: file_url,
        context: enrichedContext || undefined,
        markup: markupPoints.length ? markup : undefined,
      });

      const result = response.data?.analysis;
      if (!result) {
        toast.error('Analysis failed — please try a different photo.');
        setLoading(false);
        return;
      }

      setAnalysis(result);
      trackPhotoAnalysis(result);
      toast.success('Analysis complete.');
    } catch (error) {
      toast.error('Something went wrong. Please try again.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreviewUrl(null);
    setContext('');
    setAnalysis(null);
    setMarkupPoints([]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const gradeStyle = analysis?.condition_grade ? GRADE_STYLES[analysis.condition_grade] : null;
  const GradeIcon = gradeStyle?.icon;

  return (
    <section id="ai-inspector" className="border-t border-border py-16 md:py-24">
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 border border-primary/40 bg-primary/10 px-4 py-2 mb-4">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-display text-primary text-xs tracking-[0.3em] uppercase">Photo Review</span>
          </div>
          <h2 className="font-display font-black text-foreground text-4xl md:text-6xl uppercase tracking-tight">
            Pavement Photo Review
          </h2>
          <p className="font-body text-muted-foreground text-lg mt-4 max-w-xl mx-auto leading-relaxed">
            Send clear photos of your driveway or parking lot so our team can understand cracks, potholes, drainage, edges, and repair needs before the estimate.
          </p>
        </div>

        {!analysis && (
          <div className="border border-border bg-card p-6 md:p-10">
            {/* Upload zone */}
            <label
              htmlFor="photo-upload"
              className={`block cursor-pointer border-2 border-dashed transition-colors duration-300 ${
                previewUrl ? 'border-primary/40' : 'border-border hover:border-primary/40'
              }`}
            >
              <input
                ref={inputRef}
                id="photo-upload"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              {previewUrl ? (
                <div
                  ref={markupRef}
                  className="relative aspect-video overflow-hidden bg-background touch-none"
                  onPointerDown={handleMarkupPointer}
                >
                  <img src={previewUrl} alt="Pavement to analyze" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                  <svg
                    className="absolute inset-0 w-full h-full"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    {markupPoints.length >= 3 && (
                      <polygon
                        points={markupPoints.map((p) => `${(p.x * 100).toFixed(2)},${(p.y * 100).toFixed(2)}`).join(' ')}
                        fill="rgba(22,163,74,0.20)"
                        stroke="rgba(34,197,94,0.95)"
                        strokeWidth="1"
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                    {markupPoints.map((point, idx) => (
                      <g key={`pt-${idx}`}>
                        <circle
                          cx={(point.x * 100).toFixed(2)}
                          cy={(point.y * 100).toFixed(2)}
                          r="1.1"
                          fill="rgba(34,197,94,1)"
                          stroke="rgba(255,255,255,0.95)"
                          strokeWidth="0.35"
                          vectorEffect="non-scaling-stroke"
                        />
                        <text
                          x={(point.x * 100 + 1.4).toFixed(2)}
                          y={(point.y * 100 - 1.2).toFixed(2)}
                          fill="white"
                          fontSize="2.6"
                          fontWeight="700"
                        >
                          {idx + 1}
                        </text>
                      </g>
                    ))}
                  </svg>
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent flex items-end justify-center pb-6">
                    <span className="font-display text-foreground text-xs tracking-wider uppercase bg-background/80 px-4 py-2 text-center">
                      Tap image to mark paving area, or click to change photo
                    </span>
                  </div>
                </div>
              ) : (
                <div className="aspect-video flex flex-col items-center justify-center gap-3 px-6 py-12">
                  <div className="w-14 h-14 bg-primary/10 flex items-center justify-center">
                    <Camera className="w-6 h-6 text-primary" />
                  </div>
                  <p className="font-display font-bold text-foreground text-sm tracking-wider uppercase text-center">
                    Upload a photo of your pavement
                  </p>
                  <p className="font-body text-muted-foreground text-sm text-center max-w-sm">
                    JPG, PNG, or HEIC · Works with phone camera shots · No signup required
                  </p>
                </div>
              )}
            </label>

            {previewUrl && (
              <div className="mt-4 border border-border bg-muted/30 p-4 space-y-3">
                <p className="font-display text-muted-foreground text-[11px] tracking-[0.25em] uppercase">
                  Property Markup (Phone-Friendly)
                </p>
                <p className="font-body text-muted-foreground text-xs leading-relaxed">
                  Tap around the exact pavement zone you want reviewed. This helps us understand the condition and prepare better questions before paving.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setMarkupPoints((prev) => prev.slice(0, -1))}
                    disabled={!markupPoints.length || loading}
                    className="border border-border text-foreground font-display font-bold text-[11px] tracking-wider uppercase px-3 py-2 min-h-[40px] disabled:opacity-50"
                  >
                    Undo Point
                  </button>
                  <button
                    type="button"
                    onClick={() => setMarkupPoints([])}
                    disabled={!markupPoints.length || loading}
                    className="border border-border text-foreground font-display font-bold text-[11px] tracking-wider uppercase px-3 py-2 min-h-[40px] disabled:opacity-50"
                  >
                    Clear Markup
                  </button>
                </div>
                <p className="font-body text-muted-foreground text-xs">
                  {markupPoints.length >= 3
                    ? `Marked points: ${markupPoints.length} · Estimated marked frame area: ${(polygonArea(markupPoints) * 100).toFixed(1)}%`
                    : 'Add at least 3 points to define a marked area polygon.'}
                </p>
              </div>
            )}

            {/* Optional context */}
            <div className="mt-6">
              <label className="font-display text-muted-foreground text-xs tracking-wider uppercase block mb-2">
                Optional: tell us about the property
              </label>
              <input
                type="text"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="e.g. 800 sq ft driveway in Richmond VA, last sealed 5 years ago"
                className="w-full h-12 bg-muted border border-border text-foreground placeholder:text-muted-foreground/60 px-4 font-body focus:border-primary focus:outline-none transition-colors"
              />
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button
                onClick={handleAnalyze}
                disabled={!file || loading}
                className={`flex-1 flex items-center justify-center gap-2 font-display font-bold text-sm tracking-wider uppercase min-h-[48px] px-8 py-3 transition-colors ${
                  file && !loading
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Reviewing photo…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Review Photo
                  </>
                )}
              </button>
              {previewUrl && !loading && (
                <button
                  onClick={reset}
                  className="font-display font-bold text-sm tracking-wider uppercase min-h-[48px] px-6 py-3 border border-border text-foreground hover:border-foreground/40 transition-colors"
                >
                  Reset
                </button>
              )}
            </div>

            <p className="font-body text-muted-foreground text-xs text-center mt-4">
              Free · No email required · Analysis takes ~15 seconds
            </p>
          </div>
        )}

        {/* Analysis result */}
        <AnimatePresence>
          {analysis && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Grade banner */}
              {gradeStyle && (
                <div className={`border ${gradeStyle.border} ${gradeStyle.bg} p-6 flex items-center gap-4`}>
                  <div className={`w-14 h-14 flex items-center justify-center ${gradeStyle.bg} border ${gradeStyle.border}`}>
                    <GradeIcon className={`w-7 h-7 ${gradeStyle.text}`} />
                  </div>
                  <div>
                    <p className="font-display text-muted-foreground text-xs tracking-[0.3em] uppercase">Condition Grade</p>
                    <p className={`font-display font-black text-3xl uppercase tracking-tight ${gradeStyle.text}`}>
                      {gradeStyle.label}
                    </p>
                  </div>
                  {analysis.estimated_age_years && (
                    <div className="ml-auto text-right">
                      <p className="font-display text-muted-foreground text-xs tracking-[0.3em] uppercase">Est. Age</p>
                      <p className="font-display font-black text-foreground text-2xl">
                        ~{analysis.estimated_age_years} yrs
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Professional summary */}
              <div className="border border-border bg-card p-6">
                <p className="font-display text-primary text-xs tracking-[0.3em] uppercase mb-3">Professional Summary</p>
                <p className="font-body text-foreground text-base leading-relaxed">
                  {analysis.professional_summary}
                </p>
              </div>

              {/* Issues */}
              {analysis.primary_issues?.length > 0 && (
                <div className="border border-border bg-card p-6">
                  <p className="font-display text-primary text-xs tracking-[0.3em] uppercase mb-4">Issues Identified</p>
                  <ul className="space-y-2">
                    {analysis.primary_issues.map((issue, i) => (
                      <li key={i} className="flex items-start gap-3 font-body text-foreground text-sm">
                        <span className="text-primary mt-0.5">▪</span>
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendation + urgency */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {analysis.recommended_action && (
                  <div className="border border-border bg-card p-5">
                    <p className="font-display text-muted-foreground text-xs tracking-[0.3em] uppercase mb-2">Recommended</p>
                    <p className="font-display font-bold text-foreground text-sm uppercase tracking-wider">
                      {analysis.recommended_action.replace(/_/g, ' ')}
                    </p>
                  </div>
                )}
                {analysis.urgency && (
                  <div className="border border-border bg-card p-5">
                    <p className="font-display text-muted-foreground text-xs tracking-[0.3em] uppercase mb-2">Urgency</p>
                    <p className="font-display font-bold text-foreground text-sm uppercase tracking-wider">
                      {analysis.urgency.replace(/_/g, ' ')}
                    </p>
                  </div>
                )}
                {analysis.estimated_cost_range && (
                  <div className="border border-primary/30 bg-primary/5 p-5">
                    <p className="font-display text-primary text-xs tracking-[0.3em] uppercase mb-2">Est. Cost</p>
                    <p className="font-display font-bold text-foreground text-sm">
                      {analysis.estimated_cost_range}
                    </p>
                  </div>
                )}
              </div>

              {/* Technical notes */}
              {analysis.technical_notes && (
                <div className="border border-border bg-muted/30 p-6">
                  <p className="font-display text-muted-foreground text-xs tracking-[0.3em] uppercase mb-3">Technical Notes</p>
                  <p className="font-body text-muted-foreground text-sm leading-relaxed italic">
                    {analysis.technical_notes}
                  </p>
                </div>
              )}

              {(analysis.required_prep_before_paving?.length > 0 || analysis.prep_notes) && (
                <div className="border border-brand-navy/20 bg-brand-navy/5 p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-display text-brand-navy text-xs tracking-[0.3em] uppercase">Required Prep Before Paving</p>
                    {analysis.prep_priority && (
                      <span className="font-display font-bold text-[11px] uppercase tracking-wider text-brand-navy/80 border border-brand-navy/30 px-2 py-1">
                        Priority: {String(analysis.prep_priority).replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>

                  {analysis.required_prep_before_paving?.length > 0 && (
                    <ul className="space-y-2">
                      {analysis.required_prep_before_paving.map((step, idx) => (
                        <li key={`prep-${idx}`} className="flex items-start gap-3 font-body text-foreground text-sm">
                          <span className="mt-0.5 text-brand-navy font-bold">{idx + 1}.</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {(analysis.surface_drainage_risk || analysis.base_failure_risk) && (
                    <p className="font-body text-muted-foreground text-xs">
                      Drainage risk: {analysis.surface_drainage_risk || 'n/a'} · Base failure risk: {analysis.base_failure_risk || 'n/a'}
                    </p>
                  )}

                  {analysis.prep_notes && (
                    <p className="font-body text-muted-foreground text-sm leading-relaxed">
                      {analysis.prep_notes}
                    </p>
                  )}
                </div>
              )}

              {/* CTA */}
              <div className="border border-primary bg-primary/5 p-6 md:p-8 text-center">
                <p className="font-display font-black text-foreground text-xl md:text-2xl uppercase tracking-tight mb-2">
                  Want a precise written quote?
                </p>
                <p className="font-body text-muted-foreground text-sm mb-5 max-w-md mx-auto">
                  Our foreman will visit your property free of charge and deliver an itemized estimate within 24 hours.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <a
                    href="#quote"
                    className="bg-primary text-primary-foreground font-display font-bold text-sm tracking-wider uppercase px-8 py-3 min-h-[48px] inline-flex items-center justify-center hover:bg-primary/90 transition-colors"
                  >
                    Get Free Estimate
                  </a>
                  <button
                    onClick={reset}
                    className="border border-border text-foreground font-display font-bold text-sm tracking-wider uppercase px-8 py-3 min-h-[48px] hover:border-foreground/40 transition-colors"
                  >
                    Analyze Another Photo
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
