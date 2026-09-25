"use client";

import React, { useMemo, useState } from "react";
import { Sparkles, Search, Braces, Copy, Check, X } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Row = Record<string, unknown>;
type ColumnKind = "number" | "time" | "category";
type AggFn = "SUM" | "AVG" | "COUNT" | "MIN" | "MAX";

type CompareOp =
  | "="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<="
  | "contains"
  | "not contains"
  | "starts with"
  | "in"
  | "not in"
  | "between"
  | "empty"
  | "not empty";

interface Condition {
  column: string;
  op: CompareOp;
  value: string | number | null;
  value2?: string | number;
}

type Intent =
  | { kind: "filter"; combine: "AND" | "OR"; conditions: Condition[] }
  | { kind: "top"; direction: "top" | "bottom"; limit: number; subject: string; metric: string }
  | { kind: "aggregate"; fn: AggFn; column: string | null; groupBy: string | null }
  | { kind: "missing" }
  | { kind: "outliers" }
  | { kind: "unknown" };

interface ColInfo {
  name: string;
  kind: ColumnKind;
  missing: number;
  filled: number;
  numeric: number[];
  topValue: string | null;
  topShare: number;
}

interface PreviewTable {
  columns: string[];
  rows: string[][];
}

interface QueryResult {
  source: string;
  intent: Intent;
  sql: string;
  criteria: string[];
  description: string;
  summary: string;
  matched: Row[];
  canApply: boolean;
  preview: PreviewTable | null;
  error: string | null;
}

interface NLQEngineProps {
  data: Row[];
  activeFilter?: string | null;
  onApplyQuery: (rows: Row[], description: string) => void;
  onClearFilter: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const CARD_CLASS =
  "rounded-3xl border border-slate-900/15 bg-white/80 p-5 shadow-sm backdrop-blur-xl";
const LABEL_CLASS = "text-[10px] font-bold uppercase tracking-widest text-slate-400";

const norm = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");

function cellKind(value: unknown): "number" | "time" | "category" | "empty" {
  if (value === null || value === undefined) return "empty";
  if (typeof value === "number") return Number.isFinite(value) ? "number" : "empty";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return "empty";
    if (Number.isFinite(Number(trimmed))) return "number";
    if (/[-/:]/.test(trimmed) && !Number.isNaN(Date.parse(trimmed))) return "time";
    return "category";
  }
  return "category";
}

function toNum(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return NaN;
}

function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

function formatCell(value: unknown): string {
  if (cellKind(value) === "empty") return "—";
  const text = String(value);
  return text.length > 26 ? text.slice(0, 25) + "…" : text;
}

const ident = (name: string): string =>
  /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `"${name.replace(/"/g, '""')}"`;

function literal(value: string | number | null | undefined): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (value === null || value === undefined) return "NULL";
  const text = String(value);
  const asNumber = text.trim() === "" ? NaN : Number(text);
  if (Number.isFinite(asNumber)) return String(asNumber);
  return `'${text.replace(/'/g, "''")}'`;
}

function stripNoise(text: string): string {
  let out = text.trim();
  out = out.replace(/^[,;:\s]+|[,;.!?]+$/g, "").trim();
  return out;
}

/* ------------------------------------------------------------------ */
/*  Column profiling                                                   */
/* ------------------------------------------------------------------ */

function profileColumns(rows: Row[]): ColInfo[] {
  const names: string[] = [];
  const seen = new Set<string>();
  const limit = Math.min(rows.length, 50);
  for (let i = 0; i < limit; i += 1) {
    for (const key of Object.keys(rows[i])) {
      if (!seen.has(key)) {
        seen.add(key);
        names.push(key);
      }
    }
  }

  return names.map((name) => {
    let missing = 0;
    let numericCount = 0;
    let timeCount = 0;
    let categoryCount = 0;
    const numeric: number[] = [];
    const counts = new Map<string, number>();

    for (const row of rows) {
      const kind = cellKind(row[name]);
      if (kind === "empty") {
        missing += 1;
        continue;
      }
      const text = String(row[name]);
      if (counts.size < 40) counts.set(text, (counts.get(text) ?? 0) + 1);
      if (kind === "number") {
        numericCount += 1;
        if (numeric.length < 50000) numeric.push(Number(row[name]));
      } else if (kind === "time") {
        timeCount += 1;
      } else {
        categoryCount += 1;
      }
    }

    let kind: ColumnKind = "category";
    if (categoryCount === 0 && numericCount > 0) kind = "number";
    else if (categoryCount === 0 && numericCount === 0 && timeCount > 0) kind = "time";

    const filled = rows.length - missing;
    let topValue: string | null = null;
    let topShare = 0;
    if (counts.size > 0 && counts.size <= 40 && filled > 0) {
      let best = 0;
      let bestKey: string | null = null;
      counts.forEach((value, key) => {
        if (value > best) {
          best = value;
          bestKey = key;
        }
      });
      topValue = bestKey;
      topShare = Math.round((best / filled) * 1000) / 10;
    }

    return { name, kind, missing, filled, numeric, topValue, topShare };
  });
}

