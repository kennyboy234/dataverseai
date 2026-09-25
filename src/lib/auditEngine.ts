/* DataVerse AI — Autonomous financial forensic risk engine. */

export type AuditRow = Record<string, unknown>;
export type AuditRiskLevel = "low" | "moderate" | "high" | "critical";
export type AuditLogLevel = "info" | "success" | "warning" | "critical";
export type AuditCategory = "financial" | "variance" | "schema" | "benford" | "system";

export interface AuditEngineOptions {
  /** Override the schema controls checked by the engine. */
  requiredSchemaParameters?: readonly string[];
  /** Absolute relative movement considered a material variance. */
  varianceThreshold?: number;
  /** Maximum rows read in one scan. The reported row count remains the input size. */
  maxRows?: number;
  /** Injectable clock for deterministic reports and tests. */
  now?: Date;
}

export interface FinancialAnomaly {
  column: string;
  sampleSize: number;
  missingCount: number;
  invalidCount: number;
  negativeCount: number;
  zeroCount: number;
  outlierCount: number;
  extremeCount: number;
  constant: boolean;
  min: number;
  max: number;
  mean: number;
  standardDeviation: number;
  anomalyScore: number;
  riskLevel: AuditRiskLevel;
}

export interface VarianceRisk {
  column: string;
  comparisonColumn: string | null;
  source: "column" | "paired";
  sampleSize: number;
  meanAbsoluteChange: number;
  meanRelativeChange: number;
  maxAbsoluteChange: number;
  maxRelativeChange: number;
  coefficientOfVariation: number;
  riskScore: number;
  riskLevel: AuditRiskLevel;
  detail: string;
}

export interface MissingSchemaParameter {
  parameter: string;
  label: string;
  aliases: string[];
  required: boolean;
  present: boolean;
  matchedColumn: string | null;
  severity: "critical" | "warning";
  riskScore: number;
  recommendation: string;
}

export interface BenfordCheck {
  column: string;
  sampleSize: number;
  chiSquare: number;
  degreesOfFreedom: number;
  pValue: number;
  deviation: number;
  maxDeviation: number;
  compliant: boolean;
  sufficientSample: boolean;
  riskScore: number;
  digitCounts: Record<string, number>;
  observedShares: number[];
  expectedShares: number[];
}

export interface ComplianceMetric {
  key: string;
  label: string;
  score: number;
  status: "pass" | "review" | "fail";
  detail: string;
}

export interface ForensicLog {
  id: string;
  timestamp: string;
  level: AuditLogLevel;
  category: AuditCategory;
  message: string;
  details: string;
}

export interface AuditFinding {
  id: string;
  category: AuditCategory;
  severity: AuditRiskLevel;
  title: string;
  detail: string;
  evidence: string[];
  recommendation: string;
  riskContribution: number;
  column: string | null;
}

export interface AuditEngineReport {
  generatedAt: string;
  rowCount: number;
  scannedRows: number;
  columnCount: number;
  columns: string[];
  numericColumns: string[];
  financialColumns: string[];
  truncated: boolean;
  financialAnomalies: FinancialAnomaly[];
  anomalies: FinancialAnomaly[];
  varianceRisks: VarianceRisk[];
  schemaParameters: MissingSchemaParameter[];
  missingSchemaParameters: MissingSchemaParameter[];
  benfordChecks: BenfordCheck[];
  findings: AuditFinding[];
  complianceMetrics: ComplianceMetric[];
  forensicLogs: ForensicLog[];
  riskScore: number;
  complianceScore: number;
  riskLevel: AuditRiskLevel;
  coverage: number;
  auditStatus: "clear" | "review" | "escalate";
}

export const BENFORD_EXPECTED_SHARES: readonly number[] = [
  0.3010299956639812, 0.17609125905568124, 0.12493873660829993,
  0.09691001300805642, 0.07918124604762482, 0.06694678963061322,
  0.05799194697768673, 0.05115252244738129, 0.04575749056067514,
];

export const DEFAULT_SCHEMA_PARAMETERS = [
  "transaction_id",
  "event_date",
  "amount",
  "currency",
  "account",
  "source",
  "status",
] as const;

interface SchemaDefinition {
  parameter: string;
  label: string;
  aliases: string[];
  required: boolean;
  recommendation: string;
}

