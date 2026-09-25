"use client";

import React, { useMemo, useState } from "react";
import { X, FileText, Download, Printer, Check, BookOpen } from "lucide-react";
import { useDataset } from "@/components/workspace/DatasetContext";
import { buildDesignMatrix, runOLS, runCronbach, runHausman, toNumber } from "@/lib/econometrics";
import { extractSeries, runADF, runARIMA } from "@/lib/timeseries";

export type ExportFormat = "word" | "print";

const MODAL_SHELL =
  "max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-900/15 bg-white/80 p-6 shadow-2xl backdrop-blur-xl sm:p-8";
const LABEL_CLASS = "text-[10px] font-bold uppercase tracking-widest text-slate-400";
const CARD_CLASS = "rounded-2xl border border-slate-900/15 bg-white/70 px-4 py-4 backdrop-blur-xl";

type Row = Record<string, unknown>;

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

const AMP = String.fromCharCode(38);
const LT = String.fromCharCode(60);
const GT = String.fromCharCode(62);
const QUOT = String.fromCharCode(34);

const esc = (text: string): string =>
  text
    .split("&").join(AMP + "amp;")
    .split(LT).join(AMP + "lt;")
    .split(GT).join(AMP + "gt;")
    .split(QUOT).join(AMP + "quot;");

const fmt = (n: number, digits = 3): string =>
  Number.isFinite(n) ? n.toFixed(digits) : "—";

const fmtP = (p: number): string => {
  if (!Number.isFinite(p)) return "—";
  if (p < 0.001) return "< .001";
  return p.toFixed(3);
};

export interface ChapterSections {
  title: string;
  author: string;
  institution: string;
  date: string;
  dataset: string;
  rows: number;
  columns: number;
  olsHtml: string;
  olsProse: string;
  cronbachHtml: string;
  cronbachProse: string;
  hausmanHtml: string;
  hausmanProse: string;
  adfHtml: string;
  adfProse: string;
  forecastHtml: string;
  forecastProse: string;
}

