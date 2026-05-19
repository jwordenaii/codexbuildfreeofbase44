// TwsPayrollCompliance.tsx
// src/components/tws/TwsPayrollCompliance.tsx
// Thin wrapper — passes 'payroll-compliance' module key to TwsBlueprintForm.
// To update this module's form: edit ai-page-blueprints/thewordenstandard-payroll-compliance.json
// No TSX changes needed for content updates — that's the SaaS moat.

import type { FC } from 'react';
import TwsBlueprintForm from './TwsBlueprintForm';
import type { TwsBlueprintFormProps } from './TwsBlueprintForm';

export const TwsPayrollCompliance: FC<Omit<TwsBlueprintFormProps, 'blueprint'> & { blueprint: TwsBlueprintFormProps['blueprint'] }> =
  (props) => <TwsBlueprintForm {...props} />;

export default TwsPayrollCompliance;