const SCHEMA_DEFINITIONS: SchemaDefinition[] = [
  {
    parameter: "transaction_id",
    label: "Transaction identifier",
    aliases: [
      "transaction_id", "transactionid", "id", "record_id", "recordid", "txn_id",
      "txnid", "reference", "reference_id", "invoice", "invoice_number", "payment_id",
    ],
    required: true,
    recommendation: "Add a stable transaction or record identifier for traceability.",
  },
  {
    parameter: "event_date",
    label: "Event timestamp",
    aliases: [
      "event_date", "date", "datetime", "timestamp", "created_at", "createdat",
      "posted_at", "posting_date", "transaction_date", "period", "time",
    ],
    required: true,
    recommendation: "Add a posting or event timestamp so transactions can be sequenced.",
  },
  {
    parameter: "amount",
    label: "Monetary amount",
    aliases: [
      "amount", "value", "total", "transaction_amount", "gross_amount", "debit",
      "credit", "net_amount", "amount_usd",
    ],
    required: true,
    recommendation: "Add an explicit numeric monetary amount or signed measure.",
  },
  {
    parameter: "currency",
    label: "Currency code",
    aliases: ["currency", "currency_code", "currencycode", "curr", "iso_currency", "usd"],
    required: true,
    recommendation: "Add an ISO currency code or document a single-currency assumption.",
  },
  {
    parameter: "account",
    label: "Account or category",
    aliases: ["account", "account_id", "account_name", "category", "expense_category", "ledger_account"],
    required: true,
    recommendation: "Add an account, ledger, or category dimension for reconciliation.",
  },
  {
    parameter: "source",
    label: "Source system",
    aliases: ["source", "source_system", "source_system_name", "origin", "channel"],
    required: false,
    recommendation: "Capture the source system or ingestion channel for provenance.",
  },
  {
    parameter: "status",
    label: "Record status",
    aliases: ["status", "state", "record_status", "transaction_status", "posting_status"],
    required: false,
    recommendation: "Capture posting, approval, or reconciliation status.",
  },
];

const FINANCIAL_COLUMN_PATTERN =
  /amount|revenue|sales|expense|cost|profit|income|cash|budget|forecast|actual|price|value|balance|transaction|debit|credit|tax|charge|payment|payable|receivable|ledger|discount|fee|total|currency|usd|eur|gbp/i;
const VARIANCE_COLUMN_PATTERN = /variance|deviation|change|delta|growth|margin/i;
const PAIR_PATTERNS: Array<{ left: RegExp; right: RegExp; label: string }> = [
  { left: /actual|realized|realised/i, right: /budget|plan|forecast|target/i, label: "Actual vs plan" },
  { left: /forecast|budget|plan/i, right: /actual|realized|realised/i, label: "Plan vs actual" },
];

interface ColumnSample {
  values: number[];
  missingCount: number;
  invalidCount: number;
  nonMissingCount: number;
}

const round = (value: number, digits = 2): number => {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

const percent = (numerator: number, denominator: number): number =>
  denominator > 0 ? round((numerator / denominator) * 100) : 0;

const isMissing = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  (typeof value === "string" && value.trim() === "") ||
  (typeof value === "number" && !Number.isFinite(value));

const NUMERIC_TEXT =
  /^[+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i;

/** Converts common CSV/spreadsheet representations into a finite number. */
export const toAuditNumber = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  let text = value.trim();
  if (text === "") return null;
  const parenthesized = /^\(.*\)$/.test(text);
  text = text.replace(/[,$€£¥₹\s]/g, "").replace(/[()]/g, "");
  text = text.replace(/%$/, "");
  if (!NUMERIC_TEXT.test(text)) return null;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return null;
  return parenthesized ? -parsed : parsed;
};

const normaliseKey = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const standardDeviation = (values: number[], average = mean(values)): number => {
  if (values.length === 0) return 0;
  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length
  );
};

const quantile = (sorted: number[], probability: number): number => {
  if (sorted.length === 0) return 0;
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
};

const median = (values: number[]): number => quantile([...values].sort((a, b) => a - b), 0.5);

const riskLevel = (score: number): AuditRiskLevel => {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "moderate";
  return "low";
};

const riskRank: Record<AuditRiskLevel, number> = {
  critical: 0,
  high: 1,
  moderate: 2,
  low: 3,
};

const metricStatus = (score: number): ComplianceMetric["status"] => {
  if (score >= 85) return "pass";
  if (score >= 60) return "review";
  return "fail";
};

const firstDigit = (value: number): number => {
  const absolute = Math.abs(value);
  if (absolute === 0 || !Number.isFinite(absolute)) return 0;
  const exponent = Math.floor(Math.log10(absolute));
  return Math.floor(absolute / 10 ** exponent);
};

