/**
 * The bar across the top of every demo: "Demo:" and its title on the left,
 * the tone settings (♪) on the right. The title comes from the registry, or
 * from the embed URL's `title` parameter (see `demoTitle` in registry.ts).
 */

import { ToneSettingsControl } from './ToneSettingsControl';

export function DemoHeader({ title }: { title: string }) {
  return (
    <div className="demo-header">
      <p className="demo-header-title">
        <span className="demo-header-kind">Demo:</span> {title}
      </p>
      <ToneSettingsControl />
    </div>
  );
}
