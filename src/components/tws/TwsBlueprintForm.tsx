// TwsBlueprintForm.tsx
// src/components/tws/TwsBlueprintForm.tsx
// The generic blueprint renderer — THE SaaS MOAT

import { useState, useCallback, useEffect, memo } from 'react';
import type { FC, ChangeEvent } from 'react';
import type {
  TwsBlueprint, BlueprintSection, BlueprintField,
  TwsSubmissionResult,
} from '../../types/the-worden-standard.types';

export interface TwsBlueprintFormProps {
  blueprint: TwsBlueprint;
  tenantId: string;
  dbAvailable: boolean;
  searchQuery?: string;
  onSubmitSuccess?: (result: TwsSubmissionResult) => void;
}

function mkAuditSig(module: string, tenantId: string): string {
  const base = module + tenantId + new Date().toDateString();
  const h = Array.from(base)
    .reduce((acc, c) => (Math.imul(31, acc) + c.charCodeAt(0)) | 0, 0)
    .toString(16).padStart(8, '0').toUpperCase();
  const ts = new Date().toISOString().replace(/[^0-9]/g,'').substring(0,12);
  return 'TWS-' + h + '-' + ts;
}

function highlight(text: string, query: string): string {
  if (!query || query.length < 2) return text;
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp('(' + safe + ')', 'gi'), '<mark class="tws-search-highlight">$1</mark>');
}

function matchesSearch(section: BlueprintSection, query: string): boolean {
  if (!query || query.length < 2) return true;
  const q = query.toLowerCase();
  if (section.title.toLowerCase().includes(q)) return true;
  if (section.description?.toLowerCase().includes(q)) return true;
  return section.fields.some(f =>
    f.label.toLowerCase().includes(q) ||
    f.hint?.toLowerCase().includes(q) ||
    f.placeholder?.toLowerCase().includes(q)
  );
}
interface FieldProps {
  field: BlueprintField;
  value: string;
  onChange: (id: string, val: string) => void;
  searchQuery?: string;
}

const FieldInput: FC<FieldProps> = memo(({ field, value, onChange, searchQuery }) => {
  const labelText = field.label + (field.required ? ' *' : '');
  const labelHtml = searchQuery ? highlight(labelText, searchQuery) : labelText;

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    onChange(field.id, e.target.value);

  const isWide = field.type === 'textarea' || field.type === 'checkbox' || field.type === 'radio' || field.type === 'signature';

  let control: React.ReactNode;

  if (field.type === 'textarea') {
    control = (
      <textarea id={field.id} name={field.id} required={field.required}
        placeholder={field.placeholder ?? ''} className="ws-input"
        value={value} rows={4} style={{ resize: 'vertical', minHeight: 80 }}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(field.id, e.target.value)} />
    );
  } else if (field.type === 'select') {
    control = (
      <select id={field.id} name={field.id} required={field.required}
        className="ws-input" value={value}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(field.id, e.target.value)}>
        <option value="">-- Select --</option>
        {(field.options ?? []).map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    );
  } else if (field.type === 'checkbox') {
    control = (
      <div className="tws-check-group">
        {(field.options ?? [{ value: field.id, label: field.label }]).map(opt => (
          <label key={opt.value} className="tws-check-item">
            <input type="checkbox" name={field.id} value={opt.value}
              checked={value.includes(opt.value)}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const cur = value ? value.split(',').filter(Boolean) : [];
                const next = e.target.checked ? [...cur, opt.value] : cur.filter(v => v !== opt.value);
                onChange(field.id, next.join(','));
              }} />
            {opt.label}
          </label>
        ))}
      </div>
    );
  } else if (field.type === 'radio') {
    control = (
      <div className="tws-check-group">
        {(field.options ?? []).map(opt => (
          <label key={opt.value} className="tws-check-item">
            <input type="radio" name={field.id} value={opt.value}
              checked={value === opt.value} onChange={() => onChange(field.id, opt.value)} />
            {opt.label}
          </label>
        ))}
      </div>
    );
  } else if (field.type === 'file') {
    control = (
      <input id={field.id} name={field.id} type="file" className="ws-input"
        accept={field.accept} required={field.required}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          onChange(field.id, e.target.files?.[0]?.name ?? '')} />
    );
  } else if (field.type === 'signature') {
    control = (
      <input id={field.id} name={field.id} type="text" className="ws-input"
        required={field.required} placeholder="Type full legal name as signature"
        value={value} style={{ fontStyle: 'italic', letterSpacing: '0.05em' }}
        onChange={handleChange} />
    );
  } else {
    control = (
      <input id={field.id} name={field.id} type={field.type} className="ws-input"
        required={field.required} placeholder={field.placeholder ?? ''}
        value={value} onChange={handleChange} />
    );
  }

  return (
    <div className={'tws-field' + (isWide ? ' tws-field-full' : '')}>
      <label className="tws-field-label" htmlFor={field.id}
        dangerouslySetInnerHTML={{ __html: labelHtml }} />
      {control}
      {field.hint && <span className="tws-field-hint">{field.hint}</span>}
    </div>
  );
});
interface SectionProps {
  section: BlueprintSection;
  values: Record<string, string>;
  onChange: (id: string, val: string) => void;
  idx: number;
  searchQuery?: string;
}

