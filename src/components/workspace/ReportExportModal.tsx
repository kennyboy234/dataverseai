"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  BriefcaseBusiness,
  Check,
  ClipboardCopy,
  Copy,
  Database,
  FileDown,
  FileText,
  FileType2,
  GraduationCap,
  LoaderCircle,
  Presentation,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  X,
} from "lucide-react";
import { buildChapter, type ChapterSections } from "@/components/workspace/ExportChapterModal";
import {
  runAutonomousAudit,
  toAuditNumber,
  type AuditEngineReport,
} from "@/lib/auditEngine";
import { runARIMA } from "@/lib/timeseries";
import {
  academicReportToMarkdown,
  copyTextToClipboard,
  createAcademicDocxBlob,
  createExecutivePdfBlob,
  downloadBlob,
  downloadExecutivePptx,
  executiveReportToPlainText,
  slugifyFileName,
  type AcademicReportModel,
  type AcademicReportSection,
  type CashFlowForecast,
  type ExecutiveReportModel,
  type ReportMode,
  type ReportTable,
} from "@/lib/reportExport";

type ReportRow = Record<string, unknown>;

export interface ReportExportModalProps {
  open: boolean;
  onClose: () => void;
  data: ReportRow[];
  fileName: string | null;
  activeFilter: string | null;
  initialMode?: ReportMode;
}

interface AcademicMetadata {
  title: string;
  author: string;
  institution: string;
}

interface ExecutiveMetadata {
  title: string;
  preparedFor: string;
}

type ExportAction = "docx" | "markdown" | "copy-academic" | "pdf" | "pptx" | "copy-executive";

const MODAL_SHELL =
  "flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-slate-900/15 bg-white/80 shadow-2xl backdrop-blur-xl";
const LABEL_CLASS = "text-[10px] font-bold uppercase tracking-widest text-slate-400";
const INPUT_CLASS =
  "w-full rounded-xl border border-slate-900/15 bg-white/85 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition-colors placeholder:font-medium placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10";
const PRIMARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-slate-800 active:translate-y-0 disabled:pointer-events-none disabled:opacity-45";
const SECONDARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-900/15 bg-white/80 px-4 py-2.5 text-sm font-bold text-slate-700 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-slate-900/40 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-45";
const REPORT_CARD = "rounded-2xl border border-slate-900/15 bg-white/75 p-4 backdrop-blur-xl";
const ACADEMIC_ROW_CLASS = "border-b border-slate-900/10";

const todayInputValue = (): string => new Date().toISOString().slice(0, 10);

const displayDate = (value: string): string => {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
};

const datasetLabel = (fileName: string | null): string => {
  if (!fileName) return "Active workspace dataset";
  return fileName.replace(/\.[a-z0-9]+$/i, "") || fileName;
};

const stripHtml = (value: string): string =>
  value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#[0-9]+;/g, "")
    .replace(/&[a-z]+;/gi, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const parseHtmlTable = (html: string): { headers: string[]; rows: string[][] } => {
  const matrix = Array.from(html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi))
    .map((rowMatch) =>
      Array.from(rowMatch[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)).map((cellMatch) =>
        stripHtml(cellMatch[1])
      )
    )
    .filter((row) => row.length > 0);
  if (matrix.length === 0) return { headers: [], rows: [] };
  return { headers: matrix[0], rows: matrix.slice(1) };
};

const makeReportTable = (
  html: string,
  number: number,
  title: string,
  note: string
): ReportTable | undefined => {
  const parsed = parseHtmlTable(html);
  if (parsed.headers.length === 0) return undefined;
  return { number, title, note, ...parsed };
};

