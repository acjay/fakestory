/**
 * An audio error, shown only when there is one (e.g. the browser blocked
 * sound). Demos show what's playing on the notes themselves, with a pulse,
 * rather than in text.
 */
export function DemoError({ error }: { error: string | null }) {
  return error ? (
    <p className="demo-status demo-error" role="alert">
      {error}
    </p>
  ) : null;
}
