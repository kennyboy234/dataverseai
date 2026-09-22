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

function isMissingValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return true;
    if (trimmed === "-") return true;
    if (trimmed.toLowerCase() === "n/a") return true;
  }
  return false;
}

function parseNumericValue(value: unknown): number | null {
  if (isMissingValue(value)) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const num = Number(String(value).trim());
  return Number.isFinite(num) ? num : null;
}

function formatNumeric(value: number | undefined): string {
  if (value === undefined) return "—";
  return value.toFixed(2);
}

function computeStats(columns: string[], rows: Record<string, any>[]): ColumnStats[] {
  return columns.map((col) => {
    const values = rows.map((r) => r[col]);
    const missing = values.filter(isMissingValue).length;
    const nonMissing = values.filter((v) => !isMissingValue(v));

    const numericValues = nonMissing
      .map(parseNumericValue)
      .filter((v): v is number => v !== null);

    const isNumeric =
      nonMissing.length > 0 && numericValues.length === nonMissing.length;

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

    const unique = new Set(nonMissing.map((v) => String(v))).size;

    return {
      name: col,
      type: "text",
      count: nonMissing.length,
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
                  {s.type === "numeric" ? formatNumeric(s.min) : "—"}
                </td>
                <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                  {s.type === "numeric" ? formatNumeric(s.max) : "—"}
                </td>
                <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                  {s.type === "numeric" ? formatNumeric(s.mean) : "—"}
                </td>
                <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                  {s.type === "numeric" ? formatNumeric(s.stdDev) : "—"}
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