/* ------------------------------------------------------------------ */
/*  Column resolution                                                  */
/* ------------------------------------------------------------------ */

const NOISE_PREFIX =
  /^(?:show\s+me\s+rows\s+where|show\s+me\s+rows|show\s+me|rows\s+where|list\s+of|list|rows|where|find|get|all|the|a|an|my)\b[\s,:-]*/i;

function resolveColumn(text: string, cols: ColInfo[]): string | null {
  let target = stripNoise(text);
  if (!target) return null;

  const candidates: string[] = [target];
  let cleaned = target;
  let guard = 0;
  while (NOISE_PREFIX.test(cleaned) && guard < 5) {
    cleaned = stripNoise(cleaned.replace(NOISE_PREFIX, ""));
    candidates.push(cleaned);
    guard += 1;
  }

  for (const candidate of candidates) {
    const c = norm(candidate);
    if (!c) continue;
    for (const col of cols) {
      if (norm(col.name) === c) return col.name;
    }
  }

  const sorted = [...cols].sort((a, b) => norm(b.name).length - norm(a.name).length);
  for (const candidate of candidates) {
    const c = norm(candidate);
    if (c.length < 3) continue;
    for (const col of sorted) {
      const n = norm(col.name);
      const singular = n.endsWith("s") ? n.slice(0, -1) : n;
      if (n && (c.includes(n) || (singular.length >= 3 && c.includes(singular)))) {
        return col.name;
      }
      if (c.length >= 4 && (n.includes(c) || (singular.includes(c) && c.length >= 4))) {
        return col.name;
      }
    }
  }
  return null;
}

function mentionedColumns(query: string, cols: ColInfo[]): string[] {
  const q = norm(query);
  return cols
    .filter((col) => {
      const n = norm(col.name);
      if (!n) return false;
      const singular = n.endsWith("s") ? n.slice(0, -1) : n;
      return q.includes(n) || (singular.length >= 3 && q.includes(singular));
    })
    .sort((a, b) => norm(b.name).length - norm(a.name).length)
    .map((col) => col.name);
}

/* ------------------------------------------------------------------ */
/*  Condition parsing                                                  */
/* ------------------------------------------------------------------ */

