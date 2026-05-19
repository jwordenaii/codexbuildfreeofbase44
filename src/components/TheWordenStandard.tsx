// TheWordenStandard.tsx
// src/components/TheWordenStandard.tsx
// SaaS compliance shell — HR / Legal / Payroll / VA Compliance / 8 modules
// Blueprint-driven multi-tenant chassis. Design system tokens from ws-tokens.css.

import { useState, useCallback, useEffect, useMemo, memo } from 'react';
import type { FC } from 'react';
import './TheWordenStandard.css';
import type {
  TwsModuleKey, TwsModuleMeta, TwsBlueprint, TwsModuleStatus,
  TwsSubmissionResult, ModuleStatus,
} from '../types/the-worden-standard.types';
import { TWS_MODULES } from '../types/the-worden-standard.types';
import TwsBlueprintForm from './tws/TwsBlueprintForm';

// ─── Blueprint loader (lazy per module) ──────────────────────────────────────
// Fetches from Netlify function. Falls back to inline stubs if function absent.

async function loadBlueprint(module: TwsModuleKey, tenantId: string): Promise<{ blueprint: TwsBlueprint; count: number }> {
  const res = await fetch('/.netlify/functions/tws-blueprint?module=' + module + '&tenant_id=' + tenantId);
  if (!res.ok) throw new Error('Blueprint load failed: ' + res.status);
  const data = await res.json();
  return { blueprint: data.blueprint, count: data.submission_count ?? 0 };
}

// ─── Inline blueprint stubs (fallback when function absent in dev) ────────────
// Matches TwsBlueprint shape exactly. Integration agent replaces with JSON files.

