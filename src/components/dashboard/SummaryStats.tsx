"use client";

type ColumnStats = {
  name: string;
  type: "numeric" | "text";
  count: number;
  missing: number;
  min?: number;
  max?: number;
  mean?: number;
  stdDev?: number;
  unique?: number;
};

function computeStats(columns: string[], rows: Record<string, any>[]): ColumnStats[] {
  return columns.map((col) => {
    const values = rows.map((r) => r[col]);
    const missing = values.filter(
      (v) => v === "" || v === null || v === undefined
    ).length;
    const present = values.filter(
      (v) => v !== "" && v !== null && v !== undefined
    );

    const numericValues = present
      .map((v) => Number(v))
      .filter((v) => !isNaN(v));

    const isNumeric =
      present.length > 0 && numericValues.length === present.length;

    if (isNumeric) {
      const count = numericValues.length;
      const sum = numericValues.reduce((a, b) => a + b, 0);
      const mean = sum / count;
      const variance =
        numericValues.reduce((a, b) => a + (b - mean) ** 2, 0) / count;
      const stdDev = Math.sqrt(variance);

      return {
        name: col,
        type: "numeric",
        count,
        missing,
        min: Math.min(...numericValues),
        max: Math.max(...numericValues),
        mean,
        stdDev,
      };
    }

    const unique = new Set(present.map((v) => String(v))).size;

    return {
      name: col,
      type: "text",
      count: present.length,
      missing,
      unique,
    };
  });
}

export default function SummaryStats({
  columns,
  rows,
}: {
  columns: string[];
  rows: Record<string, any>[];
}) {
  const stats = computeStats(columns, rows);

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-[#111827] dark:text-white">
                Column
              </th>
              <th className="text-left px-4 py-2 font-semibold text-[#111827] dark:text-white">
                Type
              </th>
              <th className="text-left px-4 py-2 font-semibold text-[#111827] dark:text-white">
                Count
              </th>
              <th className="text-left px-4 py-2 font-semibold text-[#111827] dark:text-white">
                Missing
              </th>
              <th className="text-left px-4 py-2 font-semibold text-[#111827] dark:text-white">
                Min
              </th>
              <th className="text-left px-4 py-2 font-semibold text-[#111827] dark:text-white">
                Max
              </th>
              <th className="text-left px-4 py-2 font-semibold text-[#111827] dark:text-white">
                Average
              </th>
              <th className="text-left px-4 py-2 font-semibold text-[#111827] dark:text-white">
                Std Dev
              </th>
              <th className="text-left px-4 py-2 font-semibold text-[#111827] dark:text-white">
                Unique
              </th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr
                key={s.name}
                className="border-t border-gray-100 dark:border-gray-800"
              >
                <td className="px-4 py-2 font-medium text-[#111827] dark:text-white whitespace-nowrap">
                  {s.name}
                </td>
                <td className="px-4 py-2 text-gray-500 dark:text-gray-400 capitalize">
                  {s.type}
                </td>
                <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                  {s.count}
                </td>
                <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                  {s.missing}
                </td>
                <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                  {s.type === "numeric" ? s.min?.toFixed(2) : "—"}
                </td>
                <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                  {s.type === "numeric" ? s.max?.toFixed(2) : "—"}
                </td>
                <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                  {s.type === "numeric" ? s.mean?.toFixed(2) : "—"}
                </td>
                <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                  {s.type === "numeric" ? s.stdDev?.toFixed(2) : "—"}
                </td>
                <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                  {s.type === "text" ? s.unique : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}