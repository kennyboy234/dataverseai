"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  BarChart3,
  BookOpenCheck,
  BriefcaseBusiness,
  Clock3,
  FlaskConical,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

export type StatisticalCatalogCategoryId =
  | "academic"
  | "time-series"
  | "panel-regression"
  | "business-forensic";

export type StatisticalTestId =
  | "cronbachs-alpha"
  | "exploratory-factor-analysis"
  | "chi-square-test"
  | "one-way-anova"
  | "likert-descriptive-statistics"
  | "augmented-dicky-fuller-test"
  | "johansen-cointegration-test"
  | "granger-causality-test"
  | "durbin-watson-test"
  | "hausman-test"
  | "pooled-ols"
  | "heteroskedasticity-robust-se"
  | "benfords-law"
  | "kmeans-clustering"
  | "cash-flow-projection";

export interface StatisticalTestDefinition {
  id: StatisticalTestId;
  name: string;
  categoryId: StatisticalCatalogCategoryId;
  description: string;
  method: string;
  inputs: readonly string[];
  aliases: readonly string[];
}

export interface StatisticalCatalogModalProps {
  open: boolean;
  onClose: () => void;
  onLaunch: (test: StatisticalTestDefinition) => void;
  hasData?: boolean;
}

interface CategoryDefinition {
  id: StatisticalCatalogCategoryId;
  label: string;
  shortLabel: string;
  description: string;
  emoji: string;
  Icon: React.ElementType;
}

export const STATISTICAL_CATALOG_CATEGORIES: readonly CategoryDefinition[] = [
  {
    id: "academic",
    label: "Academic & Psychometric Tests",
    shortLabel: "Academic",
    description: "Reliability, latent structure, association, and survey evidence.",
    emoji: "🎓",
    Icon: BookOpenCheck,
  },
  {
    id: "time-series",
    label: "Time-Series & Econometrics",
    shortLabel: "Time-series",
    description: "Stationarity, long-run relationships, causality, and residual diagnostics.",
    emoji: "📈",
    Icon: Clock3,
  },
  {
    id: "panel-regression",
    label: "Panel Data & Advanced Regression",
    shortLabel: "Panel & regression",
    description: "Model specification and inference for repeated and pooled observations.",
    emoji: "📉",
    Icon: BarChart3,
  },
  {
    id: "business-forensic",
    label: "Business & Forensic Analytics",
    shortLabel: "Business & forensic",
    description: "Anomaly detection, segmentation, and forward-looking business models.",
    emoji: "💼",
    Icon: BriefcaseBusiness,
  },
] as const;