const BLUEPRINT_STUBS: Record<TwsModuleKey, TwsBlueprint> = {
  'background-checks': {
    module: 'background-checks', version: '1.0.0',
    title: 'Background Check Authorization',
    subtitle: 'Pre-employment screening consent & authorization',
    description: 'Authorize and track background screening for new hires per FCRA requirements.',
    compliance: ['FCRA 15 U.S.C. § 1681', 'VA Code § 19.2-389', 'EEOC Guidance on Criminal Records'],
    tags: ['hr', 'screening', 'compliance'],
    sections: [
      { id: 'applicant', title: 'Applicant Information', description: 'Candidate identification for screening authorization.', fields: [
        { id: 'full_name', label: 'Full Legal Name', type: 'text', required: true, placeholder: 'First Middle Last' },
        { id: 'ssn_last4', label: 'Last 4 SSN', type: 'text', required: true, placeholder: 'XXXX', hint: 'Last 4 digits only for identification' },
        { id: 'dob', label: 'Date of Birth', type: 'date', required: true },
        { id: 'drivers_license', label: "Driver's License #", type: 'text', placeholder: 'VA license number' },
        { id: 'dl_state', label: 'DL State', type: 'select', options: [{value:'VA',label:'Virginia'},{value:'MD',label:'Maryland'},{value:'NC',label:'North Carolina'},{value:'DC',label:'DC'},{value:'other',label:'Other'}] },
        { id: 'position_applied', label: 'Position Applied For', type: 'text', required: true },
      ]},
      { id: 'consent', title: 'FCRA Authorization & Consent', description: 'Candidate must consent before any background check is initiated.', fields: [
        { id: 'fcra_consent', label: 'I authorize J. Worden & Sons to conduct a consumer report background check per FCRA', type: 'checkbox', required: true, options: [{value:'authorized',label:'I authorize and consent to background screening'}] },
        { id: 'scope_consent', label: 'Screening Scope', type: 'checkbox', options: [
          {value:'criminal',label:'Criminal history (federal, state, county)'},
          {value:'mvr',label:"Motor vehicle records (MVR) — required for CDL/driving roles"},
          {value:'employment',label:'Employment verification (7 years)'},
          {value:'education',label:'Education verification'},
          {value:'credit',label:'Credit check (financial roles only)'},
        ]},
        { id: 'candidate_signature', label: 'Candidate Signature', type: 'signature', required: true, hint: 'Type full legal name as digital signature' },
        { id: 'signature_date', label: 'Date', type: 'date', required: true },
      ]},
      { id: 'results', title: 'Screening Results & Disposition', description: 'HR use only — complete after results received.', fields: [
        { id: 'screening_vendor', label: 'Screening Vendor', type: 'select', options: [{value:'sterling',label:'Sterling Talent Solutions'},{value:'checkr',label:'Checkr'},{value:'hireright',label:'HireRight'},{value:'other',label:'Other'}] },
        { id: 'order_date', label: 'Order Date', type: 'date' },
        { id: 'results_date', label: 'Results Received', type: 'date' },
        { id: 'disposition', label: 'Disposition', type: 'select', options: [{value:'clear',label:'Clear — proceed to hire'},{value:'review',label:'Requires individualized assessment'},{value:'adverse',label:'Adverse action initiated'}] },
        { id: 'adverse_notes', label: 'Adverse Action Notes', type: 'textarea', hint: 'Required if disposition = adverse action. Document FCRA pre-adverse and adverse notices sent.' },
        { id: 'reviewed_by', label: 'Reviewed By (HR)', type: 'text' },
      ]}
    ]
  },
  'employee-handbook': {
    module: 'employee-handbook', version: '1.0.0',
    title: 'Employee Handbook Acknowledgment',
    subtitle: 'Signed receipt of current J. Worden & Sons Employee Handbook',
    description: 'Document that each employee has received, read, and agrees to abide by the current Employee Handbook policies.',
    compliance: ['VA Code § 40.1', 'FLSA 29 U.S.C. § 201', 'OSHA 29 CFR 1926'],
    tags: ['hr', 'policy', 'onboarding'],
    sections: [
      { id: 'employee_info', title: 'Employee Information', fields: [
        { id: 'employee_name', label: 'Employee Full Name', type: 'text', required: true },
        { id: 'employee_id', label: 'Employee ID', type: 'text' },
        { id: 'department', label: 'Department / Trade', type: 'select', required: true, options: [{value:'paving',label:'Asphalt Paving'},{value:'earthwork',label:'Earthwork / Grading'},{value:'concrete',label:'Concrete'},{value:'administrative',label:'Administrative'},{value:'estimating',label:'Estimating'},{value:'pm',label:'Project Management'}] },
        { id: 'start_date', label: 'Start Date', type: 'date', required: true },
        { id: 'supervisor', label: 'Direct Supervisor', type: 'text' },
      ]},
      { id: 'handbook_receipt', title: 'Handbook Receipt & Acknowledgment', fields: [
        { id: 'handbook_version', label: 'Handbook Version / Date', type: 'text', required: true, hint: 'e.g. "Rev. Jan 2026" — matches cover page of issued handbook' },
        { id: 'received_copy', label: 'Receipt Confirmation', type: 'checkbox', required: true, options: [{value:'received',label:'I confirm I have received a copy of the J. Worden & Sons Employee Handbook'}] },
        { id: 'read_understood', label: 'Understanding Confirmation', type: 'checkbox', required: true, options: [{value:'understood',label:'I have read and understand the policies, procedures, and standards contained in the handbook'}] },
        { id: 'at_will_ack', label: 'At-Will Employment', type: 'checkbox', required: true, options: [{value:'at_will',label:'I understand my employment is at-will and the handbook does not constitute a contract of employment'}] },
        { id: 'questions_offered', label: 'Questions / Exceptions Noted', type: 'textarea', hint: 'Note any questions raised or exceptions requested. Leave blank if none.' },
      ]},
      { id: 'signature_block', title: 'Signatures', fields: [
        { id: 'employee_signature', label: 'Employee Signature', type: 'signature', required: true },
        { id: 'employee_sig_date', label: 'Date', type: 'date', required: true },
        { id: 'hr_witness', label: 'HR Representative', type: 'text' },
        { id: 'hr_sig_date', label: 'HR Date', type: 'date' },
      ]}
    ]
  },
  'hiring-onboarding': {
    module: 'hiring-onboarding', version: '1.0.0',
    title: 'Hiring & Onboarding Checklist',
    subtitle: 'New hire intake — I-9, W-4, direct deposit, equipment assignment',
    description: 'Complete all federal, state, and company onboarding requirements for each new hire.',
    compliance: ['IRS Form W-4', 'USCIS Form I-9', 'VA New Hire Reporting', 'FLSA'],
    tags: ['hr', 'onboarding', 'payroll'],
    sections: [
      { id: 'new_hire_info', title: 'New Hire Profile', fields: [
        { id: 'full_name', label: 'Full Legal Name', type: 'text', required: true },
        { id: 'preferred_name', label: 'Preferred Name', type: 'text' },
        { id: 'position_title', label: 'Position Title', type: 'text', required: true },
        { id: 'employment_type', label: 'Employment Type', type: 'select', required: true, options: [{value:'fte',label:'Full-Time Employee'},{value:'pte',label:'Part-Time Employee'},{value:'seasonal',label:'Seasonal'},{value:'temp',label:'Temporary'}] },
        { id: 'pay_rate', label: 'Pay Rate', type: 'text', placeholder: '$XX.XX/hr or $XX,XXX/yr' },
        { id: 'first_day', label: 'First Day', type: 'date', required: true },
        { id: 'reporting_location', label: 'Reporting Location', type: 'select', options: [{value:'chester',label:'Chester Yard (main)'},{value:'field',label:'Direct to job site'},{value:'office',label:'Admin Office'}] },
      ]},
      { id: 'federal_docs', title: 'Federal Documentation', fields: [
        { id: 'i9_completed', label: 'Form I-9 — Employment Eligibility', type: 'checkbox', required: true, options: [{value:'done',label:'Section 1 (employee) and Section 2 (employer verification) complete'}] },
        { id: 'i9_doc_type', label: 'I-9 Document(s) Presented', type: 'select', options: [{value:'passport',label:'U.S. Passport (List A)'},{value:'dl_ss',label:"Driver's License + Social Security Card (Lists B+C)"},{value:'dl_bc',label:"Driver's License + Birth Certificate (Lists B+C)"},{value:'ead',label:'Employment Authorization Document (List A)'}] },
        { id: 'w4_completed', label: 'Form W-4 — Federal Withholding', type: 'checkbox', required: true, options: [{value:'done',label:'W-4 completed and submitted to payroll'}] },
        { id: 'va_tax_completed', label: 'VA-4 — Virginia Withholding', type: 'checkbox', required: true, options: [{value:'done',label:'VA-4 completed and submitted'}] },
        { id: 'direct_deposit', label: 'Direct Deposit', type: 'checkbox', options: [{value:'done',label:'Direct deposit form completed'},{value:'paper',label:'Employee elected paper check'}] },
      ]},
      { id: 'equipment', title: 'Equipment & Access Assignment', fields: [
        { id: 'hard_hat_issued', label: 'Hard Hat Issued', type: 'checkbox', options: [{value:'yes',label:'ANSI Z89.1 Class E hard hat issued'}] },
        { id: 'safety_vest_issued', label: 'Safety Vest Issued', type: 'checkbox', options: [{value:'yes',label:'ANSI 107 Class 2/3 hi-vis vest issued'}] },
        { id: 'phone_issued', label: 'Company Phone / Radio', type: 'select', options: [{value:'phone',label:'Company cell issued'},{value:'radio',label:'Job-site radio issued'},{value:'byod',label:'BYOD (personal device)'},{value:'none',label:'Not applicable'}] },
        { id: 'key_fob', label: 'Key / Fob / Badge', type: 'text', placeholder: 'Key # or access badge #' },
        { id: 'system_access', label: 'System Access Provisioned', type: 'checkbox', options: [{value:'email',label:'Company email'},{value:'payroll',label:'Payroll portal'},{value:'timekeeping',label:'Time & attendance'},{value:'safety_lms',label:'Safety LMS'}] },
        { id: 'assigned_by', label: 'Equipment Assigned By', type: 'text' },
        { id: 'assignment_date', label: 'Assignment Date', type: 'date' },
      ]}
    ]
  },
  'legal-master': {
    module: 'legal-master', version: '1.0.0',
    title: 'Legal Master — Contracts & Liability',
    subtitle: 'Contract templates, lien waivers, COI tracking',
    description: 'Track executed contracts, certificate of insurance requirements, lien waiver log, and subcontractor agreements.',
    compliance: ['VA Code § 43-1 (Mechanics Lien)', 'VA Code § 54.1-1115', 'AIA Document Standards'],
    tags: ['legal', 'contracts', 'lien'],
    sections: [
      { id: 'contract_intake', title: 'Contract Intake', fields: [
        { id: 'project_name', label: 'Project Name', type: 'text', required: true },
        { id: 'owner_name', label: 'Property Owner / GC', type: 'text', required: true },
        { id: 'contract_type', label: 'Contract Type', type: 'select', required: true, options: [{value:'prime',label:'Prime Contract (Owner-Contractor)'},{value:'subcontract',label:'Subcontract'},{value:'po',label:'Purchase Order'},{value:'t&m',label:'Time & Materials Agreement'}] },
        { id: 'contract_value', label: 'Contract Value ($)', type: 'number', placeholder: '0.00' },
        { id: 'execution_date', label: 'Execution Date', type: 'date' },
        { id: 'substantial_completion', label: 'Substantial Completion Date', type: 'date' },
        { id: 'retainage_pct', label: 'Retainage %', type: 'number', placeholder: '10', hint: 'Standard VA retainage — may reduce to 5% after 50% completion per VA Code' },
      ]},
      { id: 'coi', title: 'Certificate of Insurance (COI)', fields: [
        { id: 'coi_required', label: 'COI Required from Subcontractor', type: 'checkbox', options: [{value:'yes',label:'Yes — require before mobilization'}] },
        { id: 'gl_limit', label: 'GL Limit Required ($M)', type: 'select', options: [{value:'1',label:'$1M per occurrence'},{value:'2',label:'$2M per occurrence'},{value:'5',label:'$5M per occurrence'}] },
        { id: 'wc_required', label: "Workers' Compensation", type: 'checkbox', required: true, options: [{value:'confirmed',label:'Workers comp confirmed and in force'}] },
        { id: 'coi_expiry', label: 'COI Expiration Date', type: 'date' },
        { id: 'coi_file', label: 'Upload COI PDF', type: 'file', accept: '.pdf' },
      ]},
      { id: 'lien_waiver', title: 'Lien Waiver Log', fields: [
        { id: 'lien_type', label: 'Waiver Type', type: 'select', options: [{value:'conditional_progress',label:'Conditional Progress Waiver'},{value:'unconditional_progress',label:'Unconditional Progress Waiver'},{value:'conditional_final',label:'Conditional Final Waiver'},{value:'unconditional_final',label:'Unconditional Final Waiver'}] },
        { id: 'pay_app_number', label: 'Pay App #', type: 'number' },
        { id: 'amount_through', label: 'Amount Through Date ($)', type: 'number' },
        { id: 'waiver_date', label: 'Waiver Date', type: 'date' },
        { id: 'waiver_signed', label: 'Signed', type: 'checkbox', options: [{value:'signed',label:'Lien waiver executed and filed'}] },
        { id: 'lien_deadline', label: 'Lien Perfection Deadline', type: 'date', hint: 'VA: 90 days from last date of work, 150 days for residential' },
      ]}
    ]
  },
  'payroll-compliance': {
    module: 'payroll-compliance', version: '1.0.0',
    title: 'Payroll Compliance',
    subtitle: 'Davis-Bacon, certified payroll, prevailing wage tracking',
    description: 'Ensure federal prevailing wage compliance on public contracts. Track certified payroll submissions and fringe benefit payments.',
    compliance: ['Davis-Bacon Act 40 U.S.C. § 3141', 'FLSA 29 U.S.C. § 201', 'VA Overtime Wage Act', 'DOL WH-347'],
    tags: ['payroll', 'prevailing-wage', 'compliance'],
    sections: [
      { id: 'project_prevailing', title: 'Project Prevailing Wage Classification', fields: [
        { id: 'project_name', label: 'Project Name', type: 'text', required: true },
        { id: 'awarding_agency', label: 'Awarding Agency', type: 'text', placeholder: 'VDOT / USACE / City of Richmond' },
        { id: 'davis_bacon', label: 'Davis-Bacon Applicable', type: 'radio', required: true, options: [{value:'yes',label:'Yes — federal or federally-assisted contract'},{value:'no',label:'No — private or state-funded only'}] },
        { id: 'wage_determination', label: 'Wage Determination #', type: 'text', hint: 'From SAM.gov — e.g. VA20240001' },
        { id: 'craft_classifications', label: 'Crafts on Project', type: 'checkbox', options: [{value:'operator',label:'Heavy Equipment Operator'},{value:'laborer',label:'Laborer'},{value:'paving',label:'Asphalt Paving Crew'},{value:'truck',label:'Truck Driver'},{value:'superintendent',label:'Foreman / Superintendent'}] },
      ]},
      { id: 'certified_payroll', title: 'Certified Payroll Submission (WH-347)', fields: [
        { id: 'pay_week_ending', label: 'Week Ending Date', type: 'date', required: true },
        { id: 'payroll_number', label: 'Payroll #', type: 'number', required: true, hint: 'Sequential number per project' },
        { id: 'employee_count', label: 'Number of Employees', type: 'number' },
        { id: 'total_gross', label: 'Total Gross Wages ($)', type: 'number' },
        { id: 'fringe_paid', label: 'Fringe Benefits Paid ($)', type: 'number', hint: 'Include health, pension, vacation accruals paid this week' },
        { id: 'wh347_filed', label: 'WH-347 Filed', type: 'checkbox', required: true, options: [{value:'filed',label:'Certified payroll submitted to awarding agency'}] },
        { id: 'filing_method', label: 'Filing Method', type: 'select', options: [{value:'elcprs',label:'eCPRS (VDOT electronic portal)'},{value:'email',label:'Email to agency'},{value:'paper',label:'Paper submission'}] },
      ]},
      { id: 'overtime', title: 'Overtime & Wage Compliance', fields: [
        { id: 'ot_week_ending', label: 'Week Ending', type: 'date' },
        { id: 'employees_with_ot', label: 'Employees with OT this week', type: 'number' },
        { id: 'ot_premium_paid', label: 'OT Premium Paid ($)', type: 'number' },
        { id: 'pay_stubs_available', label: 'Pay Stubs Available for Audit', type: 'checkbox', options: [{value:'yes',label:'Electronic pay stubs available on demand (3-year retention)'}] },
        { id: 'wage_complaints', label: 'Wage Complaints This Period', type: 'radio', options: [{value:'none',label:'None'},{value:'filed',label:'Complaint filed — see notes'}] },
        { id: 'complaint_notes', label: 'Complaint Notes', type: 'textarea', hint: 'Document complaint received, investigation steps, and resolution. Required if complaint filed.' },
      ]}
    ]
  },
  'training-videos': {
    module: 'training-videos', version: '1.0.0',
    title: 'Safety Training & Certifications',
    subtitle: 'OSHA 10/30, equipment, hazmat, and task-specific training log',
    description: 'Document completion of required safety training, certifications, and toolbox talks per OSHA 29 CFR 1926 and company policy.',
    compliance: ['OSHA 29 CFR 1926', 'OSHA 29 CFR 1910.1200 (HazCom)', 'ANSI Z89.1', 'VA DOLI Safety Standards'],
    tags: ['safety', 'training', 'osha'],
    sections: [
      { id: 'employee_training', title: 'Employee Training Record', fields: [
        { id: 'employee_name', label: 'Employee Name', type: 'text', required: true },
        { id: 'employee_id', label: 'Employee ID', type: 'text' },
        { id: 'trade', label: 'Trade / Role', type: 'select', required: true, options: [{value:'paving',label:'Asphalt Paving'},{value:'operator',label:'Equipment Operator'},{value:'laborer',label:'Laborer'},{value:'supervisor',label:'Foreman / Supervisor'},{value:'office',label:'Office / Admin'}] },
      ]},
      { id: 'certifications', title: 'Certifications & Completions', fields: [
        { id: 'osha10', label: 'OSHA 10-Hour Construction', type: 'checkbox', options: [{value:'complete',label:'Complete'}] },
        { id: 'osha10_date', label: 'OSHA 10 Completion Date', type: 'date' },
        { id: 'osha30', label: 'OSHA 30-Hour Construction (supervisors)', type: 'checkbox', options: [{value:'complete',label:'Complete'}] },
        { id: 'osha30_date', label: 'OSHA 30 Completion Date', type: 'date' },
        { id: 'first_aid_cpr', label: 'First Aid / CPR / AED', type: 'checkbox', options: [{value:'current',label:'Current (within 2 years)'}] },
        { id: 'first_aid_expiry', label: 'Expiration Date', type: 'date' },
        { id: 'flagger', label: 'ATSSA Flagger Certification', type: 'checkbox', options: [{value:'current',label:'Current flagger card'}] },
        { id: 'hazmat', label: 'Hazmat / SDS Awareness', type: 'checkbox', options: [{value:'complete',label:'HazCom 29 CFR 1910.1200 training complete'}] },
        { id: 'fall_protection', label: 'Fall Protection (6-ft threshold)', type: 'checkbox', options: [{value:'complete',label:'Fall protection training complete'}] },
        { id: 'equipment_certs', label: 'Equipment Certifications', type: 'checkbox', options: [{value:'paver',label:'Asphalt paver operation'},{value:'roller',label:'Compaction roller'},{value:'excavator',label:'Excavator / backhoe'},{value:'skidsteer',label:'Skid-steer loader'},{value:'cdl',label:'CDL Class A or B'}] },
      ]},
      { id: 'toolbox_talks', title: 'Toolbox Talk Log', fields: [
        { id: 'tt_date', label: 'Talk Date', type: 'date' },
        { id: 'tt_topic', label: 'Topic', type: 'text', placeholder: 'e.g. Heat illness prevention, Silica dust, Struck-by' },
        { id: 'tt_presenter', label: 'Presenter / Foreman', type: 'text' },
        { id: 'tt_attendees', label: 'Attendee Names', type: 'textarea', hint: 'List all crew present (or attach sign-in sheet)' },
        { id: 'tt_file', label: 'Sign-in Sheet (upload)', type: 'file', accept: '.pdf,.jpg,.png' },
      ]}
    ]
  },
  'va-compliance': {
    module: 'va-compliance', version: '1.0.0',
    title: 'Virginia Regulatory Compliance',
    subtitle: 'DPOR license, DOLI, SCC registration, VA tax compliance',
    description: 'Track Virginia-specific contractor licensing, DOLI safety requirements, SCC business registration, and state tax obligations.',
    compliance: ['VA Code § 54.1-1100 (DPOR)', 'VA Code § 58.1-499 (withholding)', 'VA DOLI Safety Regulations', 'SCC Title 13.1'],
    tags: ['virginia', 'licensing', 'compliance'],
    sections: [
      { id: 'contractor_license', title: 'DPOR Contractor License', fields: [
        { id: 'license_class', label: 'License Class', type: 'select', required: true, options: [{value:'class_a',label:'Class A (unlimited value)'},{value:'class_b',label:'Class B (up to $120,000)'},{value:'class_c',label:'Class C (up to $10,000)'}] },
        { id: 'license_number', label: 'License Number', type: 'text', required: true },
        { id: 'license_expiry', label: 'Expiration Date', type: 'date', required: true },
        { id: 'license_categories', label: 'License Categories', type: 'checkbox', options: [{value:'gen_contracting',label:'General Contracting'},{value:'highway',label:'Highway / Heavy'},{value:'site_work',label:'Excavation / Grading'},{value:'asphalt',label:'Asphalt / Paving (Class A specialty)'}] },
        { id: 'license_file', label: 'Upload Current License', type: 'file', accept: '.pdf' },
        { id: 'qp_name', label: 'Qualified Individual (QI) Name', type: 'text', required: true, hint: 'Person responsible for license — must hold or meet exam requirements' },
        { id: 'renewal_reminder', label: 'Renewal Reminder Set', type: 'checkbox', options: [{value:'yes',label:'Calendar reminder set 120 days before expiry'}] },
      ]},
      { id: 'doli_safety', title: 'VA DOLI Safety Compliance', fields: [
        { id: 'safety_program', label: 'Written Safety Program', type: 'checkbox', required: true, options: [{value:'current',label:'Written OSHA-compliant safety program on file and current'}] },
        { id: 'safety_program_date', label: 'Last Reviewed / Updated', type: 'date' },
        { id: 'incident_log', label: 'OSHA 300 Log Status', type: 'select', options: [{value:'current',label:'Current — no recordable incidents'},{value:'incidents_logged',label:'Incidents recorded and posted'},{value:'300a_posted',label:'OSHA 300A summary posted Feb 1–Apr 30'}] },
        { id: 'va_hazcom', label: 'VA HazCom Program', type: 'checkbox', options: [{value:'compliant',label:'SDS binder current, all products catalogued'}] },
        { id: 'silica_plan', label: 'Silica Exposure Control Plan', type: 'checkbox', options: [{value:'current',label:'Written silica plan current per 29 CFR 1926.1153'}] },
      ]},
      { id: 'tax_compliance', title: 'Virginia Tax Obligations', fields: [
        { id: 'va_withholding_acct', label: 'VA Withholding Account #', type: 'text', hint: 'From VA TAX myTaxes portal' },
        { id: 'unemployment_acct', label: 'VA Unemployment (VEC) Account #', type: 'text' },
        { id: 'sales_tax_exempt', label: 'Sales Tax Exemption', type: 'radio', options: [{value:'exempt',label:'Exempt — direct pay permit or exemption certificate'},{value:'not_exempt',label:'Collect and remit sales tax on taxable sales'}] },
        { id: 'last_940_filed', label: 'Last FUTA/940 Filed', type: 'date' },
        { id: 'last_941_filed', label: 'Last Federal 941 Filed', type: 'date' },
      ]}
    ]
  },
  'wet-ink-onboarding-packet': {
    module: 'wet-ink-onboarding-packet', version: '1.0.0',
    title: 'Wet Ink Onboarding Packet',
    subtitle: 'Physical signature packet — I-9 + W-4 + VA-4 + handbook receipt + drug policy',
    description: 'Complete packet of documents requiring physical or electronic wet-ink signature. One submission per new hire per employment event.',
    compliance: ['USCIS Form I-9', 'IRS W-4', 'VA-4', 'FLSA', 'ADA', 'FCRA'],
    tags: ['onboarding', 'new-hire', 'signatures'],
    sections: [
      { id: 'new_hire_id', title: 'New Hire Identification', fields: [
        { id: 'full_name', label: 'Full Legal Name', type: 'text', required: true },
        { id: 'hire_date', label: 'Date of Hire', type: 'date', required: true },
        { id: 'ssn_last4', label: 'Last 4 SSN', type: 'text', required: true },
        { id: 'dob', label: 'Date of Birth', type: 'date', required: true },
        { id: 'home_address', label: 'Home Address', type: 'textarea', placeholder: 'Street, City, State, ZIP' },
        { id: 'personal_email', label: 'Personal Email', type: 'email', hint: 'Used for pay stub delivery if no company email' },
        { id: 'emergency_contact', label: 'Emergency Contact Name & Phone', type: 'text' },
      ]},
      { id: 'federal_state_forms', title: 'Federal & State Tax Forms', fields: [
        { id: 'w4_filing_status', label: 'W-4 Filing Status', type: 'select', required: true, options: [{value:'single',label:'Single or MFS'},{value:'mfj',label:'Married Filing Jointly'},{value:'hoh',label:'Head of Household'}] },
        { id: 'w4_allowances', label: 'W-4 Additional Withholding ($)', type: 'number', placeholder: '0', hint: 'Step 4(c) — additional $ per period' },
        { id: 'va4_exemptions', label: 'VA-4 Personal Exemptions', type: 'number', placeholder: '1' },
        { id: 'va4_additional', label: 'VA-4 Additional Withholding ($)', type: 'number', placeholder: '0' },
        { id: 'w4_signature', label: 'W-4 Signature (legal name)', type: 'signature', required: true },
        { id: 'w4_date', label: 'W-4 Date', type: 'date', required: true },
      ]},
      { id: 'drug_policy', title: 'Drug-Free Workplace Policy', fields: [
        { id: 'drug_policy_read', label: 'Policy Receipt', type: 'checkbox', required: true, options: [{value:'received',label:'I have received and read the J. Worden & Sons Drug-Free Workplace Policy'}] },
        { id: 'drug_test_consent', label: 'Testing Consent', type: 'checkbox', required: true, options: [{value:'consent',label:'I consent to drug testing as a condition of employment (pre-employment, random, post-incident)'} ] },
        { id: 'drug_policy_signature', label: 'Drug Policy Signature', type: 'signature', required: true },
        { id: 'drug_policy_date', label: 'Date', type: 'date', required: true },
      ]},
      { id: 'packet_completion', title: 'Packet Completion Checklist', fields: [
        { id: 'i9_done', label: 'I-9 Complete', type: 'checkbox', required: true, options: [{value:'done',label:'Form I-9 Sections 1 & 2 complete — original documents verified'}] },
        { id: 'w4_done', label: 'W-4 Submitted to Payroll', type: 'checkbox', required: true, options: [{value:'done',label:'W-4 delivered to payroll processor'}] },
        { id: 'handbook_done', label: 'Handbook Acknowledgment Signed', type: 'checkbox', required: true, options: [{value:'done',label:'Signed acknowledgment filed in employee record'}] },
        { id: 'background_auth_done', label: 'Background Check Authorization Signed', type: 'checkbox', options: [{value:'done',label:'FCRA authorization complete'}] },
        { id: 'packet_completed_by', label: 'Packet Processed By (HR)', type: 'text', required: true },
        { id: 'packet_date', label: 'Date Completed', type: 'date', required: true },
        { id: 'employee_copy_given', label: 'Employee Copy Given', type: 'checkbox', required: true, options: [{value:'yes',label:'Employee received copies of all signed documents'}] },
      ]}
    ]
  },
};
// ─── Module status helper ────────────────────────────────────────────────────

