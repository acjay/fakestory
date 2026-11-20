import type { Block, RichText } from './model';
import { RichTextView } from './RichTextView';

type TableData = {
  has_column_header?: boolean;
  has_row_header?: boolean;
};

/**
 * A Notion table: the `table` block holds the settings, and each child is a
 * `table_row` whose `cells` are arrays of rich text.
 *
 * The first row becomes a header row when the table has a column header, and
 * each row's first cell becomes a row header when it has a row header.
 */
export function TableView({ block }: { block: Block }) {
  const table = (block.table ?? {}) as TableData;
  const rows = (block.children ?? []).map((row) => ({ id: row.id, cells: cellsOf(row) }));

  const headerRow = table.has_column_header ? rows[0] : undefined;
  const bodyRows = headerRow ? rows.slice(1) : rows;

  return (
    // The wrapper scrolls sideways on narrow screens instead of squeezing columns.
    <div className="table-wrapper">
      <table>
        {headerRow && (
          <thead>
            <tr>
              {headerRow.cells.map((cell, index) => (
                <th key={index} scope="col">
                  <RichTextView values={cell} />
                </th>
              ))}
            </tr>
          </thead>
        )}

        <tbody>
          {bodyRows.map((row) => (
            <tr key={row.id}>
              {row.cells.map((cell, index) =>
                table.has_row_header && index === 0 ? (
                  <th key={index} scope="row">
                    <RichTextView values={cell} />
                  </th>
                ) : (
                  <td key={index}>
                    <RichTextView values={cell} />
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function cellsOf(row: Block): RichText[][] {
  return ((row.table_row ?? {}) as { cells?: RichText[][] }).cells ?? [];
}
