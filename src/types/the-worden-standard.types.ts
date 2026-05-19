// the-worden-standard.types.ts
// src/types/the-worden-standard.types.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared types for TheWordenStandard SaaS compliance shell
// ─────────────────────────────────────────────────────────────────────────────

// ─── Module registry ──────────────────────────────────────────────────────────

export type TwsModuleKey =
  | 'background-checks'
  | 'employee-handbook'
  | 'hiring-onboarding'
  | 'legal-master'
  | 'payroll-compliance'
  | 'training-videos'
  | 'va-compliance'
  | 'wet-ink-onboarding-packet';

export const TWS_MODULES: TwsModuleMeta[] = [
  { key: 'background-checks',        label: 'Background Checks',       icon: '🔍', color: '#60a5fa' },
  { key: 'employee-handbook',        label: 'Employee Handbook',        icon: '📖', color: '#34d399' },
  { key: 'hiring-onboarding',        label: 'Hiring & Onboarding',      icon: '👤', color: '#a78bfa' },
  { key: 'legal-master',             label: 'Legal Master',             icon: '⚖',  color: '#f59e0b' },
  { key: 'payroll-compliance',       label: 'Payroll Compliance',       icon: '💰', color: '#10b981' },
  { key: 'training-videos',          label: 'Training Videos',          icon: '🎬', color: '#f43f5e' },
  { key: 'va-compliance',            label: 'VA Compliance',            icon: '🏛',  color: '#fb923c' },
  { key: 'wet-ink-onboarding-packet',label: 'Wet Ink Packet',          icon: '✍',  color: '#e879f9' },
];

export interface TwsModuleMeta {
  key: TwsModuleKey;
  label: string;
  icon: string;
  color: string;
}

// ─── Blueprint schema ─────────────────────────────────────────────────────────

export type BlueprintFieldType =
  | 'text' | 'textarea' | 'email' | 'tel' | 'number' | 'date'
  | 'select' | 'checkbox' | 'radio' | 'file' | 'signature' | 'url';

export interface BlueprintFieldOption {
  value: string;
  label: string;
}

export interface BlueprintField {
  id: string;                    // machine key, used as form field name
  label: string;                 // display label
  type: BlueprintFieldType;
  required?: boolean;
  placeholder?: string;
  options?: BlueprintFieldOption[]; // for select/radio
  hint?: string;                 // helper text shown below input
  defaultValue?: string;
  accept?: string;               // for file inputs e.g. ".pdf,.doc"
}

export interface BlueprintSection {
  id: string;
  title: string;
  description?: string;
  fields: BlueprintField[];
}

export interface TwsBlueprint {
  module: TwsModuleKey;
  version: string;               // semver "1.0.0"
  title: string;
  subtitle?: string;
  description: string;
  sections: BlueprintSection[];
  compliance?: string[];         // regulatory references (FLSA, OSHA, VA §, etc.)
  tags?: string[];
}

// ─── Submission types ─────────────────────────────────────────────────────────

export interface TwsSubmission {
  id?: number;
  module: TwsModuleKey;
  tenant_id: string;
  payload: Record<string, unknown>;
  submitted_at?: string;
  submitted_by?: string;
  audit_signature: string;       // TWS-{hash}-{YYYYMMDDHHMM}
}

export interface TwsSubmissionResult {
  success: boolean;
  audit_signature: string;
  persisted_to: 'database' | 'localStorage';
  error?: string;
}

// ─── API shapes ────────────────────────────────────────────────────────────────

export interface TwsBlueprintGetResponse {
  blueprint: TwsBlueprint;
  submission_count?: number;     // how many submissions exist for this module+tenant
  last_submitted?: string;
}

export interface TwsBlueprintPostRequest {
  module: TwsModuleKey;
  tenant_id: string;
  payload: Record<string, unknown>;
  submitted_by?: string;
}

// ─── Shell state ──────────────────────────────────────────────────────────────

export type ModuleStatus = 'configured' | 'incomplete' | 'not_started';

export interface TwsModuleStatus {
  key: TwsModuleKey;
  status: ModuleStatus;
  submission_count: number;
  last_submitted?: string;
}

export interface TwsShellState {
  activeModule: TwsModuleKey;
  tenantId: string;
  dbAvailable: boolean;
  searchQuery: string;
  moduleStatuses: Record<TwsModuleKey, TwsModuleStatus>;
}
