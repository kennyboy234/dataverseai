"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Database,
  FileText,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useEffect, useState } from "react";

import { TextRollUp } from "@/components/TextRollUp";

const TECH_STACK = [
  "Python",
  "SQL",
  "Excel",
  "SPSS",
  "EViews",
  "Tableau",
  "Power BI",
  "Pandas",
  "PostgreSQL",
  "R",
  "Snowflake",
];

const PLATFORM_PILLARS = [
  {
    title: "Automated AI Data Auditing",
    description:
      "Deterministic rule checks, missing value stabilization, anomaly detection, and Gemini AI diagnostic reports for cleaner, trusted datasets.",
    badge: "AI audit layer",
    accent: "from-sky-500/15 via-sky-500/5 to-white",
    icon: Database,
  },
  {
    title: "Multi-Version Rerun Analysis",
    description:
      "Version timeline v1 → v3, health score deltas, evidence ledger comparison, and issue movement tracking across every rerun.",
    badge: "Version intelligence",
    accent: "from-violet-500/15 via-violet-500/5 to-white",
    icon: BarChart3,
  },
  {
    title: "Interactive Data Workspace & Visualizations",
    description:
      "Pivot exploration, instant chart generation, and clean data wrangling inside a single operational workspace built for analysts and execs.",
    badge: "Insight workspace",
    accent: "from-emerald-500/15 via-emerald-500/5 to-white",
    icon: Wand2,
  },
  {
    title: "Executive AI Report Exports",
    description:
      "Instant CSV/JSON reports, evidence ledgers, and automated statistical summaries designed for decision-makers and stakeholder reviews.",
    badge: "Executive reporting",
    accent: "from-amber-500/15 via-amber-500/5 to-white",
    icon: FileText,
  },
] as const;

const TRUST_METRICS = [
  { value: "10K+", label: "Audits launched" },
  { value: "96%", label: "Faster issue detection" },
  { value: "99.9%", label: "Platform uptime" },
] as const;