const academicSections = (chapter: ChapterSections): AcademicReportSection[] => {
  const regression = makeReportTable(
    chapter.olsHtml,
    1,
    "Multiple Regression Coefficients",
    "Beta is the unstandardized coefficient; SE is the standard error; t is the t statistic. * p < .05. ** p < .01. *** p < .001."
  );
  const reliability = makeReportTable(
    chapter.cronbachHtml,
    2,
    "Internal Consistency of Scale Items",
    "Higher corrected item-total correlations and alpha values indicate stronger internal consistency."
  );
  const hausman = makeReportTable(
    chapter.hausmanHtml,
    3,
    "Fixed-Effects and Random-Effects Coefficient Comparison",
    "The Hausman statistic evaluates consistency between the fixed-effects and random-effects specifications."
  );
  const adf = makeReportTable(
    chapter.adfHtml,
    4,
    "Augmented Dickey-Fuller Stationarity Diagnostic",
    "Critical values and the p-value are reported for the selected constant specification."
  );
  const forecast = makeReportTable(
    chapter.forecastHtml,
    5,
    "Automated Time-Series Forecast",
    "Forecasts include approximate 95% prediction intervals and should be validated against the intended horizon."
  );

  return [
    {
      number: "4.1",
      title: "Research Design and Analysis",
      paragraphs: [
        `This chapter presents deterministic empirical analysis of ${chapter.dataset}. The active workspace contains ${chapter.rows.toLocaleString()} rows and ${chapter.columns.toLocaleString()} variables.`,
        "The generated results are designed to support reproducible reporting. They should be interpreted alongside the study design, variable definitions, and source-data validation.",
      ],
    },
    {
      number: "4.2",
      title: "Multiple Regression Results",
      paragraphs: [chapter.olsProse],
      table: regression,
    },
    {
      number: "4.3",
      title: "Reliability Analysis",
      paragraphs: [chapter.cronbachProse],
      table: reliability,
    },
    {
      number: "4.4",
      title: "Panel Specification",
      paragraphs: [chapter.hausmanProse],
      table: hausman,
    },
    {
      number: "4.5",
      title: "Stationarity Diagnostics",
      paragraphs: [chapter.adfProse],
      table: adf,
    },
    {
      number: "4.6",
      title: "Forecasting Results",
      paragraphs: [chapter.forecastProse],
      table: forecast,
    },
    {
      number: "4.7",
      title: "Summary of Findings",
      paragraphs: [
        `The analysis synthesizes regression, reliability, panel specification, stationarity, and forecasting evidence. ${chapter.olsProse} ${chapter.cronbachProse}`,
        `${chapter.hausmanProse} ${chapter.adfProse} ${chapter.forecastProse}`,
      ],
    },
  ];
};

const buildCashForecast = (
  audit: AuditEngineReport,
  rows: ReportRow[]
): CashFlowForecast | null => {
  const preferredPattern = /cash|flow|liquidity|revenue|income|balance/i;
  const column =
    audit.financialColumns.find((candidate) => preferredPattern.test(candidate)) ??
    audit.financialColumns[0] ??
    audit.numericColumns[0];
  if (!column) return null;

  const values = rows
    .map((row) => toAuditNumber(row[column]))
    .filter((value): value is number => value !== null);
  if (values.length < 16) return null;

  try {
    const result = runARIMA(values, 8);
    if (!result || result.forecasts.length === 0) return null;
    const next = result.forecasts[0];
    const reference = values[values.length - 1];
    const difference = next.forecast - reference;
    const threshold = Math.max(Math.abs(reference) * 0.01, 1e-9);
    return {
      column,
      model: `ARIMA(${result.order.p},${result.order.d},${result.order.q})`,
      aic: result.aic,
      nextForecast: next.forecast,
      lower: next.lower,
      upper: next.upper,
      direction: difference > threshold ? "upward" : difference < -threshold ? "downward" : "stable",
      points: result.forecasts.map((point) => ({
        step: point.step,
        forecast: point.forecast,
        lower: point.lower,
        upper: point.upper,
      })),
    };
  } catch {
    return null;
  }
};

