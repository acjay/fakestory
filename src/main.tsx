import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import 'katex/dist/katex.min.css';
import './style.css';

import { loadStory } from './loadStory';
import { Reader } from './Reader';

const root = createRoot(document.getElementById('root')!);

loadStory().then(
  (story) =>
    root.render(
      <StrictMode>
        <Reader story={story} />
      </StrictMode>,
    ),

  // Only reachable when loading the local snapshot, in development.
  (error: unknown) =>
    root.render(<pre className="load-error">{error instanceof Error ? error.message : String(error)}</pre>),
);