const discoverColumns = (rows: AuditRow[]): string[] => {
  const columns: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const column of Object.keys(row)) {
      if (!seen.has(column)) {
        seen.add(column);
        columns.push(column);
      }
    }
  }
  return columns;
};

const collectSamples = (rows: AuditRow[], columns: string[]): Map<string, ColumnSample> => {
  const samples = new Map<string, ColumnSample>();
  for (const column of columns) {
    samples.set(column, { values: [], missingCount: 0, invalidCount: 0, nonMissingCount: 0 });
  }
  for (const row of rows) {
    for (const column of columns) {
      const sample = samples.get(column);
      if (!sample) continue;
      const value = row[column];
      if (isMissing(value)) {
        sample.missingCount += 1;
        continue;
      }
      sample.nonMissingCount += 1;
      const numeric = toAuditNumber(value);
      if (numeric === null) sample.invalidCount += 1;
      else sample.values.push(numeric);
    }
  }
  return samples;
};

const isNumericColumn = (sample: ColumnSample): boolean =>
  sample.nonMissingCount > 0 && sample.values.length / sample.nonMissingCount >= 0.6;

const buildFinancialAnomalies = (
  columns: string[],
  samples: Map<string, ColumnSample>,
  rowCount: number
): FinancialAnomaly[] => {
  const numericColumns = columns.filter((column) => isNumericColumn(samples.get(column) ?? {
    values: [],
    missingCount: 0,
    invalidCount: 0,
    nonMissingCount: 0,
  }));
  const namedFinancial = numericColumns.filter((column) => FINANCIAL_COLUMN_PATTERN.test(column));
  const financialColumns = namedFinancial.length > 0 ? namedFinancial : numericColumns;

  return financialColumns
    .map((column) => {
      const sample = samples.get(column) ?? {
        values: [],
        missingCount: 0,
        invalidCount: 0,
        nonMissingCount: 0,
      };
      const values = sample.values;
      const sorted = [...values].sort((a, b) => a - b);
      const average = mean(values);
      const deviation = standardDeviation(values, average);
      const q1 = quantile(sorted, 0.25);
      const q3 = quantile(sorted, 0.75);
      const iqr = q3 - q1;
      const lowerFence = q1 - 1.5 * iqr;
      const upperFence = q3 + 1.5 * iqr;
      const centeredMedian = median(values);
      const mad = median(values.map((value) => Math.abs(value - centeredMedian)));
      const outlierCount = values.filter((value) => {
        if (values.length < 4) return false;
        if (iqr > 0) return value < lowerFence || value > upperFence;
        return mad > 0 && Math.abs(value - centeredMedian) > 3.5 * mad;
      }).length;
      const extremeCount = values.filter(
        (value) => deviation > 0 && Math.abs((value - average) / deviation) >= 3.5
      ).length;
      const negativeCount = values.filter((value) => value < 0).length;
      const zeroCount = values.filter((value) => value === 0).length;
      const constant = values.length > 1 && new Set(values).size === 1;
      const score = round(
        clamp(
          100 *
            (0.28 * (sample.missingCount / Math.max(rowCount, 1)) +
              0.22 * (sample.invalidCount / Math.max(rowCount, 1)) +
              0.2 * (negativeCount / Math.max(values.length, 1)) +
              0.2 * (outlierCount / Math.max(values.length, 1)) +
              0.05 * (extremeCount / Math.max(values.length, 1)) +
              0.05 * (constant ? 1 : 0)),
          0,
          100
        )
      );
      return {
        column,
        sampleSize: values.length,
        missingCount: sample.missingCount,
        invalidCount: sample.invalidCount,
        negativeCount,
        zeroCount,
        outlierCount,
        extremeCount,
        constant,
        min: sorted[0] ?? 0,
        max: sorted[sorted.length - 1] ?? 0,
        mean: round(average),
        standardDeviation: round(deviation),
        anomalyScore: score,
        riskLevel: riskLevel(score),
      } satisfies FinancialAnomaly;
    })
    .sort((a, b) => b.anomalyScore - a.anomalyScore || a.column.localeCompare(b.column));
};