function coerce(value: string): string | number {
  const text = stripNoise(value).replace(/^['"]|['"]$/g, "");
  const asNumber = text === "" ? NaN : Number(text);
  if (Number.isFinite(asNumber) && text !== "") return asNumber;
  return text;
}

function parseSegment(segment: string, cols: ColInfo[]): Condition | null {
  let s = stripNoise(segment);
  if (!s) return null;

  const whereIndex = s.toLowerCase().lastIndexOf("where ");
  if (whereIndex >= 0) s = stripNoise(s.slice(whereIndex + 6));
  s = s.replace(/^(?:show|me|rows|that|with|having)\b[\s,:-]*/gi, "").trim();
  if (!s) return null;

  /* empty / null checks */
  const emptyMatch = s.match(/^(.+?)\s+is\s+(not\s+)?(?:empty|null|missing|blank)$/i);
  if (emptyMatch) {
    const column = resolveColumn(emptyMatch[1], cols);
    if (column) {
      return {
        column,
        op: emptyMatch[2] ? "not empty" : "empty",
        value: null,
      };
    }
  }

  type Rule = [RegExp, (m: RegExpMatchArray) => Condition | null];
  const make = (
    rawColumn: string,
    op: CompareOp,
    rawValue: string | number,
    rawValue2?: string | number
  ): Condition | null => {
    const column = resolveColumn(rawColumn, cols);
    if (!column) return null;
    return { column, op, value: rawValue, value2: rawValue2 as string | number | undefined };
  };

  const rules: Rule[] = [
    [
      /^(.+?)\s+does\s+not\s+contain\s+(.+)$/i,
      (m) => make(m[1], "not contains", coerce(m[2])),
    ],
    [/^(.+?)\s+doesn'?t\s+contain\s+(.+)$/i, (m) => make(m[1], "not contains", coerce(m[2]))],
    [/^(.+?)\s+starts?\s+with\s+(.+)$/i, (m) => make(m[1], "starts with", coerce(m[2]))],
    [
      /^(.+?)\s+between\s+(.+?)\s+(?:and|&)\s+(.+)$/i,
      (m) => make(m[1], "between", coerce(m[2]), coerce(m[3])),
    ],
    [
      /^(.+?)\s*(>=|<=|!=|>|<|=)\s*(.+)$/,
      (m) => make(m[1], m[2] as CompareOp, coerce(m[3])),
    ],
    [
      /^(.+?)\s+is\s+not\s+(?:equal\s+to\s+)?(.+)$/i,
      (m) => make(m[1], "!=", coerce(m[2])),
    ],
    [
      /^(.+?)\s+(?:equals?|of)\s+(.+)$/i,
      (m) => make(m[1], "=", coerce(m[2])),
    ],
    [/^(.+?)\s+is\s+(.+)$/i, (m) => make(m[1], "=", coerce(m[2]))],
    [/^(.+?)\s+(?:contains?|has|like)\s+(.+)$/i, (m) => make(m[1], "contains", coerce(m[2]))],
    [/^(.+?)\s+(?:is\s+)?in\s+(.+)$/i, (m) => make(m[1], "in", coerce(m[2]))],
  ];

  for (const [pattern, builder] of rules) {
    const match = s.match(pattern);
    if (match) {
      const condition = builder(match);
      if (condition) return condition;
    }
  }

  return null;
}

function splitConditions(query: string): { parts: string[]; combine: "AND" | "OR" } {
  const protectedQuery = query.replace(
    /\bbetween\s+(.+?)\s+and\s+/gi,
    (match) => match.replace(/\s+and\s+$/i, " ~and~ ")
  );
  const orParts = protectedQuery.split(/\s+or\s+/i);
  if (orParts.length > 1) return { parts: orParts, combine: "OR" };
  const andParts = protectedQuery.split(/\s+(?:and|&)\s+/i);
  return { parts: andParts, combine: "AND" };
}

/* ------------------------------------------------------------------ */
/*  Intent detection                                                   */
/* ------------------------------------------------------------------ */

const AGG_MAP: Record<string, AggFn> = {
  sum: "SUM",
  total: "SUM",
  add: "SUM",
  average: "AVG",
  avg: "AVG",
  mean: "AVG",
  count: "COUNT",
  number: "COUNT",
  max: "MAX",
  highest: "MAX",
  min: "MIN",
  lowest: "MIN",
};

function detectIntent(query: string, cols: ColInfo[]): Intent {
  const q = query.trim();
  const lower = q.toLowerCase();

  if (/\boutlier/.test(lower)) return { kind: "outliers" };

  const looksLikeCondition =
    /\bwhere\b/i.test(q) || /\bis\s+(?:not\s+)?(?:missing|empty|null|blank)\b/i.test(q);
  if (/\bmissing\b/i.test(lower) && !looksLikeCondition) return { kind: "missing" };

  const topMatch = lower.match(/\btop\s+(\d+)\b/);
  const bottomMatch = lower.match(/\bbottom\s+(\d+)\b/);
  if (topMatch || bottomMatch) {
    const direction: "top" | "bottom" = bottomMatch ? "bottom" : "top";
    const limit = Number((bottomMatch ?? topMatch)?.[1] ?? 5);
    const mentions = mentionedColumns(q, cols);
    const byMatch = q.match(/\bby\s+(.+)$/i);
    const metricRaw = byMatch ? byMatch[1] : null;
    const metric = metricRaw ? resolveColumn(metricRaw, cols) : null;
    const subject = mentions.find((name) => name !== metric) ?? null;
    const resolvedMetric =
      metric ?? cols.find((c) => c.kind === "number")?.name ?? null;
    const resolvedSubject =
      subject ?? cols.find((c) => c.kind === "category")?.name ?? mentions[0] ?? null;
    if (resolvedMetric && resolvedSubject) {
      return {
        kind: "top",
        direction,
        limit,
        subject: resolvedSubject,
        metric: resolvedMetric,
      };
    }
    return { kind: "unknown" };
  }

  const aggWord = lower.match(
    /\b(sum|total|average|avg|mean|count|count of|how many|max|maximum|min|minimum)\b/
  );
  if (aggWord) {
    const raw = aggWord[1];
    let fn: AggFn = "COUNT";
    if (raw.startsWith("sum")) fn = "SUM";
    else if (raw.startsWith("aver") || raw === "avg" || raw === "mean") fn = "AVG";
    else if (raw.startsWith("max")) fn = "MAX";
    else if (raw.startsWith("min")) fn = "MIN";
    else fn = "COUNT";
    if (AGG_MAP[raw]) fn = AGG_MAP[raw];

    const byMatch = q.match(/\bby\s+(.+)$/i);
    const groupBy = byMatch ? resolveColumn(byMatch[1], cols) : null;
    const mentions = mentionedColumns(q, cols).filter((name) => name !== groupBy);
    let column: string | null = mentions[0] ?? null;
    if (!column && fn !== "COUNT") {
      column = cols.find((c) => c.kind === "number")?.name ?? null;
    }
    if (fn !== "COUNT" && !column) return { kind: "unknown" };
    return { kind: "aggregate", fn, column, groupBy };
  }

  const { parts, combine } = splitConditions(q);
  const conditions: Condition[] = [];
  for (const part of parts) {
    const restored = part.replace(/~and~/gi, "and");
    const condition = parseSegment(restored, cols);
    if (condition) conditions.push(condition);
  }
  if (conditions.length > 0) {
    return { kind: "filter", combine, conditions };
  }

  /* fallback: "<column> <value>" */
  const mentions = mentionedColumns(q, cols);
  if (mentions.length > 0) {
    const column = mentions[0];
    const index = norm(q).indexOf(norm(column));
    const tail = index >= 0 ? q.slice(index + norm(column).length).trim() : "";
    const cleaned = stripNoise(tail.replace(/^\s*(is|of|with|=|:)\s+/i, ""));
    if (cleaned && resolveColumn(cleaned, cols) !== column) {
      return {
        kind: "filter",
        combine: "AND",
        conditions: [{ column, op: "contains", value: coerce(cleaned) }],
      };
    }
  }

  return { kind: "unknown" };
}

/* ------------------------------------------------------------------ */
/*  Evaluation                                                         */
/* ------------------------------------------------------------------ */

function looseEquals(cell: unknown, expected: string | number | null): boolean {
  const cellNumber = toNum(cell);
  const expectedNumber = typeof expected === "number" ? expected : toNum(expected);
  if (Number.isFinite(cellNumber) && Number.isFinite(expectedNumber)) {
    return cellNumber === expectedNumber;
  }
  return String(cell).trim().toLowerCase() === String(expected ?? "").trim().toLowerCase();
}

function matchesCondition(row: Row, condition: Condition): boolean {
  const cell = row[condition.column];
  const kind = cellKind(cell);
  if (condition.op === "empty") return kind === "empty";
  if (condition.op === "not empty") return kind !== "empty";
  if (kind === "empty") return false;

  const text = String(cell);
  const lower = text.toLowerCase();
  const expected = condition.value;
  const expectedLower = String(expected ?? "").toLowerCase();

  switch (condition.op) {
    case "=":
      return looseEquals(cell, expected);
    case "!=":
      return !looseEquals(cell, expected);
    case ">":
      return toNum(cell) > toNum(expected);
    case ">=":
      return toNum(cell) >= toNum(expected);
    case "<":
      return toNum(cell) < toNum(expected);
    case "<=":
      return toNum(cell) <= toNum(expected);
    case "contains":
      return lower.includes(expectedLower);
    case "not contains":
      return !lower.includes(expectedLower);
    case "starts with":
      return lower.startsWith(expectedLower);
    case "in": {
      const list = String(expected ?? "")
        .split(/[,\s|]+/)
        .filter(Boolean)
        .map((item) => item.toLowerCase());
      return list.includes(lower);
    }
    case "not in": {
      const list = String(expected ?? "")
        .split(/[,\s|]+/)
        .filter(Boolean)
        .map((item) => item.toLowerCase());
      return !list.includes(lower);
    }
    case "between": {
      const a = typeof condition.value === "number" ? condition.value : toNum(condition.value);
      const b =
        typeof condition.value2 === "number" ? condition.value2 : toNum(condition.value2);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        const n = toNum(cell);
        return Number.isFinite(n) && n >= Math.min(a, b) && n <= Math.max(a, b);
      }
      const lowText = String(condition.value ?? "").toLowerCase();
      const highText = String(condition.value2 ?? "").toLowerCase();
      const start = lowText <= highText ? lowText : highText;
      const end = lowText <= highText ? highText : lowText;
      return lower >= start && lower <= end;
    }
    default:
      return false;
  }
}

function previewFromRows(rows: Row[], columns: string[]): PreviewTable {
  const shown = columns.slice(0, 6);
  return {
    columns: shown,
    rows: rows.slice(0, 6).map((row) => shown.map((column) => formatCell(row[column]))),
  };
}

function conditionLabel(condition: Condition): string {
  const symbolMap: Record<string, string> = {
    "=": "=",
    "!=": "≠",
    ">": ">",
    ">=": "≥",
    "<": "<",
    "<=": "≤",
    contains: "contains",
    "not contains": "excludes",
    "starts with": "starts with",
    in: "in",
    "not in": "not in",
    between: "between",
    empty: "is empty",
    "not empty": "is not empty",
  };
  const symbol = symbolMap[condition.op] ?? condition.op;
  if (condition.op === "empty" || condition.op === "not empty") {
    return `${condition.column} ${symbol}`;
  }
  if (condition.op === "between") {
    return `${condition.column} between ${literal(condition.value)} AND ${literal(
      condition.value2
    )}`;
  }
  return `${condition.column} ${symbol} ${literal(condition.value)}`;
}

function filterSQL(combine: string, conditions: Condition[]): string {
  const where = conditions
    .map((condition, i) => {
      const prefix = i === 0 ? "WHERE " : `  ${combine} `;
      if (condition.op === "empty") {
        return `${prefix}(${ident(condition.column)} IS NULL OR TRIM(${ident(
          condition.column
        )}) = '')`;
      }
      if (condition.op === "not empty") {
        return `${prefix}(${ident(condition.column)} IS NOT NULL AND TRIM(${ident(
          condition.column
        )}) <> '')`;
      }
      const sqlOp: Record<string, string> = {
        "=": "=",
        "!=": "<>",
        ">": ">",
        ">=": ">=",
        "<": "<",
        "<=": "<=",
      };
      if (sqlOp[condition.op]) {
        return `${prefix}${ident(condition.column)} ${sqlOp[condition.op]} ${literal(
          condition.value
        )}`;
      }
      if (condition.op === "between") {
        return `${prefix}${ident(condition.column)} BETWEEN ${literal(
          condition.value
        )} AND ${literal(condition.value2)}`;
      }
      if (condition.op === "contains" || condition.op === "starts with") {
        const fn = condition.op === "contains" ? "LIKE" : "LIKE";
        const pattern =
          condition.op === "contains"
            ? `%${String(condition.value ?? "")}%`
            : `${String(condition.value ?? "")}%`;
        return `${prefix}${ident(condition.column)} ${fn} ${literal(pattern)}`;
      }
      if (condition.op === "not contains") {
        return `${prefix}${ident(condition.column)} NOT LIKE ${literal(
          `%${String(condition.value ?? "")}%`
        )}`;
      }
      if (condition.op === "in" || condition.op === "not in") {
        const list = String(condition.value ?? "")
          .split(/[,\s|]+/)
          .filter(Boolean)
          .map((item) => literal(item))
          .join(", ");
        const negation = condition.op === "in" ? "IN" : "NOT IN";
        return `${prefix}${ident(condition.column)} ${negation} (${list})`;
      }
      return `${prefix}${ident(condition.column)} = ${literal(condition.value)}`;
    })
    .join("\n");
  return `SELECT *\nFROM dataset\n${where}\nLIMIT 100;`;
}

/* ------------------------------------------------------------------ */
/*  Query runner                                                       */
/* ------------------------------------------------------------------ */

function evaluateQuery(source: string, cols: ColInfo[], rows: Row[]): QueryResult {
  const intent = detectIntent(source, cols);
  const allColumns = cols.map((c) => c.name);

  const base: QueryResult = {
    source,
    intent,
    sql: "",
    criteria: [],
    description: "",
    summary: "",
    matched: [],
    canApply: false,
    preview: null,
    error: null,
  };

  if (intent.kind === "unknown") {
    return {
      ...base,
      sql: `-- Couldn't translate that query yet.\n-- Try: "Show me rows where <column> is <value>"\n-- Or:  "Top 5 <category> by <numeric column>"`,
      criteria: [],
      description: "Untranslated query",
      summary: "No interpretable criteria found in that sentence.",
      error: "Couldn't understand that query — try rephrasing with a column name and a value.",
    };
  }

  if (intent.kind === "filter") {
    const matched = rows.filter((row) =>
      intent.combine === "AND"
        ? intent.conditions.every((condition) => matchesCondition(row, condition))
        : intent.conditions.some((condition) => matchesCondition(row, condition))
    );
    const percent = rows.length > 0 ? Math.round((matched.length / rows.length) * 1000) / 10 : 0;
    return {
      ...base,
      sql: filterSQL(intent.combine, intent.conditions),
      criteria: intent.conditions.map(conditionLabel),
      description: `Query: "${source}"`,
      summary: `${matched.length.toLocaleString()} of ${rows.length.toLocaleString()} rows match (${percent}%)`,
      matched,
      canApply: matched.length > 0,
      preview: previewFromRows(matched, allColumns),
    };
  }

  if (intent.kind === "top") {
    const groups = new Map<string, { total: number; count: number }>();
    for (const row of rows) {
      const key = cellKind(row[intent.subject]) === "empty" ? "(blank)" : String(row[intent.subject]);
      const bucket = groups.get(key) ?? { total: 0, count: 0 };
      const metricValue = toNum(row[intent.metric]);
      if (Number.isFinite(metricValue)) bucket.total += metricValue;
      bucket.count += 1;
      groups.set(key, bucket);
    }
    const ranked = [...groups.entries()]
      .map(([key, bucket]) => ({
        key,
        value: bucket.total,
        count: bucket.count,
      }))
      .sort((a, b) => (intent.direction === "top" ? b.value - a.value : a.value - b.value))
      .slice(0, intent.limit);
    const keep = new Set(ranked.map((entry) => entry.key));
    const matched = rows.filter((row) => {
      const key = cellKind(row[intent.subject]) === "empty" ? "(blank)" : String(row[intent.subject]);
      return keep.has(key);
    });
    const sql = `SELECT ${ident(intent.subject)}, SUM(${ident(
      intent.metric
    )}) AS metric_total\nFROM dataset\nGROUP BY ${ident(intent.subject)}\nORDER BY metric_total ${
      intent.direction === "top" ? "DESC" : "ASC"
    }\nLIMIT ${intent.limit};`;
    const criteria = [
      `${intent.direction === "top" ? "Top" : "Bottom"} ${intent.limit} by ${intent.metric}`,
      `Grouped by ${intent.subject}`,
    ];
    const names = ranked.map((entry) => entry.key).join(", ");
    return {
      ...base,
      sql,
      criteria,
      description: `${intent.direction === "top" ? "Top" : "Bottom"} ${intent.limit} ${
        intent.subject
      } by ${intent.metric}`,
      summary: `Ranking ${groups.size} ${intent.subject} values — keeping ${
        ranked.length
      }: ${names}`,
      matched,
      canApply: matched.length > 0,
      preview: {
        columns: [intent.subject, `SUM(${intent.metric})`, "rows"],
        rows: ranked.map((entry) => [
          entry.key.length > 26 ? entry.key.slice(0, 25) + "…" : entry.key,
          String(Math.round(entry.value * 100) / 100),
          String(entry.count),
        ]),
      },
    };
  }

  if (intent.kind === "aggregate") {
    const buckets = new Map<string, number[]>();
    for (const row of rows) {
      const key =
        intent.groupBy === null
          ? "__all__"
          : cellKind(row[intent.groupBy]) === "empty"
          ? "(blank)"
          : String(row[intent.groupBy]);
      const bucket = buckets.get(key) ?? [];
      if (intent.column) {
        const value = toNum(row[intent.column]);
        if (Number.isFinite(value)) bucket.push(value);
      } else {
        bucket.push(1);
      }
      buckets.set(key, bucket);
    }

    const results: Array<{ key: string; value: number }> = [];
    buckets.forEach((values, key) => {
      let value = 0;
      if (intent.fn === "COUNT") value = values.length;
      else if (values.length > 0 && intent.fn === "SUM")
        value = values.reduce((acc, v) => acc + v, 0);
      else if (values.length > 0 && intent.fn === "AVG")
        value = values.reduce((acc, v) => acc + v, 0) / values.length;
      else if (values.length > 0 && intent.fn === "MIN") value = Math.min(...values);
      else if (values.length > 0 && intent.fn === "MAX") value = Math.max(...values);
      results.push({ key, value: Math.round(value * 100) / 100 });
    });
    results.sort((a, b) => b.value - a.value);

    const label = `${intent.fn}(${intent.column ?? "*"})`;
    const groupLabel = intent.groupBy ? ` by ${intent.groupBy}` : "";
    const sql = intent.groupBy
      ? `SELECT ${ident(intent.groupBy)}, ${intent.fn}(${
          intent.column ? ident(intent.column) : "*"
        }) AS agg_value\nFROM dataset\nGROUP BY ${ident(
          intent.groupBy
        )}\nORDER BY agg_value DESC\nLIMIT 20;`
      : `SELECT ${intent.fn}(${
          intent.column ? ident(intent.column) : "*"
        }) AS agg_value\nFROM dataset;`;

    const overall = results.length === 1 ? results[0].value : null;

    return {
      ...base,
      sql,
      criteria: [`${label}${groupLabel}`, intent.groupBy ? "GROUP BY applied" : "Single scalar"],
      description: `${label}${groupLabel}`,
      summary:
        overall !== null
          ? `${label} = ${overall.toLocaleString()} across ${rows.length.toLocaleString()} rows`
          : `${results.length} groups computed from ${rows.length.toLocaleString()} rows`,
      matched: [],
      canApply: false,
      preview: {
        columns: [intent.groupBy ?? label, label],
        rows: results.slice(0, 6).map((entry) => [
          entry.key.length > 26 ? entry.key.slice(0, 25) + "…" : entry.key,
          entry.value.toLocaleString(),
        ]),
      },
    };
  }

  if (intent.kind === "missing") {
    const withMissing = cols
      .filter((col) => col.missing > 0)
      .sort((a, b) => b.missing - a.missing);
    const totalMissing = withMissing.reduce((acc, col) => acc + col.missing, 0);
    const sql =
      withMissing.length > 0
        ? `SELECT\n${withMissing
            .slice(0, 6)
            .map(
              (col) =>
                `  SUM(CASE WHEN ${ident(col.name)} IS NULL OR TRIM(CAST(${
                  ident(col.name)
                } AS TEXT)) = '' THEN 1 ELSE 0 END) AS ${ident(col.name)}_missing,`
            )
            .join("\n")}\n  COUNT(*) AS total_rows\nFROM dataset;`
        : `-- No missing values detected\nSELECT COUNT(*) AS total_rows FROM dataset;`;
    return {
      ...base,
      sql,
      criteria: [`${withMissing.length} column(s) with missing values`, `NULL / empty scan`],
      description: "Missing values summary",
      summary:
        withMissing.length > 0
          ? `${totalMissing.toLocaleString()} missing cell(s) across ${withMissing.length} column(s)`
          : "No missing values detected — the dataset is fully populated.",
      matched: [],
      canApply: false,
      preview: {
        columns: ["column", "missing", "% of rows"],
        rows:
          withMissing.length > 0
            ? withMissing.slice(0, 6).map((col) => [
                col.name,
                col.missing.toLocaleString(),
                `${rows.length > 0 ? Math.round((col.missing / rows.length) * 1000) / 10 : 0}%`,
              ])
            : [["—", "0", "0%"]],
      },
    };
  }

  /* outliers */
  const fences: Array<{ column: string; low: number; high: number; count: number }> = [];
  for (const col of cols) {
    if (col.kind !== "number" || col.numeric.length < 8) continue;
    const sorted = [...col.numeric].sort((a, b) => a - b);
    const q1 = quantile(sorted, 0.25);
    const q3 = quantile(sorted, 0.75);
    const iqr = q3 - q1;
    const low = q1 - 1.5 * iqr;
    const high = q3 + 1.5 * iqr;
    const count = col.numeric.filter((v) => v < low || v > high).length;
    if (count > 0) fences.push({ column: col.name, low, high, count });
  }

  const matched = rows.filter((row) =>
    fences.some((fence) => {
      const value = toNum(row[fence.column]);
      return Number.isFinite(value) && (value < fence.low || value > fence.high);
    })
  );

  const sql =
    fences.length > 0
      ? `SELECT *\nFROM dataset\nWHERE ${fences
          .map(
            (fence, i) =>
              `${i === 0 ? " " : "OR "}${ident(fence.column)} > ${Math.round(
                fence.high * 100
              ) / 100} OR ${ident(fence.column)} < ${Math.round(fence.low * 100) / 100}`
          )
          .join("\n")}\nLIMIT 100;`
      : `-- No statistical outliers detected (IQR method)\nSELECT * FROM dataset;`;

  const criteria =
    fences.length > 0
      ? fences.map(
          (fence) =>
            `${fence.column} outside [${Math.round(fence.low * 100) / 100}, ${
              Math.round(fence.high * 100) / 100
            }]`
        )
      : ["IQR fences · no outliers"];

  return {
    ...base,
    sql,
    criteria,
    description: "Outlier rows (IQR)",
    summary:
      fences.length > 0
        ? `${matched.length.toLocaleString()} row(s) flagged as outliers across ${fences.length} numeric column(s)`
        : "No statistical outliers detected in numeric columns.",
    matched,
    canApply: matched.length > 0,
    preview: previewFromRows(matched, allColumns),
  };
}

/* ------------------------------------------------------------------ */
/*  Preset chips                                                       */
/* ------------------------------------------------------------------ */

function buildPresets(cols: ColInfo[]): string[] {
  const chips: string[] = [];
  const category = cols.find((col) => col.kind === "category" && col.topValue);
  const numeric = cols.find((col) => col.kind === "number" && col.numeric.length >= 8);
  const secondCategory = cols.filter((col) => col.kind === "category")[1] ?? null;

  if (category && category.topValue) {
    chips.push(`Show me rows where ${category.name} is ${category.topValue}`);
  }
  if (numeric) {
    const median = Math.round(quantile([...numeric.numeric].sort((a, b) => a - b), 0.5));
    chips.push(`Show me rows where ${numeric.name} > ${median}`);
  }
  if (category && numeric) {
    chips.push(`Find top 5 ${category.name} by ${numeric.name}`);
  }
  if (secondCategory && numeric) {
    chips.push(`Compare average ${numeric.name} by ${secondCategory.name}`);
  }
  chips.push("Summarize missing values");
  chips.push("Filter highest outliers");

  return chips.slice(0, 6);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const NLQEngine: React.FC<NLQEngineProps> = ({
  data,
  activeFilter,
  onApplyQuery,
  onClearFilter,
}) => {
  const rows = useMemo(() => (Array.isArray(data) ? (data as Row[]) : []), [data]);
  const columns = useMemo(() => profileColumns(rows), [rows]);
  const presets = useMemo(() => buildPresets(columns), [columns]);

  const [query, setQuery] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);

  const runQuery = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || rows.length === 0) return;
    setQuery(trimmed);
    setResult(evaluateQuery(trimmed, columns, rows));
    setApplied(false);
    setCopied(false);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    runQuery(query);
  };

  const handleApply = () => {
    if (!result || !result.canApply) return;
    onApplyQuery(result.matched, result.description);
    setApplied(true);
    window.setTimeout(() => setApplied(false), 2500);
  };

  const handleCopySQL = () => {
    if (!result || typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;
    navigator.clipboard
      .writeText(result.sql)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2200);
      })
      .catch(() => undefined);
  };

  if (rows.length === 0) {
    return (
      <div className="flex h-[400px] w-full flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 text-center">
        <p className="text-sm font-bold text-slate-700">No data to query yet</p>
        <p className="mt-1 text-sm text-slate-400">
          Upload a dataset in the Data Grid view to start asking questions.
        </p>
      </div>
    );
  }

  const numericColumn = columns.find((col) => col.kind === "number");
  const categoryColumn = columns.find((col) => col.kind === "category");

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        <p className={LABEL_CLASS}>Natural Language Query</p>
        <h2 className="mt-1 text-lg font-bold text-slate-900">Ask your data anything</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Type a question — get live filter criteria, simulated SQL and instant results across the
          grid, charts and audit views.
        </p>
      </div>

      {/* Active filter status */}
      {activeFilter && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-900/15 bg-white/80 px-4 py-3 backdrop-blur-xl">
          <span className="rounded-lg bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
            Active
          </span>
          <p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">
            {activeFilter}
          </p>
          <button
            onClick={onClearFilter}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
          >
            <X className="h-3.5 w-3.5" />
            Clear filter
          </button>
        </div>
      )}

      {/* Prompt input bar */}
      <form
        onSubmit={handleSubmit}
        className={`${CARD_CLASS} flex items-center gap-3 !p-3`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder='Try "Show me rows where region is West and revenue > 5000"'
          aria-label="Natural language query"
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 placeholder:font-medium placeholder:text-slate-400 focus:outline-none"
        />
        <button
          type="submit"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800"
        >
          <Search className="h-4 w-4" />
          Run
        </button>
      </form>

      {/* Preset prompt chips */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className={`${LABEL_CLASS} mr-1`}>Try</span>
        {presets.map((chip) => (
          <button
            key={chip}
            onClick={() => runQuery(chip)}
            className="rounded-full border border-slate-900/15 bg-white/80 px-3.5 py-1.5 text-xs font-bold text-slate-700 backdrop-blur-xl transition-colors hover:border-slate-900/40 hover:bg-white hover:text-slate-900"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Results */}
      {result && !result.error && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Parsed criteria */}
          <section className={CARD_CLASS}>
            <div className="mb-3 flex items-center justify-between">
              <p className={LABEL_CLASS}>Translated query</p>
              <span className="rounded-lg bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
                {result.intent.kind}
              </span>
            </div>

            <ul className="mb-4 space-y-1">
              {result.criteria.map((criterion, i) => (
                <li
                  key={`${criterion}-${i}`}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                    i % 2 === 1 ? "bg-slate-900/[0.05]" : ""
                  }`}
                >
                  <span className="shrink-0 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {result.intent.kind === "filter"
                      ? i === 0
                        ? "WHERE"
                        : (result.intent as { combine: string }).combine
                      : i === 0
                      ? "QUERY"
                      : "META"}
                  </span>
                  <span className="text-sm font-bold text-slate-900">{criterion}</span>
                </li>
              ))}
            </ul>

            <p className="mb-4 text-sm font-semibold text-slate-600">{result.summary}</p>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleApply}
                disabled={!result.canApply}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
                  applied
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "bg-slate-900 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                }`}
              >
                {applied ? <Check className="h-4 w-4" /> : null}
                {applied
                  ? "Applied to dataset"
                  : result.canApply
                  ? `Apply filter (${result.matched.length.toLocaleString()} rows)`
                  : "Preview only"}
              </button>
              {activeFilter && (
                <button
                  onClick={onClearFilter}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:border-slate-300"
                >
                  <X className="h-4 w-4" />
                  Clear filter
                </button>
              )}
            </div>
          </section>

          {/* SQL block */}
          <section className={CARD_CLASS}>
            <div className="mb-3 flex items-center justify-between">
              <p className={`${LABEL_CLASS} flex items-center gap-2`}>
                <Braces className="h-3.5 w-3.5" />
                Generated SQL
              </p>
              <button
                onClick={handleCopySQL}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy SQL"}
              </button>
            </div>
            <pre className="max-h-[280px] overflow-auto whitespace-pre rounded-2xl border border-slate-900 bg-slate-900 px-4 py-3.5 font-mono text-[13px] leading-relaxed text-emerald-300">
              {result.sql}
            </pre>
            <p className="mt-3 text-xs font-semibold text-slate-500">
              Simulated against table <span className="font-bold text-slate-900">dataset</span> ·{" "}
              {rows.length.toLocaleString()} rows · {columns.length} columns
            </p>
          </section>
        </div>
      )}

      {/* Error */}
      {result?.error && (
        <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 p-5">
          <p className="text-sm font-bold text-rose-600">{result.error}</p>
          <p className="mt-1 text-xs font-semibold text-rose-500">
            Example: “Show me rows where {categoryColumn?.name ?? "region"} is{" "}
            {categoryColumn?.topValue ?? "West"}” or “Top 5 by {numericColumn?.name ?? "revenue"}”.
          </p>
        </div>
      )}

      {/* Preview table */}
      {result && !result.error && result.preview && (
        <section className={`${CARD_CLASS} mt-6`}>
          <p className={`${LABEL_CLASS} mb-4`}>Result preview</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {result.preview.columns.map((column, index) => (
                    <th
                      key={`${column}-${index}`}
                      className="py-3 pr-6 whitespace-nowrap"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.preview.rows.map((row, i) => (
                  <tr
                    key={i}
                    className={`border-b border-slate-100 ${
                      i % 2 === 1 ? "bg-slate-900/[0.03]" : ""
                    }`}
                  >
                    {row.map((cell, j) => (
                      <td
                        key={`${result.preview?.columns[j] ?? `col-${j}`}-${j}`}
                        className="py-3 pr-6 font-semibold tabular-nums text-slate-800 whitespace-nowrap"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
