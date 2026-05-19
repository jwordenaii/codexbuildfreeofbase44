// TwsWetInkPacket.tsx
// src/components/tws/TwsWetInkPacket.tsx
// Thin wrapper — passes 'wet-ink-onboarding-packet' module key to TwsBlueprintForm.
// To update this module's form: edit ai-page-blueprints/thewordenstandard-wet-ink-onboarding-packet.json
// No TSX changes needed for content updates — that's the SaaS moat.

import type { FC } from 'react';
import TwsBlueprintForm from './TwsBlueprintForm';
import type { TwsBlueprintFormProps } from './TwsBlueprintForm';

export const TwsWetInkPacket: FC<Omit<TwsBlueprintFormProps, 'blueprint'> & { blueprint: TwsBlueprintFormProps['blueprint'] }> =
  (props) => <TwsBlueprintForm {...props} />;

export default TwsWetInkPacket;