const buildColumnVariance = (column: string, values: number[], threshold: number): VarianceRisk => {
  const average = mean(values);
  const deviation = standardDeviation(values, average);
  const changes = values.slice(1).map((value, index) => value - values[index]);
  const relativeChanges = values.slice(1).map((value, index) => {
    const previous = values[index];
    return previous === 0 ? (value === 0 ? 0 : 1) : Math.abs((value - previous) / previous);
  });
  const meanAbsoluteChange = mean(changes.map((value) => Math.abs(value)));
  const meanRelativeChange = mean(relativeChanges);
  const maxAbsoluteChange = changes.length > 0 ? Math.max(...changes.map((value) => Math.abs(value))) : 0;
  const maxRelativeChange = relativeChanges.length > 0 ? Math.max(...relativeChanges) : 0;
  const coefficientOfVariation = average === 0 ? (deviation > 0 ? 1 : 0) : deviation / Math.abs(average);
  const range = values.length > 0 ? Math.max(...values) - Math.min(...values) : 0;
  const rangeRisk = average === 0 ? (range > 0 ? 1 : 0) : range / Math.abs(average);
  const score = round(
    clamp(
      100 *
        (0.35 * clamp(coefficientOfVariation / Math.max(threshold * 3, 0.01)) +
          0.3 * clamp(maxRelativeChange / Math.max(threshold * 2, 0.01)) +
          0.2 * clamp(rangeRisk / Math.max(threshold * 4, 0.01)) +
          0.15 * clamp(meanRelativeChange / Math.max(threshold * 2, 0.01))),
      0,
      100
    )
  );
  return {
    column,
    comparisonColumn: null,
    source: "column",
    sampleSize: values.length,
    meanAbsoluteChange: round(meanAbsoluteChange),
    meanRelativeChange: round(meanRelativeChange * 100),
    maxAbsoluteChange: round(maxAbsoluteChange),
    maxRelativeChange: round(maxRelativeChange * 100),
    coefficientOfVariation: round(coefficientOfVariation),
    riskScore: score,
    riskLevel: riskLevel(score),
    detail: `CV ${percent(coefficientOfVariation, 1)} · peak row-to-row movement ${percent(
      maxRelativeChange,
      1
    )}%`,
  };
};

const buildVarianceRisks = (
  rows: AuditRow[],
  columns: string[],
  samples: Map<string, ColumnSample>,
  threshold: number
): VarianceRisk[] => {
  const risks: VarianceRisk[] = [];
  for (const column of columns) {
    const sample = samples.get(column);
    if (!sample || !isNumericColumn(sample) || sample.values.length < 3) continue;
    risks.push(buildColumnVariance(column, sample.values, threshold));
  }

  for (const pattern of PAIR_PATTERNS) {
    const left = columns.find((column) => pattern.left.test(column) && isNumericColumn(samples.get(column) ?? { values: [], missingCount: 0, invalidCount: 0, nonMissingCount: 0 }));
    const right = columns.find((column) => pattern.right.test(column) && isNumericColumn(samples.get(column) ?? { values: [], missingCount: 0, invalidCount: 0, nonMissingCount: 0 }));
    if (!left || !right || left === right) continue;
    const leftValues: number[] = [];
    const rightValues: number[] = [];
    for (const row of rows) {
      const a = toAuditNumber(row[left]);
      const b = toAuditNumber(row[right]);
      if (a === null || b === null) continue;
      leftValues.push(a);
      rightValues.push(b);
    }
    if (leftValues.length < 3) continue;
    const differences = leftValues.map((value, index) => value - rightValues[index]);
    const relative = differences.map((value, index) => {
      const base = Math.abs(rightValues[index]);
      return base === 0 ? (value === 0 ? 0 : 1) : Math.abs(value / base);
    });
    const material = relative.filter((value) => value >= threshold).length;
    const maxRelative = Math.max(...relative, 0);
    const score = round(
      clamp(100 * (0.55 * (material / Math.max(relative.length, 1)) + 0.45 * clamp(maxRelative / Math.max(threshold * 3, 0.01))))
    );
    risks.push({
      column: left,
      comparisonColumn: right,
      source: "paired",
      sampleSize: relative.length,
      meanAbsoluteChange: round(mean(differences.map((value) => Math.abs(value)))),
      meanRelativeChange: round(mean(relative) * 100),
      maxAbsoluteChange: round(Math.max(...differences.map((value) => Math.abs(value)), 0)),
      maxRelativeChange: round(maxRelative * 100),
      coefficientOfVariation: round(standardDeviation(differences) / Math.max(Math.abs(mean(rightValues)), 1)),
      riskScore: score,
      riskLevel: riskLevel(score),
      detail: `${pattern.label}: ${material} of ${relative.length} periods exceed ${round(
        threshold * 100
      )}% variance`,
    });
  }
  return risks.sort((a, b) => b.riskScore - a.riskScore || a.column.localeCompare(b.column));
};

