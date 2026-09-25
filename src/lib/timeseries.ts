/* DataVerse AI — Time-Series & Unit Root Diagnostics Engine
 * Pure-TypeScript, dependency-free implementations of:
 *   - Augmented Dickey-Fuller (ADF) unit root test
 *   - Durbin-Watson autocorrelation diagnostic
 *   - Automated ARIMA-style forecasting (AR on differenced series)
 */

export type Row = Record<string, unknown>;

export const toNumber = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

/* Extracts an ordered numeric series from rows, optionally sorted by a time column */
export function extractSeries(
  rows: Row[],
  valueColumn: string,
  timeColumn?: string
): { values: number[]; labels: string[] } {
  const indexed = rows
    .map((row, i) => ({ row, i }))
    .filter(({ row }) => toNumber(row[valueColumn]) !== null);

  if (timeColumn) {
    indexed.sort((a, b) => {
      const ta = a.row[timeColumn];
      const tb = b.row[timeColumn];
      const na = toNumber(ta);
      const nb = toNumber(tb);
      if (na !== null && nb !== null) return na - nb;
      const da = Date.parse(String(ta ?? ""));
      const db = Date.parse(String(tb ?? ""));
      if (!Number.isNaN(da) && !Number.isNaN(db)) return da - db;
      return a.i - b.i;
    });
  }

  const values = indexed.map(({ row }) => toNumber(row[valueColumn]) as number);
  const labels = indexed.map(({ row }, k) =>
    timeColumn ? String(row[timeColumn] ?? k + 1) : String(k + 1)
  );
  return { values, labels };
}

