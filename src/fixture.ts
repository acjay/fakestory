import type { Block, RichText, Story } from './model';

// Entirely invented copy: this is not a snapshot of the author's unpublished work.
type TextOptions = Pick<RichText, 'href' | 'annotations' | 'footnote'>;

const text = (plain_text: string, options: TextOptions = {}): RichText => ({
  type: 'text',
  plain_text,
  ...options,
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
  footnotes: {
    'frequency-ratio': [text('The ratio describes a relationship between frequencies, not a fixed pitch.')],
    relationships: [
      text('A '),
      text('relationship', { annotations: { italic: true } }),
      text(' here means a comparison between sounds, rather than any one sound on its own.'),
    ],
  },
  blocks: [
    block('intro', 'heading_1', [text('A small experiment in listening')]),
    block('intro-p', 'paragraph', [
      text('Music can be understood as '),
      text('a collection of ', { footnote: 'relationships' }),
      text('relationships', { annotations: { bold: true }, footnote: 'relationships' }),
      text(
        '. This sample explores one of them, using entirely invented copy while the reading experience is under construction.',
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
              text('octave', { href: 'https://fakestory.music/terminology/octave' }),
              text('. The relationship can be written as '),
              equation('f_2 = 2f_1'),
              text('. As a ratio, that is '),
              text('two to one', { footnote: 'frequency-ratio' }),
              text('.'),
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
    block('next-intro', 'paragraph', [text('Two ways to compare sounds:')]),
    block(
      'list-ratio',
      'bulleted_list_item',
      [text('By '), text('ratio', { annotations: { bold: true } })],
      [
        block('list-ratio-a', 'bulleted_list_item', [text('2:1 is an octave')]),
        block('list-ratio-b', 'bulleted_list_item', [text('3:2 is a fifth')]),
      ],
    ),
    block('list-difference', 'bulleted_list_item', [text('By difference, in hertz')]),
    block('steps-intro', 'paragraph', [text('And a recipe for hearing one:')]),
    block('step-1', 'numbered_list_item', [text('Play a tone.')]),
    block('step-2', 'numbered_list_item', [text('Play another at twice the frequency.')]),
    block('next-p', 'paragraph', [
      text(
        'A future demo will let you hear the relationship. For now, the panel marks where an interactive experience will live.',
      ),
    ]),
  ],
};
