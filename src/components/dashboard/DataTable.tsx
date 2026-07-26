"use client";

export default function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Record<string, any>[];
}) {
  const previewRows = rows.slice(0, 20);

  return (
    <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-xl">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="text-left px-4 py-2 font-semibold text-[#111827] dark:text-white whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {previewRows.map((row, i) => (
            <tr
              key={i}
              className="border-t border-gray-100 dark:border-gray-800"
            >
              {columns.map((col) => (
                <td
                  key={col}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap"
                >
                  {String(row[col] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 20 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 px-4 py-2">
          Showing first 20 of {rows.length} rows
        </p>
      )}
    </div>
  );
}