/* Durbin-Watson statistic for a residual series (0-4, ~2 = no autocorrelation) */
export function durbinWatson(residuals: number[]): number {
  if (residuals.length < 2) return 0;
  let num = 0;
  let den = 0;
  for (let i = 0; i < residuals.length; i += 1) {
    den += residuals[i] ** 2;
    if (i > 0) num += (residuals[i] - residuals[i - 1]) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export function dwInterpretation(dw: number): string {
  if (dw < 1) return "Strong positive autocorrelation";
  if (dw < 1.5) return "Positive autocorrelation likely";
  if (dw <= 2.5) return "No significant autocorrelation";
  if (dw <= 3) return "Negative autocorrelation likely";
  return "Strong negative autocorrelation";
}

export interface ADFResult {
  statistic: number;
  pValue: number;
  lags: number;
  n: number;
  criticalValues: { one: number; five: number; ten: number };
  stationary: boolean;
  conclusion: string;
}

/* MacKinnon (1996) response-surface critical values for the ADF test (with constant) */
function adfCritical(n: number): { one: number; five: number; ten: number } {
  const t = 1 / n;
  const one = -3.43035 - 6.5393 * t - 16.786 * t * t - 79.433 * t * t * t;
  const five = -2.86154 - 2.74 * t - 4.388 * t * t - 55.0 * t * t * t;
  const ten = -2.56677 - 1.5384 * t - 2.809 * t * t;
  return { one, five, ten };
}

/* Approximate ADF p-value by interpolating the MacKinnon surface */
function adfPValue(stat: number, n: number): number {
  const crit = adfCritical(n);
  if (stat <= crit.one) return 0.005;
  if (stat <= crit.five) {
    const frac = (stat - crit.one) / (crit.five - crit.one);
    return 0.005 + frac * (0.05 - 0.005);
  }
  if (stat <= crit.ten) {
    const frac = (stat - crit.five) / (crit.ten - crit.five);
    return 0.05 + frac * (0.1 - 0.05);
  }
  if (stat <= 0) {
    const frac = (stat - crit.ten) / (0 - crit.ten);
    return 0.1 + frac * 0.8;
  }
  return 0.95;
}

/* Small least-squares solver for the ADF regression */
function solveLeastSquares(x: number[][], y: number[]): number[] | null {
  const n = y.length;
  const k = x[0].length;
  const xtx: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
  const xty: number[] = new Array(k).fill(0);
  for (let i = 0; i < n; i += 1) {
    for (let a = 0; a < k; a += 1) {
      xty[a] += x[i][a] * y[i];
      for (let b = 0; b < k; b += 1) xtx[a][b] += x[i][a] * x[i][b];
    }
  }
  /* Gauss-Jordan */
  const aug: number[][] = xtx.map((row, i) => [
    ...row,
    ...Array.from({ length: k }, (_, j) => (i === j ? 1 : 0)),
  ]);
  for (let col = 0; col < k; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < k; r += 1) {
      if (Math.abs(aug[r][col]) > Math.abs(aug[pivot][col])) pivot = r;
    }
    if (Math.abs(aug[pivot][col]) < 1e-12) return null;
    [aug[col], aug[pivot]] = [aug[pivot], aug[col]];
    const diag = aug[col][col];
    for (let j = 0; j < 2 * k; j += 1) aug[col][j] /= diag;
    for (let r = 0; r < k; r += 1) {
      if (r === col) continue;
      const factor = aug[r][col];
      if (factor === 0) continue;
      for (let j = 0; j < 2 * k; j += 1) aug[r][j] -= factor * aug[col][j];
    }
  }
  const inv = aug.map((row) => row.slice(k));
  const beta = new Array(k).fill(0);
  for (let i = 0; i < k; i += 1) {
    for (let j = 0; j < k; j += 1) beta[i] += inv[i][j] * xty[j];
  }
  return beta;
}

export function runADF(values: number[], maxLags = 4): ADFResult | null {
  const n = values.length;
  if (n < 12) return null;
  const lags = Math.max(0, Math.min(maxLags, Math.floor(Math.pow(n, 1 / 3))));

  /* Δy_t regressed on [1, y_{t-1}, Δy_{t-1}, ..., Δy_{t-lags}] */
  const y: number[] = [];
  const x: number[][] = [];
  for (let t = lags + 1; t < n; t += 1) {
    const row: number[] = [1, values[t - 1]];
    for (let l = 1; l <= lags; l += 1) row.push(values[t - l] - values[t - l - 1]);
    x.push(row);
    y.push(values[t] - values[t - 1]);
  }

  const beta = solveLeastSquares(x, y);
  if (!beta) return null;

  const m = y.length;
  const k = x[0].length;
  const yHat = x.map((row) => row.reduce((s, v, j) => s + v * beta[j], 0));
  let ssr = 0;
  for (let i = 0; i < m; i += 1) ssr += (y[i] - yHat[i]) ** 2;
  const df = m - k;
  const sigma2 = df > 0 ? ssr / df : 0;

  /* variance of gamma (coefficient index 1) via (X'X)^-1 diagonal */
  const xtx: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
  for (let i = 0; i < m; i += 1) {
    for (let a = 0; a < k; a += 1) {
      for (let b = 0; b < k; b += 1) xtx[a][b] += x[i][a] * x[i][b];
    }
  }
  const aug: number[][] = xtx.map((row, i) => [
    ...row,
    ...Array.from({ length: k }, (_, j) => (i === j ? 1 : 0)),
  ]);
  for (let col = 0; col < k; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < k; r += 1) {
      if (Math.abs(aug[r][col]) > Math.abs(aug[pivot][col])) pivot = r;
    }
    if (Math.abs(aug[pivot][col]) < 1e-12) return null;
    [aug[col], aug[pivot]] = [aug[pivot], aug[col]];
    const diag = aug[col][col];
    for (let j = 0; j < 2 * k; j += 1) aug[col][j] /= diag;
    for (let r = 0; r < k; r += 1) {
      if (r === col) continue;
      const factor = aug[r][col];
      if (factor === 0) continue;
      for (let j = 0; j < 2 * k; j += 1) aug[r][j] -= factor * aug[col][j];
    }
  }
  const varGamma = sigma2 * aug[1][k + 1];
  const seGamma = Math.sqrt(Math.max(varGamma, 0));
  const statistic = seGamma === 0 ? 0 : beta[1] / seGamma;

  const pValue = adfPValue(statistic, m);
  const criticalValues = adfCritical(m);
  const stationary = pValue < 0.05;
  const conclusion = stationary
    ? "Reject the unit-root null — the series is stationary (I(0))."
    : "Fail to reject the unit-root null — the series is non-stationary; difference before modelling.";

  return { statistic, pValue, lags, n: m, criticalValues, stationary, conclusion };
}

