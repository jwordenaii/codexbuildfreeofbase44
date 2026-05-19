// TwsLegalMaster.tsx
// src/components/tws/TwsLegalMaster.tsx
// Thin wrapper — passes 'legal-master' module key to TwsBlueprintForm.
// To update this module's form: edit ai-page-blueprints/thewordenstandard-legal-master.json
// No TSX changes needed for content updates — that's the SaaS moat.

import type { FC } from 'react';
import TwsBlueprintForm from './TwsBlueprintForm';
import type { TwsBlueprintFormProps } from './TwsBlueprintForm';

export const TwsLegalMaster: FC<Omit<TwsBlueprintFormProps, 'blueprint'> & { blueprint: TwsBlueprintFormProps['blueprint'] }> =
  (props) => <TwsBlueprintForm {...props} />;

export default TwsLegalMaster;