const columnMatchesAlias = (column: string, aliases: string[]): boolean => {
  const key = normaliseKey(column);
  const tokens = key.split("_").filter(Boolean);
  return aliases.some((alias) => {
    const candidate = normaliseKey(alias);
    return key === candidate || tokens.includes(candidate) || key.endsWith(`_${candidate}`);
  });
};

const customSchemaDefinition = (parameter: string): SchemaDefinition => ({
  parameter,
  label: parameter.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
  aliases: [parameter],
  required: true,
  recommendation: `Add a ${parameter.replace(/[_-]+/g, " ")} parameter to the dataset.`,
});

const buildSchemaParameters = (
  columns: string[],
  options: AuditEngineOptions,
  applicable: boolean
): MissingSchemaParameter[] => {
  const requested = options.requiredSchemaParameters;
  const definitions = requested
    ? requested.map((parameter) => {
        const known = SCHEMA_DEFINITIONS.find(
          (definition) => definition.parameter === normaliseKey(parameter)
        );
        return known ?? customSchemaDefinition(parameter);
      })
    : SCHEMA_DEFINITIONS;

  return definitions.map((definition) => {
    const matchedColumn = applicable
      ? columns.find((column) => columnMatchesAlias(column, definition.aliases)) ?? null
      : null;
    return {
      parameter: definition.parameter,
      label: definition.label,
      aliases: [...definition.aliases],
      required: definition.required,
      present: matchedColumn !== null,
      matchedColumn,
      severity: definition.required ? "critical" : "warning",
      riskScore: matchedColumn === null ? (definition.required ? 18 : 8) : 0,
      recommendation: definition.recommendation,
    };
  });
};

const logGamma = (value: number): number => {
  const coefficients = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.984369578019572e-6, 1.5056327351493116e-7,
  ];
  if (value < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * value)) - logGamma(1 - value);
  const z = value - 1;
  let sum = 0.9999999999998099;
  for (let index = 0; index < coefficients.length; index += 1) {
    sum += coefficients[index] / (z + index + 1);
  }
  const t = z + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(sum);
};

const lowerGamma = (shape: number, x: number): number => {
  if (x <= 0) return 0;
  if (x < shape + 1) {
    let sum = 1 / shape;
    let term = sum;
    for (let index = 1; index < 300; index += 1) {
      term *= x / (shape + index);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-14) break;
    }
    return sum * Math.exp(-x + shape * Math.log(x) - logGamma(shape));
  }
  let b = x + 1 - shape;
  let c = 1e30;
  let d = 1 / b;
  let h = d;
  for (let index = 1; index < 300; index += 1) {
    const factor = -index * (index - shape);
    b += 2;
    d = factor * d + b;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = b + factor / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-14) break;
  }
  return 1 - Math.exp(-x + shape * Math.log(x) - logGamma(shape)) * h;
};

const chiSquarePValue = (statistic: number, degreesOfFreedom: number): number => {
  if (statistic <= 0 || degreesOfFreedom <= 0) return 1;
  return clamp(1 - lowerGamma(degreesOfFreedom / 2, statistic / 2), 0, 1);
};

const buildBenfordChecks = (
  financialColumns: string[],
  samples: Map<string, ColumnSample>
): BenfordCheck[] =>
  financialColumns.map((column) => {
    const values = (samples.get(column)?.values ?? []).filter((value) => Math.abs(value) > 0);
    const digitCounts: Record<string, number> = {
      "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0,
    };
    for (const value of values) {
      const digit = firstDigit(value);
      if (digit >= 1 && digit <= 9) digitCounts[String(digit)] += 1;
    }
    const observedShares = BENFORD_EXPECTED_SHARES.map((_, index) =>
      values.length > 0 ? digitCounts[String(index + 1)] / values.length : 0
    );
    const sufficientSample = values.length >= 30;
    const chiSquare = values.length > 0
      ? observedShares.reduce((sum, observed, index) => {
          const expectedCount = values.length * BENFORD_EXPECTED_SHARES[index];
          return sum + (expectedCount > 0 ? (observed * values.length - expectedCount) ** 2 / expectedCount : 0);
        }, 0)
      : 0;
    const pValue = sufficientSample ? chiSquarePValue(chiSquare, 8) : 1;
    const deviations = observedShares.map(
      (observed, index) => Math.abs(observed - BENFORD_EXPECTED_SHARES[index])
    );
    const deviation = round(deviations.reduce((sum, value) => sum + value, 0), 4);
    const maxDeviation = round(Math.max(...deviations, 0), 4);
    const compliant = sufficientSample && pValue >= 0.05;
    const score = sufficientSample
      ? round(clamp(compliant ? Math.min(20, (1 - pValue) * 10 + maxDeviation * 100) : 50 + (1 - pValue) * 50, 0, 100))
      : 0;
    return {
      column,
      sampleSize: values.length,
      chiSquare: round(chiSquare, 4),
      degreesOfFreedom: 8,
      pValue: round(pValue, 4),
      deviation,
      maxDeviation,
      compliant,
      sufficientSample,
      riskScore: score,
      digitCounts,
      observedShares: observedShares.map((value) => round(value, 4)),
      expectedShares: [...BENFORD_EXPECTED_SHARES],
    } satisfies BenfordCheck;
  }).sort((a, b) => b.riskScore - a.riskScore || a.column.localeCompare(b.column));