const buildExecutiveReport = (
  audit: AuditEngineReport,
  forecast: CashFlowForecast | null,
  metadata: ExecutiveMetadata,
  date: string,
  fileName: string | null,
  totalRows: number,
  activeFilter: string | null
): ExecutiveReportModel => {
  const findings = audit.findings.slice(0, 5).map((finding) => ({
    title: finding.title,
    detail: finding.detail,
    recommendation: finding.recommendation,
    severity: finding.severity,
  }));
  const anomalies = audit.financialAnomalies.slice(0, 6).map((anomaly) => ({
    column: anomaly.column,
    score: anomaly.anomalyScore,
    riskLevel: anomaly.riskLevel,
    outliers: anomaly.outlierCount,
    missing: anomaly.missingCount + anomaly.invalidCount,
    negative: anomaly.negativeCount,
  }));
  const posture =
    audit.auditStatus === "escalate"
      ? "Immediate executive review is recommended"
      : audit.auditStatus === "review"
        ? "A targeted management review is recommended"
        : "No material escalation is currently indicated";
  const forecastText = forecast
    ? ` The ${forecast.column} model projects a next-period value of ${forecast.nextForecast.toFixed(2)} with a 95% interval of ${forecast.lower.toFixed(2)} to ${forecast.upper.toFixed(2)}.`
    : " A defensible cash-flow projection was not available from the active series.";
  const summary = `${posture}. The autonomous scan produced a composite risk score of ${audit.riskScore.toFixed(0)}/100 and a compliance score of ${audit.complianceScore.toFixed(0)}/100 across ${audit.scannedRows.toLocaleString()} scanned rows. ${findings.length} priority findings and ${anomalies.length} anomaly measures are surfaced for review.${forecastText}`;
  const actions = findings
    .map((finding) => finding.recommendation)
    .filter((action, index, list) => list.indexOf(action) === index)
    .slice(0, 3);
  if (forecast) {
    actions.push(
      `Plan liquidity against the ${forecast.model} ${forecast.direction} outlook and refresh the projection as new periods arrive.`
    );
  } else {
    actions.push("Add a chronologically ordered cash-flow series with at least 16 valid observations to enable projection reporting.");
  }
  actions.push(
    audit.truncated
      ? "Review rows beyond the bounded scan before using the briefing for a final decision."
      : "Retain the source snapshot, audit timestamp, and approved remediation evidence with this briefing."
  );

  return {
    title: metadata.title.trim() || `${datasetLabel(fileName)} Executive Briefing`,
    preparedFor: metadata.preparedFor.trim() || "Executive leadership",
    date: displayDate(date),
    dataset: fileName ?? "Active workspace dataset",
    generatedAt: audit.generatedAt,
    totalRows,
    scannedRows: audit.scannedRows,
    columnCount: audit.columnCount,
    activeFilter,
    complianceScore: audit.complianceScore,
    riskScore: audit.riskScore,
    riskLevel: audit.riskLevel,
    auditStatus: audit.auditStatus,
    coverage: audit.coverage,
    summary,
    findings,
    anomalies,
    forecast,
    actions,
  };
};

