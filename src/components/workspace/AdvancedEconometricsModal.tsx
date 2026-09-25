"use client";

import React, { useEffect, useMemo, useState } from "react";
import { X, Sigma, FlaskConical, ListChecks, Copy, Check, TrendingUp } from "lucide-react";
import { useDataset } from "@/components/workspace/DatasetContext";
import {
  buildDesignMatrix,
  runOLS,
  runHausman,
  runCronbach,
  toNumber,
  type OLSResult,
  type HausmanResult,
  type CronbachResult,
  type Row,
} from "@/lib/econometrics";

export type EconTab = "ols" | "hausman" | "cronbach";

const MODAL_SHELL =
  "max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-900/15 bg-white/80 p-6 shadow-2xl backdrop-blur-xl sm:p-8";
const CARD_CLASS = "rounded-2xl border border-slate-900/15 bg-white/70 px-4 py-4 backdrop-blur-xl";
const LABEL_CLASS = "text-[10px] font-bold uppercase tracking-widest text-slate-400";
const SELECT_CLASS =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition-colors focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10";

const isMissing = (value: unknown): boolean =>
  value === null || value === undefined || (typeof value === "string" && value.trim() === "");

const numericColumns = (rows: Row[]): string[] => {
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0] ?? {});
  return headers.filter((header) => {
    let hits = 0;
    let seen = 0;
    for (const row of rows.slice(0, 300)) {
      const value = row[header];
      if (isMissing(value)) continue;
      seen += 1;
      if (toNumber(value) !== null) hits += 1;
    }
    return seen > 0 && hits / seen >= 0.6;
  });
};

const fmt = (n: number, digits = 4): string => {
  if (!Number.isFinite(n)) return "—";
  if (n !== 0 && (Math.abs(n) >= 1e7 || Math.abs(n) < 1e-4)) return n.toExponential(3);
  return n.toFixed(digits);
};

const fmtP = (p: number): string => {
  if (!Number.isFinite(p)) return "—";
  if (p < 0.001) return "< 0.001";
  return p.toFixed(4);
};

const stars = (p: number): string => (p < 0.001 ? "***" : p < 0.01 ? "**" : p < 0.05 ? "*" : "");

const apaNumber = (n: number): string =>
  Math.abs(n) < 1
    ? n.toFixed(3).replace(/^(-?)0\./, "$1.").replace(/^-?\.?/, "")
    : n.toFixed(3);

interface AdvancedEconometricsModalProps {
  open: boolean;
  onClose: () => void;
  initialTab?: EconTab;
}

interface TabSpec {
  id: EconTab;
  label: string;
  Icon: React.ElementType;
}

const TABS: TabSpec[] = [
  { id: "ols", label: "OLS Regression", Icon: TrendingUp },
  { id: "hausman", label: "Hausman Test", Icon: FlaskConical },
  { id: "cronbach", label: "Cronbach's Alpha", Icon: ListChecks },
];

const TH_CLASS =
  "px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap";
const TD_CLASS = "px-3 py-2 font-semibold tabular-nums text-slate-800 whitespace-nowrap";
const STAT_CARD =
  "rounded-2xl border border-slate-900/15 bg-white/70 px-3 py-2.5 text-center backdrop-blur-xl";

