import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'katex/dist/katex.min.css';
import './style.css';
import { fixture } from './fixture';
import { Reader } from './Renderer';

createRoot(document.getElementById('root')!).render(<StrictMode><Reader story={fixture} /></StrictMode>);