export const GLOBAL_STATISTICAL_TESTS: readonly StatisticalTestDefinition[] = [
  {
    id: "cronbachs-alpha",
    name: "Cronbach's Alpha",
    categoryId: "academic",
    description: "Assess internal consistency and measurement reliability across scale items.",
    method: "Internal consistency",
    inputs: ["Two or more scale items", "Complete responses"],
    aliases: ["reliability", "alpha", "psychometric", "likert scale"],
  },
  {
    id: "exploratory-factor-analysis",
    name: "Exploratory Factor Analysis",
    categoryId: "academic",
    description: "Identify the latent dimensions that explain covariance among observed variables.",
    method: "Latent structure",
    inputs: ["Numeric variables", "Correlation matrix"],
    aliases: ["efa", "factor analysis", "construct validity", "dimensions"],
  },
  {
    id: "chi-square-test",
    name: "Chi-Square Test",
    categoryId: "academic",
    description: "Evaluate categorical association or compare observed frequencies with expectations.",
    method: "Categorical association",
    inputs: ["Categorical variables", "Expected cell counts"],
    aliases: ["chi2", "chi square", "independence", "contingency", "goodness of fit"],
  },
  {
    id: "one-way-anova",
    name: "One-Way ANOVA",
    categoryId: "academic",
    description: "Compare means across three or more independent groups in one dependent measure.",
    method: "Group mean comparison",
    inputs: ["Dependent variable", "Grouping variable"],
    aliases: ["anova", "analysis of variance", "mean comparison", "f test"],
  },
  {
    id: "likert-descriptive-statistics",
    name: "Likert Descriptive Statistics",
    categoryId: "academic",
    description: "Summarise response distributions, central tendency, dispersion, and response bands.",
    method: "Ordinal survey summary",
    inputs: ["Likert items", "Response scale"],
    aliases: ["likert", "survey", "top box", "bottom box", "response distribution"],
  },
  {
    id: "augmented-dicky-fuller-test",
    name: "Augmented Dickey-Fuller Unit Root Test",
    categoryId: "time-series",
    description: "Test whether a time series has a unit root and requires differencing.",
    method: "Stationarity testing",
    inputs: ["Ordered numeric series", "Optional time index"],
    aliases: ["adf", "dickey fuller", "unit root", "stationarity", "augmented"],
  },
  {
    id: "johansen-cointegration-test",
    name: "Johansen Cointegration Test",
    categoryId: "time-series",
    description: "Assess whether multiple non-stationary series share a stable long-run relationship.",
    method: "Vector error correction",
    inputs: ["Two or more series", "Lag order"],
    aliases: ["johansen", "cointegration", "long run", "vector error correction", "vecm"],
  },
  {
    id: "granger-causality-test",
    name: "Granger Causality Test",
    categoryId: "time-series",
    description: "Determine whether lagged values of one series improve forecasts of another.",
    method: "Predictive causality",
    inputs: ["Cause series", "Effect series", "Time lags"],
    aliases: ["granger", "causality", "lagged prediction", "predictive causality"],
  },
  {
    id: "durbin-watson-test",
    name: "Durbin-Watson Serial Correlation Test",
    categoryId: "time-series",
    description: "Diagnose first-order autocorrelation in regression residuals.",
    method: "Residual diagnostic",
    inputs: ["Regression residuals"],
    aliases: ["durbin watson", "dw", "autocorrelation", "serial correlation", "residuals"],
  },
  {
    id: "hausman-test",
    name: "Hausman Fixed / Random Effects Test",
    categoryId: "panel-regression",
    description: "Compare fixed-effects and random-effects panel model specifications.",
    method: "Panel specification",
    inputs: ["Entity identifier", "Dependent variable", "Regressors"],
    aliases: ["hausman", "fixed effects", "random effects", "panel data", "fe re"],
  },
  {
    id: "pooled-ols",
    name: "Pooled Ordinary Least Squares",
    categoryId: "panel-regression",
    description: "Estimate one common linear relationship across all panel observations.",
    method: "Pooled linear model",
    inputs: ["Dependent variable", "One or more regressors"],
    aliases: ["pooled ols", "pooled regression", "panel regression", "ordinary least squares", "ols"],
  },
  {
    id: "heteroskedasticity-robust-se",
    name: "Heteroskedasticity-Robust Standard Errors",
    categoryId: "panel-regression",
    description: "Correct coefficient inference for non-constant residual variance.",
    method: "Robust inference",
    inputs: ["Regression specification", "Residual estimates"],
    aliases: ["robust standard errors", "heteroskedasticity", "white", "hc1", "huber white"],
  },
  {
    id: "benfords-law",
    name: "Benford's Law Anomaly Detection",
    categoryId: "business-forensic",
    description: "Screen numeric observations for implausible first-digit distributions.",
    method: "Forensic plausibility",
    inputs: ["Numeric measure", "Positive observations"],
    aliases: ["benford", "first digit", "fraud detection", "anomaly", "forensic"],
  },
  {
    id: "kmeans-clustering",
    name: "K-Means Clustering",
    categoryId: "business-forensic",
    description: "Partition observations into k groups around standardised feature centroids.",
    method: "Unsupervised segmentation",
    inputs: ["Numeric features", "Cluster count"],
    aliases: ["k means", "kmeans", "clustering", "segmentation", "centroid"],
  },
  {
    id: "cash-flow-projection",
    name: "Cash-Flow Projection Model",
    categoryId: "business-forensic",
    description: "Forecast a numeric cash-flow series with confidence intervals and diagnostics.",
    method: "Time-series forecasting",
    inputs: ["Ordered cash-flow series", "Forecast horizon"],
    aliases: ["cash flow", "forecast", "projection", "arima", "liquidity", "finance"],
  },
] as const;

const CATEGORY_BY_ID = new Map(
  STATISTICAL_CATALOG_CATEGORIES.map((category) => [category.id, category])
);

const normalize = (value: string): string =>
  value
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const matchesSearch = (test: StatisticalTestDefinition, query: string): boolean => {
  if (!query) return true;
  const category = CATEGORY_BY_ID.get(test.categoryId);
  const haystack = normalize(
    [
      test.name,
      test.description,
      test.method,
      category?.label ?? "",
      category?.shortLabel ?? "",
      ...test.inputs,
      ...test.aliases,
    ].join(" ")
  );
  return query
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
};