export interface ForecastPoint {
  step: number;
  forecast: number;
  lower: number;
  upper: number;
}

export interface ARIMAResult {
  order: { p: number; d: number; q: number };
  arCoefficients: number[];
  intercept: number;
  sigma2: number;
  aic: number;
  forecasts: ForecastPoint[];
  fitted: number[];
  residuals: number[];
  dw: number;
  n: number;
}

/* Fit AR(p) by OLS on a series: y_t = c + a1 y_{t-1} + ... + ap y_{t-p} */
function fitAR(series: number[], p: number): { ar: number[]; intercept: number; sigma2: number; fitted: number[]; residuals: number[] } | null {
  const n = series.length;
  if (n <= p + 1 || p < 1) return null;
  const y: number[] = [];
  const x: number[][] = [];
  for (let t = p; t < n; t += 1) {
    const row: number[] = [1];
    for (let l = 1; l <= p; l += 1) row.push(series[t - l]);
    x.push(row);
    y.push(series[t]);
  }
  const beta = solveLeastSquares(x, y);
  if (!beta) return null;
  const fitted = x.map((row) => row.reduce((s, v, j) => s + v * beta[j], 0));
  const residuals = y.map((value, i) => value - fitted[i]);
  const df = y.length - (p + 1);
  const sigma2 = df > 0 ? residuals.reduce((s, r) => s + r * r, 0) / df : 0;
  return { ar: beta.slice(1), intercept: beta[0], sigma2, fitted, residuals };
}

export function runARIMA(values: number[], horizon = 12): ARIMAResult | null {
  if (values.length < 16) return null;

  /* decide differencing order from the ADF test */
  const adf = runADF(values, 4);
  const d = adf && !adf.stationary ? 1 : 0;

  const working = d === 1 ? values.slice(1).map((v, i) => v - values[i]) : [...values];

  /* auto-select AR order 1..3 by AIC */
  let best: { p: number; fit: NonNullable<ReturnType<typeof fitAR>>; aic: number } | null = null;
  for (let p = 1; p <= 3; p += 1) {
    const fit = fitAR(working, p);
    if (!fit) continue;
    const m = working.length - p;
    const aic = m * Math.log(Math.max(fit.sigma2, 1e-12)) + 2 * (p + 1);
    if (!best || aic < best.aic) best = { p, fit, aic };
  }
  if (!best) return null;

  const { p, fit, aic } = best;
  const { ar, intercept, sigma2 } = fit;

  /* recursive h-step forecasts on the working scale */
  const history = [...working];
  const workingForecasts: number[] = [];
  for (let h = 0; h < horizon; h += 1) {
    let next = intercept;
    for (let l = 1; l <= p; l += 1) {
      const past = l <= history.length ? history[history.length - l] : history[0];
      next += ar[l - 1] * past;
    }
    workingForecasts.push(next);
    history.push(next);
  }

  /* integrate back to the original scale when differenced */
  const forecasts: ForecastPoint[] = [];
  let level = values[values.length - 1];
  const se = Math.sqrt(Math.max(sigma2, 0));
  for (let h = 0; h < horizon; h += 1) {
    const point = d === 1 ? level + workingForecasts[h] : workingForecasts[h];
    if (d === 1) level = point;
    const band = 1.96 * se * Math.sqrt(h + 1);
    forecasts.push({ step: h + 1, forecast: point, lower: point - band, upper: point + band });
  }

  /* fitted values on the original scale (naive integration for display) */
  const fitted = fit.fitted.map((v, i) => (d === 1 ? values[i] + v : v));
  const residuals = fit.residuals;
  const dw = durbinWatson(residuals);

  return {
    order: { p, d, q: 0 },
    arCoefficients: ar,
    intercept,
    sigma2,
    aic,
    forecasts,
    fitted,
    residuals,
    dw,
    n: values.length,
  };
}
