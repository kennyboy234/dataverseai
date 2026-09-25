/* DataVerse AI — Econometric & Statistical Analysis Engine
 * Pure-TypeScript, dependency-free implementations of:
 *   - OLS multiple regression (matrix-based)
 *   - Panel diagnostics (Fixed vs Random effects → Hausman test)
 *   - Cronbach's Alpha reliability test
 */

export type Row = Record<string, unknown>;

/* ------------------------------------------------------------------ */
/*  Small matrix toolkit                                               */
/* ------------------------------------------------------------------ */

export type Matrix = number[][];

export const transpose = (m: Matrix): Matrix => {
  if (m.length === 0) return [];
  const rows = m.length;
  const cols = m[0].length;
  const out: Matrix = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let i = 0; i < rows; i += 1) {
    for (let j = 0; j < cols; j += 1) out[j][i] = m[i][j];
  }
  return out;
};

export const matMul = (a: Matrix, b: Matrix): Matrix => {
  const n = a.length;
  const m = b[0].length;
  const p = b.length;
  const out: Matrix = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let i = 0; i < n; i += 1) {
    for (let k = 0; k < p; k += 1) {
      const aik = a[i][k];
      if (aik === 0) continue;
      for (let j = 0; j < m; j += 1) out[i][j] += aik * b[k][j];
    }
  }
  return out;
};

export const invert = (m: Matrix): Matrix | null => {
  const n = m.length;
  if (n === 0 || m[0].length !== n) return null;
  const a: Matrix = m.map((row) => [...row]);
  const inv: Matrix = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );

  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    }
    if (Math.abs(a[pivot][col]) < 1e-12) return null;
    if (pivot !== col) {
      [a[col], a[pivot]] = [a[pivot], a[col]];
      [inv[col], inv[pivot]] = [inv[pivot], inv[col]];
    }
    const diag = a[col][col];
    for (let j = 0; j < n; j += 1) {
      a[col][j] /= diag;
      inv[col][j] /= diag;
    }
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue;
      const factor = a[r][col];
      if (factor === 0) continue;
      for (let j = 0; j < n; j += 1) {
        a[r][j] -= factor * a[col][j];
        inv[r][j] -= factor * inv[col][j];
      }
    }
  }
  return inv;
};

/* Regularised lower incomplete gamma P(a,x) */
function lowerGamma(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x < a + 1) {
    let sum = 1 / a;
    let term = sum;
    for (let n = 1; n < 300; n += 1) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-14) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  }
  let b = x + 1 - a;
  let c = 1e30;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 300; i += 1) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = b + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-14) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

/* Lanczos approximation of ln Gamma(z) */
export function logGamma(z: number): number {
  const g = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  const zz = z - 1;
  let x = 0.99999999999980993;
  for (let i = 0; i < g.length; i += 1) x += g[i] / (zz + i + 1);
  const t = zz + g.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (zz + 0.5) * Math.log(t) - t + Math.log(x);
}

/* Survival function of the chi-square distribution */
export function chiSquarePValue(chiSquare: number, df: number): number {
  if (df <= 0 || chiSquare < 0) return 1;
  return Math.max(0, Math.min(1, 1 - lowerGamma(df / 2, chiSquare / 2)));
}

/* Regularised incomplete beta I_x(a,b) */
function betaIncomplete(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbeta = logGamma(a + b) - logGamma(a) - logGamma(b);
  const front = Math.exp(lbeta + a * Math.log(x) + b * Math.log(1 - x)) / a;
  const cf = betaContinuedFraction(a, b, x);
  return x < (a + 1) / (a + b + 2) ? front * cf : 1 - betaIncomplete(b, a, 1 - x);
}

function betaContinuedFraction(a: number, b: number, x: number): number {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-14) break;
  }
  return h;
}

export function tStatPValue(t: number, df: number): number {
  if (df <= 0) return 1;
  const x = df / (df + t * t);
  return Math.max(0, Math.min(1, betaIncomplete(df / 2, 0.5, x)));
}

export function fStatPValue(f: number, df1: number, df2: number): number {
  if (f <= 0 || df1 <= 0 || df2 <= 0) return 1;
  const x = df2 / (df2 + df1 * f);
  return Math.max(0, Math.min(1, betaIncomplete(df2 / 2, df1 / 2, x)));
}

export interface Coefficient {
  term: string;
  beta: number;
  stdError: number;
  tStat: number;
  pValue: number;
  ciLow: number;
  ciHigh: number;
  significant: boolean;
}

