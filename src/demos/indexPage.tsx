/** Entry point for the demo index page (demos/index.html). */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { DemoIndex } from './DemoIndex';

import './standalone.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DemoIndex origin={location.origin} />
  </StrictMode>,
);