const BlueprintSectionBlock: FC<SectionProps> = memo(({ section, values, onChange, idx, searchQuery }) => {
  if (!matchesSearch(section, searchQuery ?? '')) return null;
  return (
    <div className="tws-section">
      <div className="tws-section-header">
        <div className="tws-section-num">Section {String(idx + 1).padStart(2, '0')}</div>
        <div className="ws-heading-sm">{section.title}</div>
        {section.description && <p className="ws-body-sm" style={{ marginTop: 4 }}>{section.description}</p>}
      </div>
      <div className="tws-fields">
        {section.fields.map(field => (
          <FieldInput key={field.id} field={field}
            value={values[field.id] ?? field.defaultValue ?? ''}
            onChange={onChange} searchQuery={searchQuery} />
        ))}
      </div>
    </div>
  );
});

export const TwsBlueprintForm: FC<TwsBlueprintFormProps> = ({ blueprint, tenantId, dbAvailable, searchQuery, onSubmitSuccess }) => {
  const [values, setValues] = useState<Record<string, string>>(() => {
    // Init from localStorage if available
    try {
      const saved = localStorage.getItem('tws_draft_' + blueprint.module + '_' + tenantId);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [submitting, setSubmitting] = useState(false);
  const [auditSig, setAuditSig] = useState(() => mkAuditSig(blueprint.module, tenantId));
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback((id: string, val: string) => {
    setValues(prev => {
      const next = { ...prev, [id]: val };
      try { localStorage.setItem('tws_draft_' + blueprint.module + '_' + tenantId, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [blueprint.module, tenantId]);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true); setError(null);
    const sig = mkAuditSig(blueprint.module, tenantId);
    setAuditSig(sig);
    try {
      const res = await fetch('/.netlify/functions/tws-blueprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: blueprint.module, tenant_id: tenantId, payload: values, submitted_by: '' }),
      });
      const data: TwsSubmissionResult = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data));
      // Clear draft on success
      try { localStorage.removeItem('tws_draft_' + blueprint.module + '_' + tenantId); } catch {}
      setToast('Saved ' + (data.persisted_to === 'database' ? 'to database' : 'locally') + ' — ' + sig);
      setTimeout(() => setToast(null), 6000);
      onSubmitSuccess?.(data);
    } catch (e) {
      // localStorage fallback
      const sig2 = mkAuditSig(blueprint.module, tenantId);
      const submission = { module: blueprint.module, tenant_id: tenantId, payload: values, audit_sig: sig2, submitted_at: new Date().toISOString() };
      try {
        const key = 'tws_submissions_' + blueprint.module + '_' + tenantId;
        const prev = JSON.parse(localStorage.getItem(key) ?? '[]');
        localStorage.setItem(key, JSON.stringify([...prev, submission]));
      } catch {}
      setToast('Saved locally — ' + sig2 + ' (connect DB for tenant sync)');
      setTimeout(() => setToast(null), 8000);
      onSubmitSuccess?.({ success: true, audit_signature: sig2, persisted_to: 'localStorage' });
    } finally { setSubmitting(false); }
  }, [blueprint.module, tenantId, values, onSubmitSuccess]);

  const filteredSections = blueprint.sections.filter(s => matchesSearch(s, searchQuery ?? ''));
  const showFiltered = (searchQuery?.length ?? 0) >= 2;

  return (
    <>
      <div className="tws-module-header">
        <div className="tws-module-meta">
          <span className="tws-module-icon">📄</span>
          <div className="ws-heading-md">{blueprint.title}</div>
        </div>
        {blueprint.subtitle && <div className="ws-body-sm">{blueprint.subtitle}</div>}
        <p className="ws-body-sm" style={{ marginTop: 6, color: 'var(--ws-text-dim)' }}>{blueprint.description}</p>
        {(blueprint.compliance ?? []).length > 0 && (
          <div className="tws-module-compliance">
            {blueprint.compliance!.map(c => <span key={c} className="tws-compliance-tag">{c}</span>)}
          </div>
        )}
      </div>

      <form className="tws-form" onSubmit={handleSubmit}>
        {(showFiltered ? filteredSections : blueprint.sections).map((section, idx) => (
          <BlueprintSectionBlock key={section.id} section={section} values={values}
            onChange={handleChange} idx={idx} searchQuery={searchQuery} />
        ))}
        {showFiltered && filteredSections.length === 0 && (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ws-text-dim)', fontSize: 12 }}>
            No fields match "{searchQuery}"
          </div>
        )}
        <div className="tws-form-footer">
          <div className="tws-audit-sig">{auditSig}</div>
          <div className="tws-submit-row">
            {!dbAvailable && <span className="ws-pill ws-pill--warn" style={{ fontSize: 9 }}>LOCAL ONLY</span>}
            <button type="submit" className="ws-btn ws-btn--primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Submit & Sign'}
            </button>
          </div>
        </div>
      </form>

      {error && <div className="ws-alert ws-alert--error" style={{ margin: '0 28px 16px' }}>{error}</div>}
      {toast && <div className="tws-toast">✓ {toast}</div>}
    </>
  );
};

export default TwsBlueprintForm;