export function buildChapter(
  rows: Row[],
  fileName: string | null,
  meta: { title: string; author: string; institution: string }
): ChapterSections {
  const numeric = numericColumns(rows);
  const columns = rows.length > 0 ? Object.keys(rows[0] ?? {}) : [];
  const date = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  /* ---- OLS: first numeric as Y, next up to 3 as X ---- */
  let olsHtml = "<p>No regression could be estimated (need at least two numeric columns).</p>";
  let olsProse = "No regression was estimated.";
  if (numeric.length >= 2) {
    const yCol = numeric[0];
    const xCols = numeric.slice(1, 4);
    const design = buildDesignMatrix(rows, yCol, xCols);
    const result = design ? runOLS(design) : null;
    if (result) {
      const coefRows = result.coefficients
        .map(
          (c) =>
            `<tr><td>${esc(c.term)}</td><td>${fmt(c.beta, 4)}</td><td>${fmt(
              c.stdError,
              4
            )}</td><td>${fmt(c.tStat, 3)}</td><td>${fmtP(c.pValue)}</td></tr>`
        )
        .join("");
      olsHtml = `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
<thead><tr><th>Term</th><th>Coefficient</th><th>Std. Error</th><th>t</th><th>p</th></tr></thead>
<tbody>${coefRows}</tbody></table>
<p><em>Model:</em> R² = ${result.rSquared.toFixed(3)}, adjusted R² = ${result.adjRSquared.toFixed(
        3
      )}, F(${result.k - 1}, ${result.n - result.k}) = ${result.fStat.toFixed(
        3
      )}, p = ${fmtP(result.fPValue)}, n = ${result.n}.</p>`;
      const sig = result.coefficients.filter(
        (c) => c.term !== "(Intercept)" && c.significant
      );
      olsProse = `A multiple linear regression was estimated with ${esc(
        yCol
      )} as the dependent variable and ${xCols
        .map((c) => esc(c))
        .join(", ")} as predictors. The model explained ${(result.rSquared * 100).toFixed(
        1
      )}% of the variance (R² = ${result.rSquared.toFixed(3)}). ${
        sig.length > 0
          ? `Significant predictors were: ${sig
              .map((c) => `${esc(c.term)} (β = ${c.beta.toFixed(3)}, p = ${fmtP(c.pValue)})`)
              .join("; ")}.`
          : "No individual predictor reached significance at the .05 level."
      }`;
    }
  }

  /* ---- Cronbach: first up to 5 numeric items ---- */
  let cronbachHtml = "<p>Reliability analysis requires at least two numeric scale items.</p>";
  let cronbachProse = "No reliability analysis was performed.";
  if (numeric.length >= 2) {
    const items = numeric.slice(0, 5);
    const result = runCronbach({ rows, itemColumns: items });
    if (result) {
      const itemRows = result.itemVariances
        .map(
          (item, i) =>
            `<tr><td>${esc(item.item)}</td><td>${fmt(item.variance, 3)}</td><td>${fmt(
              item.totalCorrelation,
              3
            )}</td><td>${fmt(result.ifItemDeleted[i]?.alphaWithout ?? 0, 4)}</td></tr>`
        )
        .join("");
      cronbachHtml = `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
<thead><tr><th>Item</th><th>Variance</th><th>Item-total r</th><th>Alpha if deleted</th></tr></thead>
<tbody>${itemRows}</tbody></table>
<p><em>Reliability:</em> Cronbach's α = ${result.alpha.toFixed(3)} (${esc(
        result.interpretation
      )}), ${result.items} items, ${result.respondents} respondents.</p>`;
      cronbachProse = `Internal consistency was assessed with Cronbach's alpha across ${
        result.items
      } items (n = ${result.respondents}), yielding α = ${result.alpha.toFixed(3)}. ${
        result.interpretation
      }.`;
    }
  }

  /* ---- Hausman: first categorical as entity ---- */
  let hausmanHtml = "<p>Panel diagnostics require a grouping column and numeric regressors.</p>";
  let hausmanProse = "No panel specification test was performed.";
  const categorical = columns.filter((c) => !numeric.includes(c));
  if (categorical.length > 0 && numeric.length >= 2) {
    const result = runHausman({
      rows,
      yColumn: numeric[0],
      xColumns: numeric.slice(1, 3),
      entityColumn: categorical[0],
    });
    if (result) {
      const compRows = result.terms
        .map(
          (term, i) =>
            `<tr><td>${esc(term)}</td><td>${fmt(result.betaFE[i] ?? 0, 4)}</td><td>${fmt(
              result.betaRE[i] ?? 0,
              4
            )}</td></tr>`
        )
        .join("");
      hausmanHtml = `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
<thead><tr><th>Term</th><th>Fixed effects</th><th>Random effects</th></tr></thead>
<tbody>${compRows}</tbody></table>
<p><em>Hausman test:</em> χ²(${result.df}) = ${result.chiSquare.toFixed(3)}, p = ${fmtP(
        result.pValue
      )}. ${esc(result.conclusion)}</p>`;
      hausmanProse = `A Hausman specification test across ${result.groups} entities (N = ${
        result.n
      }) produced χ²(${result.df}) = ${result.chiSquare.toFixed(3)}, p = ${fmtP(
        result.pValue
      )}. ${result.conclusion}`;
    }
  }

  /* ---- ADF + ARIMA on the first numeric series ---- */
  let adfHtml = "<p>Stationarity testing requires a numeric series with at least 12 observations.</p>";
  let adfProse = "No stationarity test was performed.";
  let forecastHtml = "<p>Forecasting requires at least 16 observations.</p>";
  let forecastProse = "No forecast was produced.";
  if (numeric.length > 0) {
    const { values } = extractSeries(rows, numeric[0]);
    const adf = runADF(values, 4);
    if (adf) {
      adfHtml = `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
<thead><tr><th>Statistic</th><th>p-value</th><th>Lags</th><th>1% crit.</th><th>5% crit.</th><th>10% crit.</th></tr></thead>
<tbody><tr><td>${adf.statistic.toFixed(3)}</td><td>${fmtP(adf.pValue)}</td><td>${
        adf.lags
      }</td><td>${adf.criticalValues.one.toFixed(3)}</td><td>${adf.criticalValues.five.toFixed(
        3
      )}</td><td>${adf.criticalValues.ten.toFixed(3)}</td></tr></tbody></table>
<p>${esc(adf.conclusion)}</p>`;
      adfProse = `An Augmented Dickey-Fuller test on ${esc(
        numeric[0]
      )} (n = ${adf.n}, ${adf.lags} lags) returned a test statistic of ${adf.statistic.toFixed(
        3
      )} (p = ${fmtP(adf.pValue)}). ${adf.conclusion}`;
    }
    const arima = runARIMA(values, 8);
    if (arima) {
      const fcRows = arima.forecasts
        .map(
          (f) =>
            `<tr><td>${f.step}</td><td>${fmt(f.forecast, 3)}</td><td>${fmt(
              f.lower,
              3
            )}</td><td>${fmt(f.upper, 3)}</td></tr>`
        )
        .join("");
      forecastHtml = `<p><em>Model:</em> ARIMA(${arima.order.p},${arima.order.d},${arima.order.q}), AIC = ${arima.aic.toFixed(
        2
      )}, Durbin-Watson = ${arima.dw.toFixed(3)}.</p>
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
<thead><tr><th>Step</th><th>Forecast</th><th>Lower 95%</th><th>Upper 95%</th></tr></thead>
<tbody>${fcRows}</tbody></table>`;
      forecastProse = `An automated ARIMA(${arima.order.p},${arima.order.d},${arima.order.q}) model (AIC = ${arima.aic.toFixed(
        2
      )}) was fitted to ${esc(numeric[0])} and projected ${arima.forecasts.length} steps ahead with 95% intervals.`;
    }
  }

  return {
    title: meta.title,
    author: meta.author,
    institution: meta.institution,
    date,
    dataset: fileName ?? "dataset.csv",
    rows: rows.length,
    columns: columns.length,
    olsHtml,
    olsProse,
    cronbachHtml,
    cronbachProse,
    hausmanHtml,
    hausmanProse,
    adfHtml,
    adfProse,
    forecastHtml,
    forecastProse,
  };
}

