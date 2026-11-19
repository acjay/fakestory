import { createContext, useContext } from 'react';

import type { References } from './model';

/**
 * Glossary and footnote lookups, provided once by the Reader so that deeply
 * nested rich text can resolve references without prop drilling.
 */
const ReferencesContext = createContext<References>({ glossary: {}, footnotes: {} });

export const ReferencesProvider = ReferencesContext.Provider;

export function useReferences(): References {
  return useContext(ReferencesContext);
}
