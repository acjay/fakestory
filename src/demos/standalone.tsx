/**
 * Entry point for a demo's own page (demos/<slug>/index.html), the page that
 * gets embedded in Notion. The page names its demo in `data-demo`; the URL's
 * query parameters configure it, as they do inside the story.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { DEMOS, demoTitle } from './registry';

import './standalone.css';

const root = document.getElementById('root')!;
const slug = root.dataset.demo ?? '';
const Demo = DEMOS[slug]?.Component;
const params = new URLSearchParams(location.search);

createRoot(root).render(
  <StrictMode>
    {Demo ? <Demo params={params} title={demoTitle(slug, params)} /> : <p>Unknown demo: {slug}</p>}
  </StrictMode>,
);