function computeStatus(count: number): ModuleStatus {
  if (count === 0) return 'not_started';
  if (count < 3) return 'incomplete';
  return 'configured';
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

interface SidebarProps {
  modules: TwsModuleMeta[];
  active: TwsModuleKey;
  statuses: Record<TwsModuleKey, TwsModuleStatus>;
  onSelect: (key: TwsModuleKey) => void;
  searchQuery: string;
}

const TwsSidebar: FC<SidebarProps> = memo(({ modules, active, statuses, onSelect, searchQuery }) => (
  <nav className="tws-sidebar" aria-label="Module navigation">
    <div className="tws-sidebar-label">Compliance Modules</div>
    {modules.map(m => {
      const st = statuses[m.key];
      const pillCls = st?.status === 'configured' ? 'ws-pill ws-pill--ok'
        : st?.status === 'incomplete' ? 'ws-pill ws-pill--warn'
        : 'ws-pill ws-pill--muted';
      const pillLabel = st?.status === 'configured' ? 'OK'
        : st?.status === 'incomplete' ? '...'
        : '--';
      const isMatch = !searchQuery || searchQuery.length < 2 ||
        m.label.toLowerCase().includes(searchQuery.toLowerCase());
      return (
        <button
          key={m.key}
          className={'tws-sidebar-item' + (active === m.key ? ' active' : '') + (!isMatch ? ' ws-hidden' : '')}
          onClick={() => onSelect(m.key)}
        >
          <span className="tws-sidebar-icon">{m.icon}</span>
          <span className="tws-sidebar-name">{m.label}</span>
          <span className={pillCls + ' tws-sidebar-pill'}>{pillLabel}</span>
        </button>
      );
    })}
  </nav>
));

// ─── Main shell ───────────────────────────────────────────────────────────────

const TheWordenStandard: FC = () => {
  const [activeModule, setActiveModule] = useState<TwsModuleKey>('hiring-onboarding');
  const [tenantId, setTenantId] = useState<string>(() => {
    try { return localStorage.getItem('tws_tenant_id') ?? 'demo'; } catch { return 'demo'; }
  });
  const [dbAvailable, setDbAvailable] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [blueprint, setBlueprint] = useState<TwsBlueprint | null>(null);
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<Record<TwsModuleKey, TwsModuleStatus>>(() =>
    Object.fromEntries(TWS_MODULES.map(m => [m.key, { key: m.key, status: 'not_started' as ModuleStatus, submission_count: 0 }])) as Record<TwsModuleKey, TwsModuleStatus>
  );

  // Check DB availability + load initial blueprint
  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      // Check DB by pinging function
      try {
        const r = await fetch('/.netlify/functions/tws-blueprint?module=' + activeModule + '&tenant_id=' + tenantId);
        if (!cancelled && r.ok) {
          const d = await r.json();
          setBlueprint(d.blueprint);
          setDbAvailable(true); // function responded
          const count = d.submission_count ?? 0;
          setStatuses(prev => ({ ...prev, [activeModule]: { key: activeModule, status: computeStatus(count), submission_count: count } }));
        }
      } catch {
        // Function unavailable — use stubs
        if (!cancelled) {
          setBlueprint(BLUEPRINT_STUBS[activeModule]);
          setDbAvailable(false);
        }
      } finally { if (!cancelled) setLoading(false); }
    }
    init();
    return () => { cancelled = true; };
  }, [activeModule, tenantId]);

  const handleModuleSelect = useCallback((key: TwsModuleKey) => {
    setActiveModule(key);
    setBlueprint(null);
    setLoading(true);
    setSearchQuery('');
  }, []);

  const handleSubmitSuccess = useCallback((result: TwsSubmissionResult) => {
    setStatuses(prev => ({
      ...prev,
      [activeModule]: {
        key: activeModule,
        status: computeStatus((prev[activeModule]?.submission_count ?? 0) + 1),
        submission_count: (prev[activeModule]?.submission_count ?? 0) + 1,
        last_submitted: new Date().toISOString(),
      }
    }));
  }, [activeModule]);

  const activeMeta = useMemo(() => TWS_MODULES.find(m => m.key === activeModule)!, [activeModule]);

  return (
    <div className="tws-shell">
      {/* Ticker */}
      <div className="ws-ticker">
        <div className="ws-ticker-track">
          {['THE WORDEN STANDARD', 'HR / LEGAL / PAYROLL', 'VA COMPLIANCE', 'BACKGROUND CHECKS',
            'HIRING & ONBOARDING', 'TRAINING RECORDS', 'LEGAL MASTER', 'WET INK PACKET',
            'MULTI-TENANT SAAS', 'NEON POSTGRES', 'BLUEPRINT-DRIVEN',
            'THE WORDEN STANDARD', 'HR / LEGAL / PAYROLL', 'VA COMPLIANCE'].map((t, i) => (
            <span key={i} className="ws-ticker-item">
              <b>{t}</b>
            </span>
          ))}
        </div>
      </div>

      {/* Top bar */}
      <header className="tws-topbar">
        <div className="tws-topbar-brand">
          <div className="tws-topbar-icon">⚖</div>
          <div>
            <div className="ws-label-sm" style={{ fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ws-text-primary)' }}>THE WORDEN STANDARD</div>
            <div className="ws-label-xs" style={{ color: 'var(--ws-text-dim)' }}>Compliance Management Platform</div>
          </div>
        </div>

        {/* Search */}
        <div className="tws-topbar-search">
          <input
            type="search" className="ws-input" placeholder="Search modules, fields, sections…"
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            aria-label="Search"
          />
        </div>

        {/* Tenant + DB status */}
        <div className="tws-topbar-tenant">
          <span>TENANT</span>
          <span className="tws-tenant-badge">{tenantId.toUpperCase()}</span>
          <span className={'tws-db-badge ' + (dbAvailable ? 'online' : 'offline')}>
            {dbAvailable ? 'DB ONLINE' : 'LOCAL'}
          </span>
        </div>
      </header>

      {/* localStorage banner */}
      {!dbAvailable && (
        <div className="tws-localstorage-banner">
          ⚠ Saved locally — connect <a href="https://neon.tech" target="_blank" rel="noopener noreferrer">Neon database</a> and set DATABASE_URL in Netlify env vars for tenant sync.
        </div>
      )}

      {/* Body */}
      <div className="tws-body">
        <TwsSidebar
          modules={TWS_MODULES} active={activeModule}
          statuses={statuses} onSelect={handleModuleSelect}
          searchQuery={searchQuery}
        />

        <main className="tws-main">
          {loading && (
            <div className="ws-loading-center">
              <div className="ws-spinner" />
              <div className="ws-label-sm">Loading {activeMeta.label}…</div>
            </div>
          )}
          {!loading && blueprint && (
            <TwsBlueprintForm
              blueprint={blueprint}
              tenantId={tenantId}
              dbAvailable={dbAvailable}
              searchQuery={searchQuery}
              onSubmitSuccess={handleSubmitSuccess}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default TheWordenStandard;
