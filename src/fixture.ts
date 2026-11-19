import type { Block, RichText, Story } from './model';

// Entirely invented copy: this is not a snapshot of the author's unpublished work.
const text = (plain_text: string, href?: string, annotations?: RichText['annotations']): RichText => ({
  type: 'text',
  plain_text,
  href,
  annotations,
});
const equation = (expression: string): RichText => ({
  type: 'equation',
  plain_text: expression,
  equation: { expression },
});
const block = (id: string, type: string, rich_text: RichText[], children?: Block[]): Block => ({
  id,
  type,
  [type]: { rich_text },
  ...(children ? { has_children: true, children } : {}),
});
export const fixture: Story = {
  title: 'The Fake Story of Music',
  glossary: {
    octave: { name: 'Octave', definition: 'The interval between two pitches whose frequencies are in a 2:1 ratio.' },
  },
  footnotes: { 'frequency-ratio': 'The ratio describes a relationship between frequencies, not a fixed pitch.' },
  blocks: [
    block('intro', 'heading_1', [text('A small experiment in listening')]),
    block('intro-p', 'paragraph', [
      text(
        'Music can be understood as a collection of relationships. This sample explores one of them, using entirely invented copy while the reading experience is under construction.',
      ),
    ]),
    {
      id: 'cols',
      type: 'column_list',
      has_children: true,
      column_list: {},
      children: [
        {
          id: 'col-a',
          type: 'column',
          has_children: true,
          column: {},
          children: [
            block('h-octave', 'heading_2', [text('A familiar distance')]),
            block('p-octave', 'paragraph', [
              text('Double a frequency and the pitch rises by an '),
              text('octave', 'https://fakestory.music/terminology/octave'),
              text('. The relationship can be written as '),
              equation('f_2 = 2f_1'),
              text('. '),
              text('Why a ratio?', 'https://fakestory.music/footnotes/frequency-ratio'),
            ]),
          ],
        },
        {
          id: 'col-b',
          type: 'column',
          has_children: true,
          column: {},
          children: [{ id: 'demo', type: 'embed', embed: { url: 'https://example.com/demo/octave' } }],
        },
      ],
    },
    block('next', 'heading_2', [text('Building from here')]),
    block('next-p', 'paragraph', [
      text(
        'A future demo will let you hear the relationship. For now, the panel marks where an interactive experience will live.',
      ),
    ]),
  ],
};