const makeFinding = (
  category: AuditCategory,
  severity: AuditRiskLevel,
  title: string,
  detail: string,
  evidence: string[],
  recommendation: string,
  riskContribution: number,
  column: string | null = null
): AuditFinding => ({
  id: `${category}-${column ?? "global"}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  category,
  severity,
  title,
  detail,
  evidence,
  recommendation,
  riskContribution: round(riskContribution, 1),
  column,
});

const buildFindings = (
  anomalies: FinancialAnomaly[],
  varianceRisks: VarianceRisk[],
  schemaParameters: MissingSchemaParameter[],
  benfordChecks: BenfordCheck[]
): AuditFinding[] => {
  const findings: AuditFinding[] = [];
  for (const anomaly of anomalies) {
    if (anomaly.anomalyScore < 20) continue;
    const evidence = [
      `${anomaly.sampleSize.toLocaleString()} numeric observations`,
      anomaly.negativeCount > 0 ? `${anomaly.negativeCount} negative value(s)` : null,
      anomaly.outlierCount > 0 ? `${anomaly.outlierCount} IQR outlier(s)` : null,
      anomaly.invalidCount > 0 ? `${anomaly.invalidCount} invalid numeric value(s)` : null,
      anomaly.constant ? "Column is constant" : null,
    ].filter((item): item is string => item !== null);
    findings.push(
      makeFinding(
        "financial",
        anomaly.riskLevel,
        `${anomaly.column} requires forensic review`,
        `The ${anomaly.column} measure contains ${anomaly.outlierCount} outlier(s), ${anomaly.negativeCount} negative value(s), or incomplete observations that may distort financial reporting.`,
        evidence,
        "Validate the source ledger, confirm the sign convention, and document any approved exceptions before aggregation.",
        anomaly.anomalyScore,
        anomaly.column
      )
    );
  }

  for (const variance of varianceRisks) {
    if (variance.riskScore < 25 && variance.source !== "paired") continue;
    findings.push(
      makeFinding(
        "variance",
        variance.riskLevel,
        `${variance.column} shows material variance risk`,
        variance.detail,
        [
          `Coefficient of variation ${variance.coefficientOfVariation}%`,
          `Maximum relative movement ${variance.maxRelativeChange}%`,
          `${variance.sampleSize.toLocaleString()} observations evaluated`,
        ],
        "Reconcile the measure to its source period, investigate threshold breaches, and attach an approved variance explanation.",
        variance.riskScore,
        variance.column
      )
    );
  }

  for (const parameter of schemaParameters) {
    if (parameter.present) continue;
    findings.push(
      makeFinding(
        "schema",
        parameter.severity === "critical" ? "high" : "moderate",
        `${parameter.label} is missing from the audit schema`,
        parameter.recommendation,
        [`No column matched: ${parameter.aliases.slice(0, 4).join(", ")}`],
        parameter.recommendation,
        parameter.riskScore,
        null
      )
    );
  }

  for (const check of benfordChecks) {
    if (!check.sufficientSample || check.compliant) continue;
    findings.push(
      makeFinding(
        "benford",
        check.riskScore >= 75 ? "critical" : check.riskScore >= 50 ? "high" : "moderate",
        `${check.column} fails the Benford plausibility screen`,
        `The first-digit distribution differs from Benford's expected pattern (χ² ${check.chiSquare}, p = ${check.pValue}).`,
        [
          `${check.sampleSize.toLocaleString()} positive observations`,
          `Maximum share deviation ${(check.maxDeviation * 100).toFixed(1)} percentage points`,
        ],
        "Inspect source transformations, manual overrides, round-number entries, and the sampling window before relying on this measure.",
        check.riskScore,
        check.column
      )
    );
  }

  return findings.sort(
    (a, b) => riskRank[a.severity] - riskRank[b.severity] || b.riskContribution - a.riskContribution
  );
};

