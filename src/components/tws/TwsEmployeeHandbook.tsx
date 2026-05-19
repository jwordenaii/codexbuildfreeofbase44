// TwsEmployeeHandbook.tsx
// src/components/tws/TwsEmployeeHandbook.tsx
// Thin wrapper — passes 'employee-handbook' module key to TwsBlueprintForm.
// To update this module's form: edit ai-page-blueprints/thewordenstandard-employee-handbook.json
// No TSX changes needed for content updates — that's the SaaS moat.

import type { FC } from 'react';
import TwsBlueprintForm from './TwsBlueprintForm';
import type { TwsBlueprintFormProps } from './TwsBlueprintForm';

export const TwsEmployeeHandbook: FC<Omit<TwsBlueprintFormProps, 'blueprint'> & { blueprint: TwsBlueprintFormProps['blueprint'] }> =
  (props) => <TwsBlueprintForm {...props} />;

export default TwsEmployeeHandbook;