export interface OLSResult {
  coefficients: Coefficient[];
  n: number;
  k: number;
  rSquared: number;
  adjRSquared: number;
  fStat: number;
  fPValue: number;
  rmse: number;
  dw: number;
  yName: string;
  xNames: string[];
}

export interface DesignMatrix {
  y: number[];
  x: number[][];
  yName: string;
  xNames: string[];
}

const Z_975 = 1.959963984540054;

export function runOLS(input: DesignMatrix): OLSResult | null {
  const { y, x, yName, xNames } = input;
  const n = y.length;
  const k = x.length > 0 ? x[0].length : 0;
  if (n === 0 || k === 0 || n <= k) return null;

  const Xt = transpose(x);
  const XtXinv = invert(matMul(Xt, x));
  if (!XtXinv) return null;

  const Xty = matMul(Xt, y.map((value) => [value]));
  const beta = matMul(XtXinv, Xty).map((row) => row[0]);

  const yHat = x.map((row) => row.reduce((sum, value, i) => sum + value * beta[i], 0));
  const yMean = y.reduce((sum, value) => sum + value, 0) / n;

  let ssr = 0;
  let sst = 0;
  for (let i = 0; i < n; i += 1) {
    ssr += (y[i] - yHat[i]) ** 2;
    sst += (y[i] - yMean) ** 2;
  }

  const dfResid = n - k;
  const sigma2 = dfResid > 0 ? ssr / dfResid : 0;
  const rSquared = sst === 0 ? 0 : 1 - ssr / sst;
  const adjRSquared = n > k ? 1 - (1 - rSquared) * ((n - 1) / dfResid) : rSquared;

  const coefficients: Coefficient[] = beta.map((value, i) => {
    const variance = sigma2 * XtXinv[i][i];
    const stdError = Math.sqrt(Math.max(variance, 0));
    const tStat = stdError === 0 ? 0 : value / stdError;
    const pValue = tStatPValue(tStat, dfResid);
    return {
      term: xNames[i] ?? `x${i}`,
      beta: value,
      stdError,
      tStat,
      pValue,
      ciLow: value - Z_975 * stdError,
      ciHigh: value + Z_975 * stdError,
      significant: pValue < 0.05,
    };
  });

  const dfModel = k - 1;
  const fStat =
    dfModel > 0 && dfResid > 0 && ssr > 0 ? (rSquared / dfModel) / ((1 - rSquared) / dfResid) : 0;
  const fPValue = dfModel > 0 && dfResid > 0 ? fStatPValue(fStat, dfModel, dfResid) : 1;
  const rmse = Math.sqrt(sigma2);

  let dwNum = 0;
  let dwDen = 0;
  for (let i = 0; i < n; i += 1) {
    dwDen += (y[i] - yHat[i]) ** 2;
    if (i > 0) dwNum += (y[i] - yHat[i] - (y[i - 1] - yHat[i - 1])) ** 2;
  }
  const dw = dwDen === 0 ? 0 : dwNum / dwDen;

  return {
    coefficients,
    n,
    k,
    rSquared,
    adjRSquared,
    fStat,
    fPValue,
    rmse,
    dw,
    yName,
    xNames,
  };
}

export const toNumber = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

/* Builds a complete-cases design matrix with an intercept column prepended */
export function buildDesignMatrix(
  rows: Row[],
  yColumn: string,
  xColumns: string[]
): DesignMatrix | null {
  if (!yColumn || xColumns.length === 0) return null;
  const y: number[] = [];
  const x: number[][] = [];

  for (const row of rows) {
    const yValue = toNumber(row[yColumn]);
    if (yValue === null) continue;
    const xValues = xColumns.map((column) => toNumber(row[column]));
    if (xValues.some((value) => value === null)) continue;
    y.push(yValue);
    x.push([1, ...(xValues as number[])]);
  }

  if (y.length === 0) return null;
  return { y, x, yName: yColumn, xNames: ["(Intercept)", ...xColumns] };
}

export interface HausmanResult {
  chiSquare: number;
  df: number;
  pValue: number;
  conclusion: string;
  betaFE: number[];
  betaRE: number[];
  terms: string[];
  groups: number;
  n: number;
}

export interface PanelOptions {
  rows: Row[];
  yColumn: string;
  xColumns: string[];
  entityColumn: string;
}

function solveDesign(y: number[], x: number[][]): number[] | null {
  const Xt = transpose(x);
  const XtXinv = invert(matMul(Xt, x));
  if (!XtXinv) return null;
  const Xty = matMul(Xt, y.map((value) => [value]));
  return matMul(XtXinv, Xty).map((row) => row[0]);
}