const complianceMetricAverage = (values: number[]): number =>
  values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const DEFAULT_MAX_ROWS = 50_000;
const DEFAULT_VARIANCE_THRESHOLD = 0.1;

const makeForensicLog = (
  timestamp: string,
  index: number,
  level: AuditLogLevel,
  category: AuditCategory,
  message: string,
  details: string
): ForensicLog => ({
  id: `${category}-${timestamp}-${index}`,
  timestamp,
  level,
  category,
  message,
  details,
});

const makeComplianceMetric = (
  key: string,
  label: string,
  rawScore: number,
  detail: string
): ComplianceMetric => {
  const score = round(clamp(rawScore, 0, 100));
  return { key, label, score, status: metricStatus(score), detail };
};

/**
 * Runs the complete autonomous financial forensic audit synchronously.
 * The scan is bounded by `maxRows`; summary counts always describe the input.
 */
export function runAutonomousAudit(
  rows: AuditRow[],
  options: AuditEngineOptions = {}
): AuditEngineReport {
  const inputRows = Array.isArray(rows) ? rows : [];
  const rowCount = inputRows.length;
  const requestedLimit = options.maxRows ?? DEFAULT_MAX_ROWS;
  const maxRows = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.floor(requestedLimit))
    : DEFAULT_MAX_ROWS;
  const requestedThreshold = options.varianceThreshold ?? DEFAULT_VARIANCE_THRESHOLD;
  const varianceThreshold = Number.isFinite(requestedThreshold)
    ? Math.max(0, requestedThreshold)
    : DEFAULT_VARIANCE_THRESHOLD;
  const scanRows = inputRows.slice(0, maxRows);
  const scannedRows = scanRows.length;
  const columns = discoverColumns(scanRows);
  const samples = collectSamples(scanRows, columns);
  const numericColumns = columns.filter((column) => isNumericColumn(samples.get(column) ?? {
    values: [],
    missingCount: 0,
    invalidCount: 0,
    nonMissingCount: 0,
  }));
  const financialAnomalies = buildFinancialAnomalies(columns, samples, scannedRows);
  const financialColumns = financialAnomalies.map((anomaly) => anomaly.column);
  const varianceRisks = buildVarianceRisks(scanRows, columns, samples, varianceThreshold);
  const hasFinancialSignal = financialAnomalies.length > 0;
  const schemaParameters = hasFinancialSignal
    ? buildSchemaParameters(columns, options, true)
    : [];
  const missingSchemaParameters = schemaParameters.filter((parameter) => !parameter.present);
  const benfordChecks = buildBenfordChecks(financialColumns, samples);
  const findings = buildFindings(
    financialAnomalies,
    varianceRisks,
    schemaParameters,
    benfordChecks
  );
  const timestampValue =
    options.now instanceof Date && Number.isFinite(options.now.getTime())
      ? options.now
      : new Date();
  const generatedAt = timestampValue.toISOString();

  const totalCells = scannedRows * columns.length;
  const invalidCells = [...samples.values()].reduce(
    (sum, sample) => sum + sample.missingCount + sample.invalidCount,
    0
  );
  const completenessScore = totalCells > 0 ? (1 - invalidCells / totalCells) * 100 : 100;
  const financialRisk = complianceMetricAverage(financialAnomalies.map((item) => item.anomalyScore));
  const varianceRisk = complianceMetricAverage(
    varianceRisks.slice(0, 8).map((item) => item.riskScore)
  );
  const benfordRisk = Math.max(0, ...benfordChecks.map((check) => check.riskScore));
  const schemaRisk = Math.max(
    0,
    ...schemaParameters.map((parameter) => parameter.riskScore)
  );
  const riskScore = round(
    clamp(
      100 *
        (0.4 * clamp(financialRisk / 100) +
          0.25 * clamp(varianceRisk / 100) +
          0.2 * clamp(benfordRisk / 100) +
          0.15 * clamp(schemaRisk / 100))
    )
  );
  const benfordCompliance =
    benfordChecks.length === 0
      ? 100
      : complianceMetricAverage(
          benfordChecks.map((check) =>
            !check.sufficientSample ? 70 : check.compliant ? 100 : 100 - check.riskScore
          )
        );
  const schemaCompliance =
    schemaParameters.length === 0
      ? 100
      : (schemaParameters.filter((parameter) => parameter.present).length /
          schemaParameters.length) *
        100;
  const reportComplianceScore = round(
    clamp(
      0.3 * completenessScore +
        0.25 * (100 - financialRisk) +
        0.15 * (100 - varianceRisk) +
        0.15 * benfordCompliance +
        0.15 * schemaCompliance
    )
  );
  const reportRiskLevel = riskLevel(riskScore);
  const auditStatus: AuditEngineReport["auditStatus"] =
    riskScore >= 50 ? "escalate" : riskScore >= 25 ? "review" : "clear";
  const coverage = rowCount > 0 ? round((scannedRows / rowCount) * 100, 2) : 0;
  const truncated = scannedRows < rowCount;

  const complianceMetrics: ComplianceMetric[] = [
    makeComplianceMetric(
      "completeness",
      "Data completeness",
      completenessScore,
      `${invalidCells.toLocaleString()} missing or invalid cells across the scanned schema.`
    ),
    makeComplianceMetric(
      "financial_integrity",
      "Financial integrity",
      100 - financialRisk,
      `${financialAnomalies.length.toLocaleString()} financial measure(s) screened for anomalies.`
    ),
    makeComplianceMetric(
      "variance_stability",
      "Variance stability",
      100 - varianceRisk,
      `${varianceRisks.length.toLocaleString()} variable or paired variance risk(s) identified.`
    ),
    makeComplianceMetric(
      "benford_plausibility",
      "Benford plausibility",
      benfordCompliance,
      `${benfordChecks.filter((check) => check.compliant).length.toLocaleString()} of ${benfordChecks.length.toLocaleString()} eligible checks passed.`
    ),
    makeComplianceMetric(
      "schema_control",
      "Schema controls",
      schemaCompliance,
      `${missingSchemaParameters.length.toLocaleString()} required or recommended control(s) are absent.`
    ),
  ];

  const logs: ForensicLog[] = [
    makeForensicLog(
      generatedAt,
      1,
      "info",
      "system",
      "Autonomous forensic scan completed",
      `${scannedRows.toLocaleString()} of ${rowCount.toLocaleString()} row(s) and ${columns.length.toLocaleString()} column(s) were evaluated.`
    ),
  ];
  if (truncated) {
    logs.push(
      makeForensicLog(
        generatedAt,
        2,
        "warning",
        "system",
        "Bounded scan limit reached",
        `The report uses the first ${maxRows.toLocaleString()} rows; ${(
          rowCount - scannedRows
        ).toLocaleString()} row(s) were not scanned.`
      )
    );
  }
  if (hasFinancialSignal) {
    logs.push(
      makeForensicLog(
        generatedAt,
        logs.length + 1,
        "info",
        "financial",
        "Financial anomaly screen completed",
        `${financialAnomalies.length.toLocaleString()} financial measure(s) were evaluated using completeness, sign, IQR, and extreme-value controls.`
      )
    );
  }
  if (benfordChecks.some((check) => check.sufficientSample)) {
    const failed = benfordChecks.filter(
      (check) => check.sufficientSample && !check.compliant
    ).length;
    logs.push(
      makeForensicLog(
        generatedAt,
        logs.length + 1,
        failed > 0 ? "warning" : "success",
        "benford",
        failed > 0 ? "Benford review threshold reached" : "Benford screen passed",
        `${failed.toLocaleString()} of ${benfordChecks.length.toLocaleString()} eligible first-digit distribution(s) require review.`
      )
    );
  }
  logs.push(
    makeForensicLog(
      generatedAt,
      logs.length + 1,
      reportRiskLevel === "critical" || reportRiskLevel === "high"
        ? "critical"
        : findings.length > 0
        ? "warning"
        : "success",
      "system",
      auditStatus === "escalate"
        ? "Risk escalation recommended"
        : auditStatus === "review"
        ? "Forensic review recommended"
        : "No material risk escalation required",
      `Final risk score ${riskScore}/100 (${reportRiskLevel}); compliance score ${reportComplianceScore}/100.`
    )
  );

  return {
    generatedAt,
    rowCount,
    scannedRows,
    columnCount: columns.length,
    columns,
    numericColumns,
    financialColumns,
    truncated,
    financialAnomalies,
    anomalies: financialAnomalies,
    varianceRisks,
    schemaParameters,
    missingSchemaParameters,
    benfordChecks,
    findings,
    complianceMetrics,
    forensicLogs: logs,
    riskScore,
    complianceScore: reportComplianceScore,
    riskLevel: reportRiskLevel,
    coverage,
    auditStatus,
  };
}

/** Alias retained for callers that use the full forensic-engine name. */
export const runFinancialForensicAudit = runAutonomousAudit;
