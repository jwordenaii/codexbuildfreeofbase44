// TwsBackgroundChecks.tsx
// src/components/tws/TwsBackgroundChecks.tsx
// Thin wrapper — passes 'background-checks' module key to TwsBlueprintForm.
// To update this module's form: edit ai-page-blueprints/thewordenstandard-background-checks.json
// No TSX changes needed for content updates — that's the SaaS moat.

import type { FC } from 'react';
import TwsBlueprintForm from './TwsBlueprintForm';
import type { TwsBlueprintFormProps } from './TwsBlueprintForm';

export const TwsBackgroundChecks: FC<Omit<TwsBlueprintFormProps, 'blueprint'> & { blueprint: TwsBlueprintFormProps['blueprint'] }> =
  (props) => <TwsBlueprintForm {...props} />;

export default TwsBackgroundChecks;