export function runHausman(options: PanelOptions): HausmanResult | null {
  const { rows, yColumn, xColumns, entityColumn } = options;
  if (!yColumn || xColumns.length === 0 || !entityColumn) return null;

  const entities: string[] = [];
  const seen = new Set<string>();
  const y: number[] = [];
  const x: number[][] = [];
  const group: number[] = [];

  for (const row of rows) {
    const yValue = toNumber(row[yColumn]);
    if (yValue === null) continue;
    const xValues = xColumns.map((column) => toNumber(row[column]));
    if (xValues.some((value) => value === null)) continue;
    const entity = String(row[entityColumn] ?? "");
    if (!seen.has(entity)) {
      seen.add(entity);
      entities.push(entity);
    }
    group.push(entities.indexOf(entity));
    y.push(yValue);
    x.push([1, ...(xValues as number[])]);
  }

  const groups = entities.length;
  const n = y.length;
  const k = xColumns.length;
  if (groups < 2 || n <= k + groups) return null;

  const groupMeansY = new Array(groups).fill(0);
  const groupMeansX = Array.from({ length: groups }, () => new Array(k + 1).fill(0));
  const groupCounts = new Array(groups).fill(0);
  for (let i = 0; i < n; i += 1) {
    const g = group[i];
    groupMeansY[g] += y[i];
    groupCounts[g] += 1;
    for (let j = 0; j <= k; j += 1) groupMeansX[g][j] += x[i][j];
  }
  const grandMeanY = y.reduce((a, b) => a + b, 0) / n;
  for (let g = 0; g < groups; g += 1) {
    groupMeansY[g] /= groupCounts[g] || 1;
    for (let j = 0; j <= k; j += 1) groupMeansX[g][j] /= groupCounts[g] || 1;
  }

  /* Fixed effects: within transformation (demean by entity) */
  const yW = y.map((value, i) => value - groupMeansY[group[i]]);
  const xWithin = x.map((row, i) =>
    row.slice(1).map((value, j) => value - groupMeansX[group[i]][j + 1])
  );
  const betaFE = solveDesign(yW, xWithin);
  if (!betaFE) return null;

  /* Random effects: quasi-demeaning with theta in (0,1) */
  let te = 0;
  for (let i = 0; i < n; i += 1) te += (y[i] - groupMeansY[group[i]]) ** 2;
  const sigma2E = n > groups ? te / (n - groups) : 1;
  let varBetween = 0;
  for (let g = 0; g < groups; g += 1) varBetween += (groupMeansY[g] - grandMeanY) ** 2;
  varBetween /= Math.max(groups - 1, 1);
  const theta = varBetween > 0 ? 1 - Math.sqrt(sigma2E / (sigma2E + varBetween)) : 0.5;
  const thetaC = Math.min(0.95, Math.max(0.05, Number.isFinite(theta) ? theta : 0.5));

  const yRE = y.map((value, i) => value - thetaC * groupMeansY[group[i]]);
  const xRE = x.map((row, i) =>
    row.map((value, j) => value - thetaC * groupMeansX[group[i]][j])
  );
  const betaREFull = solveDesign(yRE, xRE);
  if (!betaREFull) return null;
  const betaRE = betaREFull.slice(1);

  /* Chi-square from squared differences scaled by FE variance */
  const dfResid = n - k - groups;
  const yHatW = xWithin.map((row) => row.reduce((s, v, j) => s + v * betaFE[j], 0));
  let ssr = 0;
  for (let i = 0; i < n; i += 1) ssr += (yW[i] - yHatW[i]) ** 2;
  const sigma2 = dfResid > 0 ? ssr / dfResid : 0;
  const XtXinvW = invert(matMul(transpose(xWithin), xWithin));

  let chiSquare = 0;
  let df = 0;
  if (XtXinvW) {
    for (let j = 0; j < k; j += 1) {
      const diff = betaFE[j] - betaRE[j];
      const varFE = sigma2 * XtXinvW[j][j];
      const varDiff = Math.max(varFE * 0.5, 1e-12);
      chiSquare += (diff * diff) / varDiff;
      df += 1;
    }
  }
  const pValue = chiSquarePValue(chiSquare, df);
  const conclusion =
    pValue < 0.05
      ? "Reject the null - Fixed Effects is preferred (p < 0.05)."
      : "Fail to reject the null - Random Effects is consistent and preferred.";

  return {
    chiSquare,
    df,
    pValue,
    conclusion,
    betaFE,
    betaRE,
    terms: xColumns,
    groups,
    n,
  };
}

/* ------------------------------------------------------------------ */
/*  Cronbach's Alpha reliability test                                  */
/* ------------------------------------------------------------------ */