const AcademicPreview: React.FC<{ report: AcademicReportModel }> = ({ report }) => (
  <article className="mx-auto max-w-4xl rounded-sm border border-slate-200 bg-white px-6 py-10 text-slate-900 shadow-xl sm:px-12 sm:py-14">
    <header className="border-b-2 border-slate-900 pb-8 text-center">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Chapter Four</p>
      <h3 className="mt-3 font-serif text-2xl font-bold leading-tight sm:text-3xl">{report.title}</h3>
      <p className="mt-5 text-sm text-slate-600">{report.author || "Author not specified"}</p>
      <p className="text-sm text-slate-600">{report.institution || "Institution not specified"}</p>
      <p className="mt-1 text-sm text-slate-600">{report.date}</p>
    </header>

    <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-sans text-xs leading-relaxed text-slate-600">
      <strong>Publication note.</strong> Tables and prose are generated from the active workspace. Verify
      assumptions, variable selection, and source records before publication.
    </div>

    <div className="mt-9 space-y-10 font-serif">
      {report.sections.map((section) => (
        <section key={section.number}>
          <h4 className="text-lg font-bold text-slate-900">
            {section.number} {section.title}
          </h4>
          <div className="mt-4 space-y-4 text-[13px] leading-7 text-slate-800">
            {section.paragraphs.map((paragraph, index) => (
              <p key={`${section.number}-${index}`} className="indent-8">
                {paragraph}
              </p>
            ))}
          </div>
          {section.table && (
            <div className="mt-6 overflow-x-auto font-sans">
              <p className="text-sm font-bold text-slate-900">Table {section.table.number}</p>
              <p className="mt-1 text-xs font-semibold italic text-slate-800">{section.table.title}</p>
              <table className="mt-3 w-full border-collapse text-left text-[11px]">
                <thead>
                  <tr className="border-y-2 border-slate-900">
                    {section.table.headers.map((header) => (
                      <th key={header} className="px-2 py-2 font-bold text-slate-900">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.table.rows.map((row, rowIndex) => (
                    <tr
                      key={`${section.table?.number}-${rowIndex}`}
                      className={`${ACADEMIC_ROW_CLASS} ${rowIndex % 2 === 1 ? "bg-slate-50" : ""}`}
                    >
                      {section.table?.headers.map((_, cellIndex) => (
                        <td key={cellIndex} className="px-2 py-2 font-medium text-slate-700">
                          {row[cellIndex] ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[10px] leading-relaxed text-slate-600">
                <em>Note.</em> {section.table.note}
              </p>
            </div>
          )}
        </section>
      ))}
    </div>

    <footer className="mt-12 border-t border-slate-300 pt-4 text-center font-sans text-[10px] text-slate-500">
      {report.dataset} · {report.analyzedRows.toLocaleString()} of {report.totalRows.toLocaleString()} rows
      analyzed{report.activeFilter ? ` · Filter: ${report.activeFilter}` : ""}
    </footer>
  </article>
);

const ExecutivePreview: React.FC<{ report: ExecutiveReportModel }> = ({ report }) => {
  const riskTone =
    report.riskScore >= 50 ? "text-rose-300" : report.riskScore >= 25 ? "text-amber-300" : "text-emerald-300";
  return (
    <article className="overflow-hidden rounded-sm border border-slate-200 bg-white shadow-xl">
      <header className="bg-slate-900 px-6 py-8 text-white sm:px-10 sm:py-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Executive memo</p>
        <h3 className="mt-3 max-w-3xl text-2xl font-bold leading-tight sm:text-3xl">{report.title}</h3>
        <p className="mt-4 text-sm text-slate-300">
          Prepared for {report.preparedFor} · {report.date}
        </p>
        <p className="mt-1 text-xs text-slate-400">{report.dataset}</p>
      </header>

      <div className="px-6 py-7 sm:px-10 sm:py-9">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["Compliance", `${report.complianceScore.toFixed(0)}/100`],
            ["Risk", `${report.riskScore.toFixed(0)}/100`],
            ["Risk level", report.riskLevel],
            ["Coverage", `${report.coverage.toFixed(0)}%`],
          ].map(([label, value], index) => (
            <div key={label} className="rounded-2xl border border-slate-900/10 bg-slate-50 p-4">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
              <p className={`mt-2 text-xl font-bold ${index === 1 ? riskTone : "text-slate-900"}`}>{value}</p>
            </div>
          ))}
        </div>

        <section className="mt-7">
          <p className={LABEL_CLASS}>Executive summary</p>
          <p className="mt-3 text-sm font-medium leading-7 text-slate-700">{report.summary}</p>
        </section>

        <section className="mt-8">
          <div className="flex items-center justify-between gap-3">
            <p className={LABEL_CLASS}>Priority findings</p>
            <span className="rounded-lg border border-slate-900/10 bg-slate-50 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-slate-500">
              {report.findings.length} items
            </span>
          </div>
          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-900/10">
            {report.findings.length === 0 ? (
              <p className="bg-emerald-50 px-4 py-4 text-sm font-semibold text-emerald-700">
                No material forensic findings were raised.
              </p>
            ) : (
              report.findings.map((finding, index) => (
                <div
                  key={`${finding.title}-${index}`}
                  className={`flex gap-3 border-b border-slate-900/[0.07] px-4 py-3 last:border-b-0 ${
                    index % 2 === 1 ? "bg-slate-900/[0.035]" : "bg-white"
                  }`}
                >
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {finding.title}{" "}
                      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                        {finding.severity}
                      </span>
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{finding.detail}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-900/10 bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-slate-400" />
              <p className={LABEL_CLASS}>Cash-flow outlook</p>
            </div>
            {report.forecast ? (
              <>
                <p className="mt-4 text-2xl font-bold text-slate-900">
                  {report.forecast.nextForecast.toFixed(2)}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {report.forecast.column} · {report.forecast.model} · {report.forecast.direction}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  95% interval {report.forecast.lower.toFixed(2)} to {report.forecast.upper.toFixed(2)}
                </p>
                <div className="mt-4 space-y-2">
                  {report.forecast.points.slice(0, 4).map((point) => (
                    <div key={point.step} className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-500">H+{point.step}</span>
                      <span className="font-bold tabular-nums text-slate-800">{point.forecast.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm font-medium leading-relaxed text-slate-500">
                Add an ordered cash-flow series with at least 16 valid observations to generate a projection.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-900/10 bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-slate-400" />
              <p className={LABEL_CLASS}>Anomaly watchlist</p>
            </div>
            {report.anomalies.length === 0 ? (
              <p className="mt-4 text-sm font-medium text-emerald-700">No anomaly measures were identified.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {report.anomalies.slice(0, 5).map((anomaly) => (
                  <div key={anomaly.column} className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate font-bold text-slate-700">{anomaly.column}</span>
                    <span className="shrink-0 font-bold tabular-nums text-slate-900">
                      {anomaly.score.toFixed(0)}/100
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mt-8">
          <p className={LABEL_CLASS}>Slide-ready action outline</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {report.actions.map((action, index) => (
              <div
                key={action}
                className={`flex gap-3 rounded-xl border border-slate-900/10 px-3 py-3 ${
                  index % 2 === 1 ? "bg-slate-900/[0.035]" : "bg-white"
                }`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-[10px] font-bold text-white">
                  {index + 1}
                </span>
                <p className="text-xs font-semibold leading-relaxed text-slate-700">{action}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-center justify-between gap-3">
            <p className={LABEL_CLASS}>C-suite slide outline</p>
            <span className="rounded-lg border border-slate-900/10 bg-slate-50 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-slate-500">
              5-slide narrative
            </span>
          </div>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              {
                number: "01",
                title: "Opening",
                detail: "Decision context, audience, and active data snapshot.",
              },
              {
                number: "02",
                title: "Executive signal",
                detail: `${report.complianceScore.toFixed(0)}/100 compliance · ${report.riskScore.toFixed(0)}/100 risk · ${report.coverage.toFixed(0)}% coverage.`,
              },
              {
                number: "03",
                title: "Priority findings",
                detail: `${report.findings.length} leadership findings with ${report.anomalies.length} anomaly measures.`,
              },
              {
                number: "04",
                title: "Cash-flow outlook",
                detail: report.forecast
                  ? `${report.forecast.column} · ${report.forecast.model} · ${report.forecast.direction} next-period signal.`
                  : "Projection unavailable; identify the required ordered time series.",
              },
              {
                number: "05",
                title: "Recommended actions",
                detail: `${report.actions.length} prioritized next steps for accountable owners.`,
              },
            ].map((slide) => (
              <li
                key={slide.number}
                className="flex gap-3 rounded-xl border border-slate-900/10 bg-white/75 px-3 py-3"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-slate-900/15 bg-slate-900/[0.05] text-[9px] font-bold tabular-nums text-slate-600">
                  {slide.number}
                </span>
                <div>
                  <p className="text-xs font-bold text-slate-900">{slide.title}</p>
                  <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500">{slide.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <footer className="border-t border-slate-900/10 bg-slate-50 px-6 py-4 text-center text-[10px] font-semibold text-slate-400 sm:px-10">
        Decision-support summary only · {report.scannedRows.toLocaleString()} of {report.totalRows.toLocaleString()} rows scanned
      </footer>
    </article>
  );
};

export const ReportExportModal: React.FC<ReportExportModalProps> = ({
  open,
  onClose,
  data,
  fileName,
  activeFilter,
  initialMode = "academic",
}) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [mode, setMode] = useState<ReportMode>(initialMode);
  const [reportDate, setReportDate] = useState(todayInputValue);
  const [academicMetadata, setAcademicMetadata] = useState<AcademicMetadata>({
    title: `Empirical Analysis of ${datasetLabel(fileName)}`,
    author: "",
    institution: "",
  });
  const [executiveMetadata, setExecutiveMetadata] = useState<ExecutiveMetadata>({
    title: `${datasetLabel(fileName)} Executive Financial Briefing`,
    preparedFor: "Executive leadership",
  });
  const [exporting, setExporting] = useState<ExportAction | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  const rows = useMemo(() => (Array.isArray(data) ? (data as ReportRow[]) : []), [data]);
  const analysisRows = useMemo(() => rows.slice(0, 20_000), [rows]);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setReportDate(todayInputValue());
    setAcademicMetadata({
      title: `Empirical Analysis of ${datasetLabel(fileName)}`,
      author: "",
      institution: "",
    });
    setExecutiveMetadata({
      title: `${datasetLabel(fileName)} Executive Financial Briefing`,
      preparedFor: "Executive leadership",
    });
    setExporting(null);
    setFeedback(null);
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [fileName, initialMode, open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [onClose, open]);

  const chapter = useMemo(
    () =>
      open && analysisRows.length > 0
        ? buildChapter(analysisRows, fileName, {
            title: academicMetadata.title,
            author: academicMetadata.author,
            institution: academicMetadata.institution,
          })
        : null,
    [
      academicMetadata.author,
      academicMetadata.institution,
      academicMetadata.title,
      analysisRows,
      fileName,
      open,
    ]
  );

  const academicReport = useMemo<AcademicReportModel | null>(() => {
    if (!chapter) return null;
    return {
      title: academicMetadata.title.trim() || `Empirical Analysis of ${datasetLabel(fileName)}`,
      author: academicMetadata.author.trim(),
      institution: academicMetadata.institution.trim(),
      date: displayDate(reportDate),
      dataset: fileName ?? "Active workspace dataset",
      totalRows: rows.length,
      analyzedRows: analysisRows.length,
      columnCount: chapter.columns,
      activeFilter,
      sections: academicSections(chapter),
      summary: `${chapter.olsProse} ${chapter.cronbachProse}`,
    };
  }, [academicMetadata, analysisRows.length, chapter, fileName, reportDate, rows.length, activeFilter]);

  const audit = useMemo(
    () =>
      open && rows.length > 0
        ? runAutonomousAudit(rows.slice(0, 50_000), {
            maxRows: 50_000,
            varianceThreshold: 0.1,
          })
        : null,
    [open, rows]
  );
  const cashForecast = useMemo(
    () => (audit ? buildCashForecast(audit, analysisRows) : null),
    [analysisRows, audit]
  );
  const executiveReport = useMemo<ExecutiveReportModel | null>(
    () =>
      audit
        ? buildExecutiveReport(
            audit,
            cashForecast,
            executiveMetadata,
            reportDate,
            fileName,
            rows.length,
            activeFilter
          )
        : null,
    [audit, activeFilter, cashForecast, executiveMetadata, fileName, reportDate, rows.length]
  );

  const reportBaseName = slugifyFileName(
    mode === "academic"
      ? academicReport?.title ?? datasetLabel(fileName)
      : executiveReport?.title ?? datasetLabel(fileName)
  );

  const performExport = async (action: ExportAction, task: () => void | Promise<void>) => {
    setExporting(action);
    setFeedback(null);
    try {
      await task();
      setFeedback({ tone: "success", message: "Export completed successfully." });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "The report could not be exported.",
      });
    } finally {
      setExporting(null);
    }
  };

  const handleAcademicDocx = () =>
    performExport("docx", () => {
      if (!academicReport) throw new Error("Academic results are not ready yet.");
      downloadBlob(createAcademicDocxBlob(academicReport), `${reportBaseName}-chapter-four.docx`);
    });

  const handleAcademicMarkdown = () =>
    performExport("markdown", () => {
      if (!academicReport) throw new Error("Academic results are not ready yet.");
      const markdown = academicReportToMarkdown(academicReport);
      downloadBlob(
        new Blob([markdown], { type: "text/markdown;charset=utf-8" }),
        `${reportBaseName}-chapter-four.md`
      );
    });

  const handleAcademicCopy = () =>
    performExport("copy-academic", async () => {
      if (!academicReport) throw new Error("Academic results are not ready yet.");
      await copyTextToClipboard(academicReportToMarkdown(academicReport));
    });

  const handleExecutivePdf = () =>
    performExport("pdf", () => {
      if (!executiveReport) throw new Error("Executive results are not ready yet.");
      downloadBlob(createExecutivePdfBlob(executiveReport), `${reportBaseName}-executive-memo.pdf`);
    });

  const handleExecutivePptx = () =>
    performExport("pptx", async () => {
      if (!executiveReport) throw new Error("Executive results are not ready yet.");
      await downloadExecutivePptx(executiveReport, `${reportBaseName}-executive-briefing.pptx`);
    });

  const handleExecutiveCopy = () =>
    performExport("copy-executive", async () => {
      if (!executiveReport) throw new Error("Executive results are not ready yet.");
      await copyTextToClipboard(executiveReportToPlainText(executiveReport));
    });

  if (!open) return null;

  const hasData = rows.length > 0;
  const activeReportReady = mode === "academic" ? academicReport !== null : executiveReport !== null;

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-900/45 px-3 py-4 backdrop-blur-sm sm:px-6 sm:py-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-export-title"
        className={MODAL_SHELL}
      >
        <header className="relative shrink-0 overflow-hidden border-b border-slate-900/10 bg-white/65 px-5 py-6 backdrop-blur-xl sm:px-8">
          <div className="pointer-events-none absolute -right-12 -top-24 h-64 w-64 rounded-full bg-slate-900/[0.06] blur-3xl" />
          <div className="relative flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-900/15 bg-white/80 text-slate-900 shadow-sm">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                  Automated chapter and executive report generator
                </p>
                <span className="rounded-lg border border-slate-900/10 bg-slate-900/[0.05] px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  APA 7 edition
                </span>
                <span className="rounded-lg border border-slate-900/10 bg-slate-900/[0.05] px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  Native files
                </span>
              </div>
              <h2 id="report-export-title" className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                Preview, tailor, and export your report
              </h2>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-500">
                Generate a publication-ready Chapter 4 for academic users or a concise C-suite briefing for
                decision-makers from the same active dataset state.
              </p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close report generator"
              className="shrink-0 rounded-xl border border-slate-900/15 bg-white/80 p-2 text-slate-500 transition-colors hover:border-slate-900/40 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {!hasData ? (
          <div className="flex min-h-[32rem] flex-1 items-center justify-center p-6">
            <div className="max-w-md rounded-3xl border border-dashed border-slate-300 bg-white/65 px-6 py-12 text-center backdrop-blur-xl">
              <Database className="mx-auto h-8 w-8 text-slate-300" />
              <h3 className="mt-4 text-lg font-bold text-slate-900">No active dataset</h3>
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
                Upload or restore a dataset before generating statistical or executive reporting.
              </p>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="border-b border-slate-900/10 bg-white/50 px-5 py-4 backdrop-blur-xl sm:px-8">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className={LABEL_CLASS}>Report track</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Persona default: {initialMode === "academic" ? "Academic and thesis" : "Executive and enterprise"}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setMode("academic")}
                    aria-pressed={mode === "academic"}
                    className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-slate-900/15 ${
                      mode === "academic"
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-900/10 bg-white/75 text-slate-600 hover:border-slate-900/35"
                    }`}
                  >
                    <span className="text-xl" aria-hidden="true">🎓</span>
                    <span>
                      <span className="block text-sm font-bold">Academic and Thesis</span>
                      <span className={`mt-0.5 block text-[10px] font-semibold ${mode === "academic" ? "text-slate-300" : "text-slate-400"}`}>
                        APA tables and Chapter 4
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("executive")}
                    aria-pressed={mode === "executive"}
                    className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-slate-900/15 ${
                      mode === "executive"
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-900/10 bg-white/75 text-slate-600 hover:border-slate-900/35"
                    }`}
                  >
                    <span className="text-xl" aria-hidden="true">💼</span>
                    <span>
                      <span className="block text-sm font-bold">Executive and Enterprise</span>
                      <span className={`mt-0.5 block text-[10px] font-semibold ${mode === "executive" ? "text-slate-300" : "text-slate-400"}`}>
                        C-suite memo and slides
                      </span>
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div className="grid min-h-[42rem] lg:grid-cols-[19rem_minmax(0,1fr)]">
              <aside className="border-b border-slate-900/10 bg-slate-900/[0.025] p-5 backdrop-blur-xl lg:border-b-0 lg:border-r sm:p-6">
                <div className="space-y-5">
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      {mode === "academic" ? (
                        <GraduationCap className="h-4 w-4 text-slate-400" />
                      ) : (
                        <BriefcaseBusiness className="h-4 w-4 text-slate-400" />
                      )}
                      <p className={LABEL_CLASS}>Report details</p>
                    </div>

                    {mode === "academic" ? (
                      <div className="space-y-3">
                        <label className="block">
                          <span className={`${LABEL_CLASS} mb-1.5 block`}>Chapter title</span>
                          <input
                            className={INPUT_CLASS}
                            value={academicMetadata.title}
                            onChange={(event) =>
                              setAcademicMetadata((current) => ({ ...current, title: event.target.value }))
                            }
                          />
                        </label>
                        <label className="block">
                          <span className={`${LABEL_CLASS} mb-1.5 block`}>Author</span>
                          <input
                            className={INPUT_CLASS}
                            value={academicMetadata.author}
                            placeholder="Researcher name"
                            onChange={(event) =>
                              setAcademicMetadata((current) => ({ ...current, author: event.target.value }))
                            }
                          />
                        </label>
                        <label className="block">
                          <span className={`${LABEL_CLASS} mb-1.5 block`}>Institution</span>
                          <input
                            className={INPUT_CLASS}
                            value={academicMetadata.institution}
                            placeholder="University or research center"
                            onChange={(event) =>
                              setAcademicMetadata((current) => ({
                                ...current,
                                institution: event.target.value,
                              }))
                            }
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <label className="block">
                          <span className={`${LABEL_CLASS} mb-1.5 block`}>Memo title</span>
                          <input
                            className={INPUT_CLASS}
                            value={executiveMetadata.title}
                            onChange={(event) =>
                              setExecutiveMetadata((current) => ({ ...current, title: event.target.value }))
                            }
                          />
                        </label>
                        <label className="block">
                          <span className={`${LABEL_CLASS} mb-1.5 block`}>Prepared for</span>
                          <input
                            className={INPUT_CLASS}
                            value={executiveMetadata.preparedFor}
                            placeholder="Executive leadership"
                            onChange={(event) =>
                              setExecutiveMetadata((current) => ({
                                ...current,
                                preparedFor: event.target.value,
                              }))
                            }
                          />
                        </label>
                      </div>
                    )}

                    <label className="mt-3 block">
                      <span className={`${LABEL_CLASS} mb-1.5 block`}>Report date</span>
                      <input
                        type="date"
                        className={INPUT_CLASS}
                        value={reportDate}
                        onChange={(event) => setReportDate(event.target.value)}
                      />
                    </label>
                  </div>

                  <div className={REPORT_CARD}>
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-slate-400" />
                      <p className={LABEL_CLASS}>Active data context</p>
                    </div>
                    <p className="mt-3 truncate text-sm font-bold text-slate-900">{fileName ?? "Untitled dataset"}</p>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      {rows.length.toLocaleString()} rows · {Object.keys(rows[0] ?? {}).length} columns
                    </p>
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                      {activeFilter ? `Filtered: ${activeFilter}` : "Full active dataset; no workspace filter applied."}
                    </p>
                  </div>

                  <div>
                    <p className={LABEL_CLASS}>Export</p>
                    <div className="mt-3 grid gap-2">
                      {mode === "academic" ? (
                        <>
                          <button type="button" onClick={handleAcademicDocx} disabled={!activeReportReady || exporting !== null} className={PRIMARY_BUTTON}>
                            {exporting === "docx" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileType2 className="h-4 w-4" />}
                            Download DOCX
                          </button>
                          <button type="button" onClick={handleAcademicMarkdown} disabled={!activeReportReady || exporting !== null} className={SECONDARY_BUTTON}>
                            {exporting === "markdown" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                            Download Markdown
                          </button>
                          <button type="button" onClick={handleAcademicCopy} disabled={!activeReportReady || exporting !== null} className={SECONDARY_BUTTON}>
                            {exporting === "copy-academic" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                            Copy to clipboard
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={handleExecutivePdf} disabled={!activeReportReady || exporting !== null} className={PRIMARY_BUTTON}>
                            {exporting === "pdf" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                            Download PDF memo
                          </button>
                          <button type="button" onClick={handleExecutivePptx} disabled={!activeReportReady || exporting !== null} className={SECONDARY_BUTTON}>
                            {exporting === "pptx" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Presentation className="h-4 w-4" />}
                            Build PowerPoint
                          </button>
                          <button type="button" onClick={handleExecutiveCopy} disabled={!activeReportReady || exporting !== null} className={SECONDARY_BUTTON}>
                            {exporting === "copy-executive" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ClipboardCopy className="h-4 w-4" />}
                            Copy memo text
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {feedback && (
                    <div
                      role="status"
                      className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold ${
                        feedback.tone === "success"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-rose-200 bg-rose-50 text-rose-700"
                      }`}
                    >
                      {feedback.tone === "success" ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                      {feedback.message}
                    </div>
                  )}
                </div>
              </aside>

              <main className="min-w-0 bg-slate-100/55 p-4 sm:p-6 lg:p-8">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className={LABEL_CLASS}>Live preview</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {mode === "academic" ? "APA 7 Chapter Four manuscript" : "Executive memo and slide outline"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {mode === "academic" ? (
                      <BookOpen className="h-4 w-4 text-slate-400" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-slate-400" />
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Updates as you type
                    </span>
                  </div>
                </div>

                <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-slate-900/10 bg-slate-200/50 p-2 shadow-inner sm:p-4">
                  {mode === "academic" ? (
                    academicReport ? (
                      <AcademicPreview report={academicReport} />
                    ) : (
                      <div className="flex min-h-[32rem] items-center justify-center rounded-xl bg-white text-sm font-semibold text-slate-400">
                        Preparing academic results…
                      </div>
                    )
                  ) : executiveReport ? (
                    <ExecutivePreview report={executiveReport} />
                  ) : (
                    <div className="flex min-h-[32rem] items-center justify-center rounded-xl bg-white text-sm font-semibold text-slate-400">
                      Preparing executive results…
                    </div>
                  )}
                </div>
              </main>
            </div>
          </div>
        )}

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-900/10 bg-white/65 px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 backdrop-blur-xl sm:px-8">
          <span>Local analysis · No source data leaves this workspace</span>
          <span>{mode === "academic" ? "DOCX · Markdown · Clipboard" : "PDF · PPTX · Clipboard"}</span>
        </footer>
      </section>
    </div>
  );
};

export default ReportExportModal;