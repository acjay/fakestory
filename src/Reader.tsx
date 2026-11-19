import { Blocks } from './BlockView';
import type { Story } from './model';
import { ReferencesProvider } from './references';

/**
 * The full page: site header, title hero, the story's blocks, and footer.
 *
 * TODO: The header, hero, and footer copy is hard-coded prototype text. Decide
 * which parts should come from Notion and which belong to the site itself.
 */
export function Reader({ story }: { story: Story }) {
  return (
    <ReferencesProvider value={{ glossary: story.glossary, footnotes: story.footnotes }}>
      <main id="main" className="shell">
        <header className="site-header">
          <a href="#main" className="brand">
            <span className="brand-mark" aria-hidden="true">
              ♫
            </span>
            <span>
              The Fake Story
              <br />
              of Music
            </span>
          </a>
          <span className="status">Reading prototype</span>
        </header>

        <article>
          <div className="hero">
            <div className="hero-kicker">
              A story about how music works <span> / </span> Prototype 01
            </div>
            <h1>{story.title}</h1>
            <p className="hero-deck">An exploration of the sounds, patterns, and choices behind the music we know.</p>
            <div className="hero-rule">
              <span>01</span>
              <span>Start reading ↓</span>
            </div>
          </div>

          <div className="reading">
            <Blocks blocks={story.blocks} />
          </div>
        </article>

        <footer>
          <span>The Fake Story of Music</span>
          <span>Prototype · Sample content only</span>
        </footer>
      </main>
    </ReferencesProvider>
  );
}
