// TwsHiringOnboarding.tsx
// src/components/tws/TwsHiringOnboarding.tsx
// Thin wrapper — passes 'hiring-onboarding' module key to TwsBlueprintForm.
// To update this module's form: edit ai-page-blueprints/thewordenstandard-hiring-onboarding.json
// No TSX changes needed for content updates — that's the SaaS moat.

import type { FC } from 'react';
import TwsBlueprintForm from './TwsBlueprintForm';
import type { TwsBlueprintFormProps } from './TwsBlueprintForm';

export const TwsHiringOnboarding: FC<Omit<TwsBlueprintFormProps, 'blueprint'> & { blueprint: TwsBlueprintFormProps['blueprint'] }> =
  (props) => <TwsBlueprintForm {...props} />;

export default TwsHiringOnboarding;
