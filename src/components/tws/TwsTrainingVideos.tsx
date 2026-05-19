// TwsTrainingVideos.tsx
// src/components/tws/TwsTrainingVideos.tsx
// Thin wrapper — passes 'training-videos' module key to TwsBlueprintForm.
// To update this module's form: edit ai-page-blueprints/thewordenstandard-training-videos.json
// No TSX changes needed for content updates — that's the SaaS moat.

import type { FC } from 'react';
import TwsBlueprintForm from './TwsBlueprintForm';
import type { TwsBlueprintFormProps } from './TwsBlueprintForm';

export const TwsTrainingVideos: FC<Omit<TwsBlueprintFormProps, 'blueprint'> & { blueprint: TwsBlueprintFormProps['blueprint'] }> =
  (props) => <TwsBlueprintForm {...props} />;

export default TwsTrainingVideos;
