import { FilterCondition } from "@/components/dashboard/FilterBar";

export function applyFilters(
  rows: Record<string, any>[],
  conditions: FilterCondition[]
): Record<string, any>[] {
  // Ignore conditions where no value has been typed yet
  const activeConditions = conditions.filter((c) => c.value.trim() !== "");

  if (activeConditions.length === 0) return rows;

  return rows.filter((row) =>
    activeConditions.every((cond) => {
      const cellValue = row[cond.column];
      if (cellValue === undefined || cellValue === null) return false;

      const cellStr = String(cellValue).toLowerCase();
      const condValue = cond.value.toLowerCase();
      const cellNum = Number(cellValue);
      const condNum = Number(cond.value);

      switch (cond.operator) {
        case "equals":
          return cellStr === condValue;
        case "contains":
          return cellStr.includes(condValue);
        case ">":
          return !isNaN(cellNum) && !isNaN(condNum) && cellNum > condNum;
        case "<":
          return !isNaN(cellNum) && !isNaN(condNum) && cellNum < condNum;
        case ">=":
          return !isNaN(cellNum) && !isNaN(condNum) && cellNum >= condNum;
        case "<=":
          return !isNaN(cellNum) && !isNaN(condNum) && cellNum <= condNum;
        default:
          return true;
      }
    })
  );
}