export function chapterToHtml(sections: ChapterSections): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${esc(sections.title)}</title>
<style>
body{font-family:Georgia,'Times New Roman',serif;color:#0f172a;max-width:760px;margin:40px auto;padding:0 24px;line-height:1.7}
h1{font-size:26px;text-align:center;margin-bottom:4px}
h2{font-size:19px;margin-top:34px;border-bottom:2px solid #0f172a;padding-bottom:6px}
h3{font-size:15px;margin-top:22px}
.meta{text-align:center;color:#475569;font-size:13px;margin-bottom:30px}
table{font-size:13px;margin:12px 0}
th{background:#0f172a;color:#fff}
p{font-size:14px}
.footer{margin-top:40px;font-size:12px;color:#64748b;text-align:center;border-top:1px solid #cbd5e1;padding-top:12px}
</style></head><body>
<h1>${esc(sections.title)}</h1>
<div class="meta">${esc(sections.author)} · ${esc(sections.institution)} · ${esc(
    sections.date
  )}<br>Dataset: ${esc(sections.dataset)} · ${sections.rows.toLocaleString()} rows · ${
    sections.columns
  } columns · Generated by DataVerse AI</div>
<h2>4.1 Introduction</h2>
<p>This chapter presents the empirical results of the analysis conducted on the ${
    sections.columns
  }-variable dataset (${sections.rows.toLocaleString()} observations). The analyses cover multiple regression, scale reliability, panel specification, stationarity diagnostics and forecasting.</p>
<h2>4.2 Multiple Regression Results</h2>
${sections.olsHtml}
<h3>Interpretation</h3>
<p>${sections.olsProse}</p>
<h2>4.3 Reliability Analysis</h2>
${sections.cronbachHtml}
<h3>Interpretation</h3>
<p>${sections.cronbachProse}</p>
<h2>4.4 Panel Specification (Hausman Test)</h2>
${sections.hausmanHtml}
<h3>Interpretation</h3>
<p>${sections.hausmanProse}</p>
<h2>4.5 Stationarity Diagnostics (ADF)</h2>
${sections.adfHtml}
<h3>Interpretation</h3>
<p>${sections.adfProse}</p>
<h2>4.6 Forecasting (ARIMA)</h2>
${sections.forecastHtml}
<h3>Interpretation</h3>
<p>${sections.forecastProse}</p>
<h2>4.7 Summary of Findings</h2>
<p>${sections.olsProse} ${sections.cronbachProse} ${sections.hausmanProse} ${
    sections.adfProse
  } ${sections.forecastProse}</p>
<div class="footer">DataVerse AI · Automated Thesis Chapter Four · ${esc(sections.date)}</div>
</body></html>`;
}

/* UI_PLACEHOLDER */