export default function HomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(Boolean(localStorage.getItem("accessToken")));
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.2),transparent_30%),linear-gradient(180deg,#f7f7f5_0%,#eef3f7_100%)] text-slate-900">
      <main>
        <section className="relative isolate overflow-hidden px-4 pb-20 pt-16 sm:px-6 lg:px-8 lg:pb-28 lg:pt-20">
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px] bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.16),transparent_28%),radial-gradient(circle_at_20%_80%,_rgba(168,85,247,0.14),transparent_24%),radial-gradient(circle_at_80%_10%,_rgba(20,184,166,0.12),transparent_22%)]" />

          <div className="mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              className="glass-panel mx-auto max-w-5xl rounded-[32px] border border-slate-200/70 p-6 sm:p-8 lg:p-10"
            >
              <div className="mb-10 flex items-center justify-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  AI data intelligence
                </div>
              </div>

              <div className="mx-auto max-w-4xl text-center">
                <TextRollUp 
                  text="Everything Data Analytics." 
                  className="text-4xl font-semibold leading-[0.94] tracking-[-0.065em] text-slate-950 sm:text-6xl lg:text-[6.2rem] flex justify-center flex-wrap" 
                />
                <TextRollUp 
                  text="Audit. Analyze. Visualize. Automate." 
                  className="mt-4 text-4xl font-semibold leading-[0.94] tracking-[-0.065em] bg-gradient-to-r from-slate-950 via-sky-700 to-violet-700 bg-clip-text text-transparent sm:text-6xl lg:text-[6.2rem] flex justify-center flex-wrap" 
                />

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ delay: 0.5, duration: 0.6 }}
                  className="mx-auto mt-7 max-w-3xl text-[15px] leading-7 text-slate-600 sm:text-lg"
                >
                  The ultimate AI-powered ecosystem for automated data quality auditing, multi-version rerun analysis, statistical data cleaning, and executive reporting across complex datasets.
                </motion.p>

                <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Link
                    href={isLoggedIn ? "/dashboard" : "/signup"}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-sm font-medium text-white shadow-[0_18px_40px_rgba(15,23,42,0.15)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-800"
                  >
                    Start Free Analysis
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/dashboard/audit"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white/80 px-6 py-3 text-sm font-medium text-slate-800 shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300"
                  >
                    Launch Audit Engine
                  </Link>
                  <Link
                    href={isLoggedIn ? "/dashboard" : "/login"}
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-slate-100/80 px-6 py-3 text-sm font-medium text-slate-800 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-400"
                  >
                    Explore Workspace
                  </Link>
                </div>
              </div>

              <div className="mt-12 grid gap-4 sm:grid-cols-3">
                {TRUST_METRICS.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 text-center shadow-[0_12px_25px_rgba(15,23,42,0.04)]">
                    <div className="text-2xl font-semibold tracking-[-0.06em] text-slate-950">{item.value}</div>
                    <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">{item.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        <motion.section 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.8 }}
          className="border-y border-slate-200/80 bg-white/70 px-4 py-5 backdrop-blur-sm sm:px-6 lg:px-8"
        >
          <div className="mx-auto max-w-6xl overflow-hidden">
            <div className="marquee-track flex min-w-max items-center gap-8 whitespace-nowrap text-sm font-medium uppercase tracking-[0.22em] text-slate-500">
              {[...TECH_STACK, ...TECH_STACK].map((tool, index) => (
                <span key={`${tool}-${index}`} className="inline-flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-sky-500" />
                  {tool}
                </span>
              ))}
            </div>
          </div>
        </motion.section>

        <section className="bg-[#111827] px-4 py-20 text-white sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Platform pillars</p>
              <TextRollUp 
                text="Built for modern data operations, governance, and executive review." 
                className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-5xl flex flex-wrap" 
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {PLATFORM_PILLARS.map(({ title, description, badge, accent, icon: Icon }, index) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.6, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ y: -4 }}
                  className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_30px_80px_rgba(0,0,0,0.22)] backdrop-blur-xl"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${accent}`} />
                  <div className="relative z-10">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-sky-200">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-200">
                        {badge}
                      </span>
                    </div>
                    <h3 className="text-2xl font-semibold tracking-[-0.04em] text-white">{title}</h3>
                    <p className="mt-3 text-[15px] leading-7 text-slate-300">{description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto max-w-6xl rounded-[32px] border border-slate-200/80 bg-white/80 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:p-8 lg:p-10"
          >
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Operational clarity</p>
                <TextRollUp 
                  text="Confidence from version to version, not guesswork." 
                  className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-5xl flex flex-wrap" 
                />
                <p className="mt-5 max-w-xl text-[15px] leading-7 text-slate-600 sm:text-lg">
                  DataVerse AI gives every team a measurable, transparent story: what changed, what broke, what improved, and what needs action across the next data cycle.
                </p>
                <ul className="mt-8 space-y-4 text-base text-slate-700">
                  {[
                    "Deterministic rule checks paired with Gemini AI diagnostics",
                    "Version comparison across v1, v2, and v3 with evidence-backed deltas",
                    "Exportable summaries for analysts, stakeholders, and executive review",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <ShieldCheck className="h-4 w-4" />
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="dark-panel rounded-[28px] p-5 text-white">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">Audit summary</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">Dataset health</h3>
                  </div>
                  <div className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                    +15% gain
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {[
                    { label: "Resolved issues", value: "18", tone: "text-emerald-300" },
                    { label: "Persistent warnings", value: "6", tone: "text-amber-300" },
                    { label: "New anomalies", value: "2", tone: "text-rose-300" },
                  ].map((row) => (
                    <div key={row.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-300">{row.label}</span>
                        <span className={`text-xl font-semibold ${row.tone}`}>{row.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="bg-slate-950 px-4 py-20 text-white sm:px-6 lg:px-8 lg:py-28">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto max-w-6xl rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-[0_40px_100px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-8 lg:p-10"
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Ready to operate</p>
                <TextRollUp 
                  text="Turn raw data into a governed, actionable system." 
                  className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-5xl flex flex-wrap" 
                />
              </div>

              <Link
                href={isLoggedIn ? "/dashboard" : "/signup"}
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-6 py-3 text-sm font-medium text-slate-950 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-100"
              >
                Start Free Analysis
                <Sparkles className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>
        </section>
      </main>
    </div>
  );
}