const OlsPanel: React.FC<{ result: OLSResult }> = ({ result }) => {
  const metrics = [
    { label: "R-squared", value: result.rSquared.toFixed(4) },
    { label: "Adj. R-squared", value: result.adjRSquared.toFixed(4) },
    { label: "F-statistic", value: fmt(result.fStat, 3) },
    { label: "Prob (F)", value: fmtP(result.fPValue) },
    { label: "Observations", value: result.n.toLocaleString() },
    { label: "RMSE", value: fmt(result.rmse, 3) },
    { label: "Durbin-Watson", value: result.dw.toFixed(3) },
    { label: "Parameters", value: String(result.k) },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map((item) => (
          <div key={item.label} className={STAT_CARD}>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
              {item.label}
            </p>
            <p className="mt-1 text-sm font-bold tabular-nums text-slate-900">{item.value}</p>
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-900/15 bg-white/70 backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-900/10">
                <th className={TH_CLASS}>Term</th>
                <th className={TH_CLASS}>Coefficient</th>
                <th className={TH_CLASS}>Std. error</th>
                <th className={TH_CLASS}>t</th>
                <th className={TH_CLASS}>P-value</th>
                <th className={TH_CLASS}>95% CI</th>
              </tr>
            </thead>
            <tbody>
              {result.coefficients.map((c, i) => (
                <tr
                  key={`${c.term}-${i}`}
                  className={`border-b border-slate-900/[0.06] last:border-b-0 ${
                    i % 2 === 1 ? "bg-slate-900/[0.03]" : ""
                  }`}
                >
                  <td className={`${TD_CLASS} font-bold text-slate-900`}>{c.term}</td>
                  <td className={TD_CLASS}>
                    {fmt(c.beta, 4)} <span className="text-emerald-600">{stars(c.pValue)}</span>
                  </td>
                  <td className={TD_CLASS}>{fmt(c.stdError, 4)}</td>
                  <td className={TD_CLASS}>{fmt(c.tStat, 3)}</td>
                  <td
                    className={`${TD_CLASS} ${c.significant ? "text-emerald-700" : "text-slate-500"}`}
                  >
                    {fmtP(c.pValue)}
                  </td>
                  <td className={TD_CLASS}>
                    [{fmt(c.ciLow, 3)}, {fmt(c.ciHigh, 3)}]
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[11px] font-medium text-slate-400">
        Significance codes: *** 0.001 · ** 0.01 · * 0.05
      </p>
    </div>
  );
};

const HausmanPanel: React.FC<{ result: HausmanResult }> = ({ result }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[
        { label: "Chi-square", value: fmt(result.chiSquare, 3) },
        { label: "Degrees of freedom", value: String(result.df) },
        { label: "Prob (chi-sq)", value: fmtP(result.pValue) },
        { label: "Panel entities", value: result.groups.toLocaleString() },
      ].map((item) => (
        <div key={item.label} className={STAT_CARD}>
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
            {item.label}
          </p>
          <p className="mt-1 text-sm font-bold tabular-nums text-slate-900">{item.value}</p>
        </div>
      ))}
    </div>
    <div className="overflow-hidden rounded-2xl border border-slate-900/15 bg-white/70 backdrop-blur-xl">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-900/10">
              <th className={TH_CLASS}>Term</th>
              <th className={TH_CLASS}>Fixed effects</th>
              <th className={TH_CLASS}>Random effects</th>
              <th className={TH_CLASS}>Difference</th>
            </tr>
          </thead>
          <tbody>
            {result.terms.map((term, i) => (
              <tr
                key={`${term}-${i}`}
                className={`border-b border-slate-900/[0.06] last:border-b-0 ${
                  i % 2 === 1 ? "bg-slate-900/[0.03]" : ""
                }`}
              >
                <td className={`${TD_CLASS} font-bold text-slate-900`}>{term}</td>
                <td className={TD_CLASS}>{fmt(result.betaFE[i] ?? 0, 4)}</td>
                <td className={TD_CLASS}>{fmt(result.betaRE[i] ?? 0, 4)}</td>
                <td className={TD_CLASS}>
                  {fmt((result.betaFE[i] ?? 0) - (result.betaRE[i] ?? 0), 4)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    <p className="text-xs font-semibold text-slate-600">{result.conclusion}</p>
  </div>
);

const CronbachPanel: React.FC<{ result: CronbachResult }> = ({ result }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[
        { label: "Cronbach's alpha", value: result.alpha.toFixed(4) },
        { label: "Items", value: String(result.items) },
        { label: "Respondents", value: result.respondents.toLocaleString() },
        { label: "Avg inter-item r", value: result.averageInterItemCorrelation.toFixed(3) },
      ].map((item) => (
        <div key={item.label} className={STAT_CARD}>
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
            {item.label}
          </p>
          <p className="mt-1 text-sm font-bold tabular-nums text-slate-900">{item.value}</p>
        </div>
      ))}
    </div>
    <div className="overflow-hidden rounded-2xl border border-slate-900/15 bg-white/70 backdrop-blur-xl">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-900/10">
              <th className={TH_CLASS}>Item</th>
              <th className={TH_CLASS}>Variance</th>
              <th className={TH_CLASS}>Item-total r</th>
              <th className={TH_CLASS}>Alpha if deleted</th>
            </tr>
          </thead>
          <tbody>
            {result.itemVariances.map((item, i) => (
              <tr
                key={`${item.item}-${i}`}
                className={`border-b border-slate-900/[0.06] last:border-b-0 ${
                  i % 2 === 1 ? "bg-slate-900/[0.03]" : ""
                }`}
              >
                <td className={`${TD_CLASS} font-bold text-slate-900`}>{item.item}</td>
                <td className={TD_CLASS}>{fmt(item.variance, 3)}</td>
                <td
                  className={`${TD_CLASS} ${
                    item.totalCorrelation >= 0.3 ? "text-emerald-700" : "text-amber-600"
                  }`}
                >
                  {fmt(item.totalCorrelation, 3)}
                </td>
                <td className={TD_CLASS}>
                  {fmt(result.ifItemDeleted[i]?.alphaWithout ?? 0, 4)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    <p className="text-xs font-semibold text-slate-600">{result.interpretation}</p>
  </div>
);

export const AdvancedEconometricsModal: React.FC<AdvancedEconometricsModalProps> = ({
  open,
  onClose,
  initialTab = "ols",
}) => {
  const { data, rawData, activeSheet, activeSheetId } = useDataset();
  const [tab, setTab] = useState<EconTab>(initialTab);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [initialTab, open]);

  /* shared column discovery */
  // Econometric models are intentionally restricted to the active worksheet.
  const rows = useMemo<Row[]>(
    () => (activeSheet?.rawRows ?? rawData ?? data ?? []) as Row[],
    [activeSheet, data, rawData],
  );
  const activeSheetLabel = activeSheet?.name ?? "active worksheet";
  const numeric = useMemo(() => numericColumns(rows), [rows]);
  const allColumns = useMemo(
    () => (rows.length > 0 ? Object.keys(rows[0] ?? {}) : []),
    [rows]
  );
  const categoryColumns = useMemo(
    () => allColumns.filter((column) => !numeric.includes(column)),
    [allColumns, numeric]
  );

  /* OLS state */
  const [yColumn, setYColumn] = useState("");
  const [xColumns, setXColumns] = useState<string[]>([]);
  /* Hausman state */
  const [entityColumn, setEntityColumn] = useState("");
  /* Cronbach state */
  const [itemColumns, setItemColumns] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setYColumn("");
    setXColumns([]);
    setEntityColumn("");
    setItemColumns([]);
  }, [activeSheetId, open]);

  const activeY = yColumn || numeric[0] || "";
  const activeEntity = entityColumn || categoryColumns[0] || "";
  const activeItems = itemColumns.length > 0 ? itemColumns : numeric.slice(0, 3);

  const ols = useMemo<OLSResult | null>(() => {
    if (tab !== "ols" || !open || !activeY || xColumns.length === 0) return null;
    const design = buildDesignMatrix(rows, activeY, xColumns);
    if (!design) return null;
    try {
      return runOLS(design);
    } catch {
      return null;
    }
  }, [tab, open, rows, activeY, xColumns]);

  const hausman = useMemo<HausmanResult | null>(() => {
    if (tab !== "hausman" || !open || !activeY || !activeEntity || xColumns.length === 0) return null;
    try {
      return runHausman({ rows, yColumn: activeY, xColumns, entityColumn: activeEntity });
    } catch {
      return null;
    }
  }, [tab, open, rows, activeY, activeEntity, xColumns]);

  const cronbach = useMemo<CronbachResult | null>(() => {
    if (tab !== "cronbach" || !open || activeItems.length < 2) return null;
    try {
      return runCronbach({ rows, itemColumns: activeItems });
    } catch {
      return null;
    }
  }, [tab, open, rows, activeItems]);

  const interpretation = useMemo<string>(() => {
    if (tab === "ols" && ols) {
      const sig = ols.coefficients.filter((c) => c.term !== "(Intercept)" && c.significant);
      const parts = sig.map(
        (c) => `${c.term} (beta = ${apaNumber(c.beta)}, t = ${apaNumber(c.tStat)}, p = ${fmtP(c.pValue)})`
      );
      const model = `The regression model was statistically significant, F(${ols.k - 1}, ${
        ols.n - ols.k
      }) = ${apaNumber(ols.fStat)}, p = ${fmtP(ols.fPValue)}, and explained ${(
        ols.rSquared * 100
      ).toFixed(1)}% of the variance in ${ols.yName} (R-squared = ${ols.rSquared.toFixed(
        3
      )}, adjusted R-squared = ${ols.adjRSquared.toFixed(3)}).`;
      return sig.length > 0
        ? `${model} Significant predictors: ${parts.join("; ")}.`
        : `${model} No individual predictor reached statistical significance at the .05 level.`;
    }
    if (tab === "hausman" && hausman) {
      return `A Hausman specification test was conducted across ${hausman.groups} panel entities (N = ${
        hausman.n
      }). The test statistic was chi-square(${hausman.df}) = ${apaNumber(
        hausman.chiSquare
      )}, p = ${fmtP(hausman.pValue)}. ${hausman.conclusion}`;
    }
    if (tab === "cronbach" && cronbach) {
      return `Cronbach's alpha was computed for ${cronbach.items} scale items across ${
        cronbach.respondents
      } complete responses, yielding alpha = ${cronbach.alpha.toFixed(
        3
      )} (average inter-item correlation = ${cronbach.averageInterItemCorrelation.toFixed(
        3
      )}). ${cronbach.interpretation}.`;
    }
    return "";
  }, [tab, ols, hausman, cronbach]);

  const handleCopy = () => {
    if (!interpretation || typeof navigator === "undefined" || !navigator.clipboard?.writeText)
      return;
    navigator.clipboard
      .writeText(interpretation)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => undefined);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8 backdrop-blur-sm">
      <div className={MODAL_SHELL}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className={LABEL_CLASS}>Advanced Econometrics</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              Econometric & statistical suite
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              OLS regression, panel diagnostics and reliability analysis on {activeSheetLabel} only.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close econometrics"
            className="rounded-xl border border-slate-900/15 bg-white p-2 text-slate-500 transition-colors hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-5 inline-flex flex-wrap items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
                tab === id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <div className={`${CARD_CLASS} mb-5`}>
          {tab === "ols" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="econ-y" className={`${LABEL_CLASS} mb-1 block`}>
                  Dependent variable (Y)
                </label>
                <select
                  id="econ-y"
                  className={SELECT_CLASS}
                  value={activeY}
                  onChange={(event) => setYColumn(event.target.value)}
                >
                  {numeric.map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className={`${LABEL_CLASS} mb-1`}>Independent variables (X)</p>
                <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
                  {numeric
                    .filter((column) => column !== activeY)
                    .map((column) => {
                      const isOn = xColumns.includes(column);
                      return (
                        <button
                          key={column}
                          onClick={() =>
                            setXColumns((current) =>
                              isOn
                                ? current.filter((c) => c !== column)
                                : [...current, column]
                            )
                          }
                          aria-pressed={isOn}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors ${
                            isOn
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-900/40"
                          }`}
                        >
                          {column}
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {tab === "hausman" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="econ-entity" className={`${LABEL_CLASS} mb-1 block`}>
                  Panel entity (group)
                </label>
                <select
                  id="econ-entity"
                  className={SELECT_CLASS}
                  value={activeEntity}
                  onChange={(event) => setEntityColumn(event.target.value)}
                >
                  {categoryColumns.map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="econ-hy" className={`${LABEL_CLASS} mb-1 block`}>
                  Dependent variable (Y)
                </label>
                <select
                  id="econ-hy"
                  className={SELECT_CLASS}
                  value={activeY}
                  onChange={(event) => setYColumn(event.target.value)}
                >
                  {numeric.map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className={`${LABEL_CLASS} mb-1`}>Regressors (X)</p>
                <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
                  {numeric
                    .filter((column) => column !== activeY)
                    .map((column) => {
                      const isOn = xColumns.includes(column);
                      return (
                        <button
                          key={column}
                          onClick={() =>
                            setXColumns((current) =>
                              isOn
                                ? current.filter((c) => c !== column)
                                : [...current, column]
                            )
                          }
                          aria-pressed={isOn}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors ${
                            isOn
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-900/40"
                          }`}
                        >
                          {column}
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {tab === "cronbach" && (
            <div>
              <p className={`${LABEL_CLASS} mb-1`}>Scale items (Likert questions)</p>
              <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
                {numeric.map((column) => {
                  const isOn = activeItems.includes(column);
                  return (
                    <button
                      key={column}
                      onClick={() =>
                        setItemColumns((current) =>
                          isOn
                            ? current.filter((c) => c !== column)
                            : [...current, column]
                        )
                      }
                      aria-pressed={isOn}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors ${
                        isOn
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-900/40"
                      }`}
                    >
                      {column}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {ols && tab === "ols" ? <OlsPanel result={ols} /> : null}
        {hausman && tab === "hausman" ? <HausmanPanel result={hausman} /> : null}
        {cronbach && tab === "cronbach" ? <CronbachPanel result={cronbach} /> : null}

        {((tab === "ols" && !ols) || (tab === "hausman" && !hausman) || (tab === "cronbach" && !cronbach)) && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-8 text-center backdrop-blur-xl">
            <Sigma className="mx-auto h-5 w-5 text-slate-300" />
            <p className="mt-2 text-sm font-bold text-slate-700">Select variables to run the analysis</p>
            <p className="mt-1 text-xs font-medium text-slate-400">
              {tab === "ols" && "Pick a dependent variable and at least one independent variable."}
              {tab === "hausman" && "Pick a panel entity, a dependent variable and at least one regressor."}
              {tab === "cronbach" && "Pick at least two scale items to test reliability."}
            </p>
          </div>
        )}

        {interpretation && (
          <div className="mt-5 rounded-2xl border border-slate-900/15 bg-white/70 px-4 py-4 backdrop-blur-xl">
            <div className="mb-2 flex items-center justify-between">
              <p className={LABEL_CLASS}>APA-style interpretation</p>
              <button
                onClick={handleCopy}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                  copied
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy results"}
              </button>
            </div>
            <p className="text-sm font-medium leading-relaxed text-slate-700">{interpretation}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdvancedEconometricsModal;