export const StatisticalCatalogModal: React.FC<StatisticalCatalogModalProps> = ({
  open,
  onClose,
  onLaunch,
  hasData = true,
}) => {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"all" | StatisticalCatalogCategoryId>("all");
  const [activeIndex, setActiveIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveCategory("all");
    setActiveIndex(0);
    const frame = window.requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  const normalizedQuery = useMemo(() => normalize(query), [query]);
  const filteredTests = useMemo(
    () =>
      GLOBAL_STATISTICAL_TESTS.filter(
        (test) =>
          (activeCategory === "all" || test.categoryId === activeCategory) &&
          matchesSearch(test, normalizedQuery)
      ),
    [activeCategory, normalizedQuery]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [activeCategory, normalizedQuery]);

  const launchTest = (test: StatisticalTestDefinition) => {
    onLaunch(test);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/45 px-3 py-4 backdrop-blur-sm sm:px-6 sm:py-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="statistical-catalog-title"
        aria-describedby="statistical-catalog-description"
        className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-900/15 bg-white/80 shadow-2xl backdrop-blur-xl"
      >
        <header className="relative shrink-0 overflow-hidden border-b border-slate-900/10 bg-white/65 px-5 py-6 sm:px-8 sm:py-7">
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-slate-900/[0.06] blur-3xl" />
          <div className="relative flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-900/15 bg-white/80 text-slate-900 shadow-sm backdrop-blur-xl">
              <FlaskConical className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                  Global statistical & econometric master catalog
                </p>
                <span className="rounded-lg border border-slate-900/10 bg-slate-900/[0.05] px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  {GLOBAL_STATISTICAL_TESTS.length} global methods
                </span>
              </div>
              <h2
                id="statistical-catalog-title"
                className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
              >
                Find the right test. Launch it instantly.
              </h2>
              <p
                id="statistical-catalog-description"
                className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-500"
              >
                Search the complete research catalog by method, outcome, alias, or required input—then
                send the selected test directly to your active dataset workspace.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close statistical test catalog"
              className="shrink-0 rounded-xl border border-slate-900/15 bg-white/80 p-2 text-slate-500 backdrop-blur-xl transition-colors hover:border-slate-900/40 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="shrink-0 border-b border-slate-900/10 bg-white/55 px-5 py-4 backdrop-blur-xl sm:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" && filteredTests.length > 0) {
                    event.preventDefault();
                    setActiveIndex((current) => (current + 1) % filteredTests.length);
                  } else if (event.key === "ArrowUp" && filteredTests.length > 0) {
                    event.preventDefault();
                    setActiveIndex(
                      (current) => (current - 1 + filteredTests.length) % filteredTests.length
                    );
                  } else if (event.key === "Enter" && filteredTests.length > 0) {
                    event.preventDefault();
                    launchTest(filteredTests[Math.min(activeIndex, filteredTests.length - 1)]);
                  }
                }}
                placeholder="Search a test, method, or input — try “Granger” or “panel”…"
                aria-label="Search global statistical tests"
                className="w-full rounded-2xl border border-slate-900/15 bg-white/85 py-3 pl-10 pr-4 text-sm font-semibold text-slate-900 shadow-sm backdrop-blur-xl outline-none transition-colors placeholder:font-medium placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
            <div className="flex items-center justify-between gap-3 lg:justify-end">
              <span
                className="inline-flex items-center gap-2 rounded-xl border border-slate-900/10 bg-white/70 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500"
              >
                <span
                  className={`h-2 w-2 rounded-full ${hasData ? "bg-emerald-500" : "bg-amber-400"}`}
                  aria-hidden="true"
                />
                {hasData ? "Active dataset ready" : "Upload required"}
              </span>
              <p className="whitespace-nowrap text-xs font-semibold text-slate-500" aria-live="polite">
                {filteredTests.length} of {GLOBAL_STATISTICAL_TESTS.length} tests
              </p>
            </div>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Filter tests by category">
            <button
              type="button"
              onClick={() => {
                setActiveCategory("all");
                setActiveIndex(0);
              }}
              aria-pressed={activeCategory === "all"}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900/15 ${
                activeCategory === "all"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-900/10 bg-white/70 text-slate-500 hover:border-slate-900/30 hover:text-slate-900"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              All disciplines
            </button>
            {STATISTICAL_CATALOG_CATEGORIES.map((category) => {
              const selected = activeCategory === category.id;
              const count = GLOBAL_STATISTICAL_TESTS.filter((test) => test.categoryId === category.id)
                .length;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => {
                    setActiveCategory(category.id);
                    setActiveIndex(0);
                  }}
                  aria-pressed={selected}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900/15 ${
                    selected
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-900/10 bg-white/70 text-slate-500 hover:border-slate-900/30 hover:text-slate-900"
                  }`}
                >
                  <span aria-hidden="true">{category.emoji}</span>
                  <span>{category.shortLabel}</span>
                  <span className={selected ? "text-white/60" : "text-slate-400"}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">
          {filteredTests.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center backdrop-blur-xl">
              <Search className="h-8 w-8 text-slate-300" aria-hidden="true" />
              <h3 className="mt-4 text-base font-bold text-slate-900">No matching global tests</h3>
              <p className="mt-1 max-w-md text-sm font-medium leading-relaxed text-slate-500">
                Try a method name such as “Hausman”, an outcome such as “forecasting”, or clear the
                active discipline filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setActiveCategory("all");
                }}
                className="mt-5 rounded-xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-slate-800"
              >
                Reset catalog filters
              </button>
            </div>
          ) : (
            <div className="space-y-7">
              {STATISTICAL_CATALOG_CATEGORIES.map((category) => {
                const categoryTests = filteredTests.filter((test) => test.categoryId === category.id);
                if (categoryTests.length === 0) return null;
                const CategoryIcon = category.Icon;
                return (
                  <section key={category.id} aria-labelledby={`catalog-category-${category.id}`}>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-900/10 bg-white/75 text-base backdrop-blur-xl"
                          aria-hidden="true"
                        >
                          {category.emoji}
                        </span>
                        <div className="min-w-0">
                          <h3
                            id={`catalog-category-${category.id}`}
                            className="flex items-center gap-2 text-sm font-bold text-slate-900"
                          >
                            <CategoryIcon className="h-4 w-4 text-slate-400" aria-hidden="true" />
                            {category.label}
                          </h3>
                          <p className="mt-0.5 text-xs font-medium text-slate-500">
                            {category.description}
                          </p>
                        </div>
                      </div>
                      <span className="rounded-lg border border-slate-900/10 bg-white/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        {categoryTests.length} {categoryTests.length === 1 ? "method" : "methods"}
                      </span>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {categoryTests.map((test, index) => {
                        const globalIndex = filteredTests.indexOf(test);
                        const isActive = globalIndex === activeIndex;
                        return (
                        <button
                          key={test.id}
                          type="button"
                          onMouseEnter={() => setActiveIndex(globalIndex)}
                          onFocus={() => setActiveIndex(globalIndex)}
                          onClick={() => launchTest(test)}
                          className={`group flex min-h-56 flex-col rounded-2xl border p-4 text-left shadow-sm backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-900/40 hover:shadow-lg focus:outline-none focus:ring-2 ${
                            isActive
                              ? "border-slate-900 bg-slate-900 text-white ring-2 ring-slate-900/15"
                              : index % 2 === 1
                                ? "border-slate-900/15 bg-slate-900/[0.045] hover:bg-slate-900/[0.065]"
                                : "border-slate-900/15 bg-white/75 hover:bg-white/90"
                          }`}
                          aria-label={`Launch ${test.name}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className={`rounded-lg border px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest backdrop-blur-xl ${
                              isActive
                                ? "border-white/15 bg-white/10 text-slate-200"
                                : "border-slate-900/10 bg-white/75 text-slate-500"
                            }`}>
                              {test.method}
                            </span>
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                              isActive
                                ? "border-white/15 bg-white/10 text-white"
                                : "border-slate-900/10 bg-white/70 text-slate-400 group-hover:border-slate-900/30 group-hover:text-slate-900"
                            }`}>
                              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                            </span>
                          </div>
                          <h4 className={`mt-4 text-base font-bold leading-snug tracking-tight ${isActive ? "text-white" : "text-slate-900"}`}>
                            {test.name}
                          </h4>
                          <p className={`mt-2 text-xs font-medium leading-relaxed ${isActive ? "text-slate-300" : "text-slate-500"}`}>
                            {test.description}
                          </p>
                          <div className="mt-auto flex flex-wrap gap-1.5 pt-5">
                            {test.inputs.map((input) => (
                              <span
                                key={input}
                                className={`rounded-lg border px-2 py-1 text-[9px] font-bold ${
                                  isActive
                                    ? "border-white/15 bg-white/10 text-slate-300"
                                    : "border-slate-900/10 bg-white/65 text-slate-500"
                                }`}
                              >
                                {input}
                              </span>
                            ))}
                          </div>
                          <div className={`mt-4 flex items-center justify-between border-t pt-3 ${
                            isActive ? "border-white/15" : "border-slate-900/10"
                          }`}>
                            <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${
                              isActive ? "text-white" : "text-slate-500 group-hover:text-slate-900"
                            }`}>
                              Launch test
                            </span>
                            <span className={`text-[9px] font-bold uppercase tracking-widest ${
                              isActive ? "text-slate-400" : "text-slate-400"
                            }`}>
                              Enter ↵
                            </span>
                          </div>
                        </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-900/10 bg-white/65 px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 backdrop-blur-xl sm:px-8">
          <span>Type a test name · ↑ ↓ select · ↵ launch</span>
          <span>Deterministic local workspace engines</span>
        </footer>
      </section>
    </div>
  );
};

export default StatisticalCatalogModal;