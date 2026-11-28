/**
 * The bar across the top of every demo: "Demo:" and its title on the left,
 * then any compact controls the demo puts there (e.g. the scale generator's
 * octave), and the tone settings (♪) on the right. The title comes from the
 * registry, or from the embed URL's `title` parameter (see `demoTitle` in
 * registry.ts).
 */

import type { ReactNode } from 'react';

import { ToneSettingsControl } from './ToneSettingsControl';

export function DemoHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="demo-header">
      <p className="demo-header-title">
        <span className="demo-header-kind">Demo:</span> {title}
      </p>
      <div className="demo-header-controls">
        {children}
        <ToneSettingsControl />
      </div>
    </div>
  );
}