export interface CronbachResult {
  alpha: number;
  items: number;
  respondents: number;
  averageInterItemCorrelation: number;
  itemVariances: Array<{ item: string; variance: number; totalCorrelation: number }>;
  ifItemDeleted: Array<{ item: string; alphaWithout: number }>;
  interpretation: string;
}

export interface CronbachOptions {
  rows: Row[];
  itemColumns: string[];
}

const varianceOf = (values: number[]): number => {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
};

export function runCronbach(options: CronbachOptions): CronbachResult | null {
  const { rows, itemColumns } = options;
  if (itemColumns.length < 2) return null;

  /* complete-cases item matrix */
  const matrix: number[][] = [];
  for (const row of rows) {
    const values = itemColumns.map((column) => toNumber(row[column]));
    if (values.some((value) => value === null)) continue;
    matrix.push(values as number[]);
  }
  const respondents = matrix.length;
  const items = itemColumns.length;
  if (respondents < 2) return null;

  /* total scores per respondent */
  const totals = matrix.map((row) => row.reduce((a, b) => a + b, 0));
  const totalVariance = varianceOf(totals);

  const itemVariances = itemColumns.map((item, j) => {
    const column = matrix.map((row) => row[j]);
    return { item, variance: varianceOf(column), totalCorrelation: 0 };
  });
  const sumItemVariance = itemVariances.reduce((sum, item) => sum + item.variance, 0);

  const alpha =
    totalVariance === 0 || items < 2
      ? 0
      : (items / (items - 1)) * (1 - sumItemVariance / totalVariance);

  /* item-total correlations (corrected) */
  for (let j = 0; j < items; j += 1) {
    const itemValues = matrix.map((row) => row[j]);
    const restTotals = matrix.map((row) => row.reduce((a, b, k) => (k === j ? a : a + b), 0));
    const meanItem = itemValues.reduce((a, b) => a + b, 0) / respondents;
    const meanRest = restTotals.reduce((a, b) => a + b, 0) / respondents;
    let num = 0;
    let denI = 0;
    let denR = 0;
    for (let i = 0; i < respondents; i += 1) {
      const di = itemValues[i] - meanItem;
      const dr = restTotals[i] - meanRest;
      num += di * dr;
      denI += di * di;
      denR += dr * dr;
    }
    const den = Math.sqrt(denI * denR);
    itemVariances[j].totalCorrelation = den === 0 ? 0 : num / den;
  }

  /* alpha if item deleted */
  const ifItemDeleted = itemColumns.map((item, drop) => {
    const kept = itemColumns.filter((_, j) => j !== drop);
    const keptMatrix = matrix.map((row) => row.filter((_, j) => j !== drop));
    const keptTotals = keptMatrix.map((row) => row.reduce((a, b) => a + b, 0));
    const keptTotalVar = varianceOf(keptTotals);
    const keptItemVar = kept.reduce((sum, _, j) => sum + varianceOf(keptMatrix.map((r) => r[j])), 0);
    const k = kept.length;
    const a = keptTotalVar === 0 || k < 2 ? 0 : (k / (k - 1)) * (1 - keptItemVar / keptTotalVar);
    return { item, alphaWithout: a };
  });

  /* average inter-item correlation */
  let corrSum = 0;
  let corrCount = 0;
  for (let a = 0; a < items; a += 1) {
    for (let b = a + 1; b < items; b += 1) {
      const va = matrix.map((row) => row[a]);
      const vb = matrix.map((row) => row[b]);
      const ma = va.reduce((x, y) => x + y, 0) / respondents;
      const mb = vb.reduce((x, y) => x + y, 0) / respondents;
      let num = 0;
      let da = 0;
      let db = 0;
      for (let i = 0; i < respondents; i += 1) {
        num += (va[i] - ma) * (vb[i] - mb);
        da += (va[i] - ma) ** 2;
        db += (vb[i] - mb) ** 2;
      }
      const den = Math.sqrt(da * db);
      corrSum += den === 0 ? 0 : num / den;
      corrCount += 1;
    }
  }
  const averageInterItemCorrelation = corrCount === 0 ? 0 : corrSum / corrCount;

  const interpretation =
    alpha >= 0.9
      ? "Excellent internal consistency"
      : alpha >= 0.8
      ? "Good internal consistency"
      : alpha >= 0.7
      ? "Acceptable internal consistency"
      : alpha >= 0.6
      ? "Questionable reliability — consider revising items"
      : "Poor reliability — the scale needs significant revision";

  return {
    alpha,
    items,
    respondents,
    averageInterItemCorrelation,
    itemVariances,
    ifItemDeleted,
    interpretation,
  };
}
