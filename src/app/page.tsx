// src\app\page.tsx
"use client";

import { useEffect, useState } from "react";

const NAV_LINKS = [
  { label: "Home", href: "#home" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
] as const;

const FEATURES = [
  {
    title: "AI Data Analysis",
    description:
      "Upload datasets and get instant insights powered by advanced machine learning models that surface patterns, anomalies, and trends.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.5 18.75h-15a2.25 2.25 0 0 1-2.25-2.25V6.75A2.25 2.25 0 0 1 4.5 4.5h15a2.25 2.25 0 0 1 2.25 2.25v9.75A2.25 2.25 0 0 1 19.5 18.75Z" />
      </svg>
    ),
    color: "bg-[#2563EB]/10 text-[#2563EB]",
  },
  {
    title: "Interactive Dashboards",
    description:
      "Build beautiful, drag-and-drop dashboards with real-time charts, filters, and shareable views for your entire team.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6.75v6.75" />
      </svg>
    ),
    color: "bg-[#10B981]/10 text-[#10B981]",
  },
  {
    title: "Learning Academy",
    description:
      "Master data analytics with guided courses, hands-on projects, and certifications designed for every skill level.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
      </svg>
    ),
    color: "bg-[#7C3AED]/10 text-[#7C3AED]",
  },
  {
    title: "Expert Marketplace",
    description:
      "Connect with certified data scientists and analysts for consulting, custom models, and enterprise-grade solutions.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
      </svg>
    ),
    color: "bg-[#2563EB]/10 text-[#2563EB]",
  },
  {
    title: "Real-Time Insights",
    description:
      "Monitor live data streams and receive AI-driven alerts the moment something important changes in your metrics.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
      </svg>
    ),
    color: "bg-[#10B981]/10 text-[#10B981]",
  },
  {
    title: "Secure Collaboration",
    description:
      "Share projects safely with role-based access, audit logs, and enterprise-grade encryption across your organization.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
    ),
    color: "bg-[#7C3AED]/10 text-[#7C3AED]",
  },
] as const;

const FOOTER_LINKS = {
  Product: ["Features", "Pricing", "Integrations", "Changelog"],
  Company: ["About", "Careers", "Blog", "Press"],
  Resources: ["Documentation", "Help Center", "Community", "Status"],
  Legal: ["Privacy", "Terms", "Security", "Cookies"],
} as const;

function Logo({ className = "" }: { className?: string }) {
  return (
    <a href="#home" className={`flex items-center gap-2.5 ${className}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#2563EB] to-[#7C3AED] shadow-md shadow-[#2563EB]/20">
        <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </div>
      <span className="text-lg font-bold tracking-tight text-[#111827] dark:text-white">
        DataVerse <span className="text-[#2563EB]">AI</span>
      </span>
    </a>
  );
}

function DarkModeToggle({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"} className="rounded-lg p-2 text-[#111827] transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
      {isDark ? (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
        </svg>
      )}
    </button>
  );
}

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldBeDark = stored === "dark" || (!stored && prefersDark);
    setIsDark(shouldBeDark);
    document.documentElement.classList.toggle("dark", shouldBeDark);

    const token = localStorage.getItem("accessToken");
    setIsLoggedIn(!!token);
  }, []);

  const toggleDarkMode = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setIsLoggedIn(false);
  };

  return (
    <div className="min-h-screen bg-white text-[#111827] dark:bg-gray-950 dark:text-gray-100">
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-lg dark:border-gray-800 dark:bg-gray-950/80">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Logo />
          <div className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <a key={link.label} href={link.href} className="text-sm font-medium text-gray-600 transition-colors hover:text-[#2563EB] dark:text-gray-400 dark:hover:text-[#2563EB]">
                {link.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <DarkModeToggle isDark={isDark} onToggle={toggleDarkMode} />
            {isLoggedIn ? (
              <button type="button" onClick={handleLogout} className="hidden rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-[#111827] transition-all hover:bg-gray-50 sm:inline-block dark:border-gray-700 dark:text-white dark:hover:bg-gray-800">
                Log out
              </button>
            ) : (
              <a href="/login" className="hidden rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#2563EB]/25 transition-all hover:bg-[#1D4ED8] hover:shadow-lg hover:shadow-[#2563EB]/30 sm:inline-block">
                Get Started
              </a>
            )}
            <button type="button" className="rounded-lg p-2 text-gray-600 md:hidden dark:text-gray-400" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
              {mobileMenuOpen ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              )}
            </button>
          </div>
        </nav>
        {mobileMenuOpen && (
          <div className="border-t border-gray-100 px-4 py-4 md:hidden dark:border-gray-800">
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <a key={link.label} href={link.href} className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-[#2563EB] dark:text-gray-400 dark:hover:bg-gray-900" onClick={() => setMobileMenuOpen(false)}>
                  {link.label}
                </a>
              ))}
              {isLoggedIn ? (
                <button type="button" onClick={() => { handleLogout(); setMobileMenuOpen(false); }} className="mt-2 rounded-xl border border-gray-200 px-5 py-2.5 text-center text-sm font-semibold text-[#111827] dark:border-gray-700 dark:text-white">
                  Log out
                </button>
              ) : (
                <a href="/login" className="mt-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-center text-sm font-semibold text-white shadow-md" onClick={() => setMobileMenuOpen(false)}>
                  Get Started
                </a>
              )}
            </div>
          </div>
        )}
      </header>

      <section id="home" className="relative overflow-hidden px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-36">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 right-0 h-[500px] w-[500px] rounded-full bg-[#2563EB]/5 blur-3xl" />
          <div className="absolute -bottom-20 left-0 h-[400px] w-[400px] rounded-full bg-[#7C3AED]/5 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#10B981]/5 blur-3xl" />
        </div>
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#2563EB]/20 bg-[#2563EB]/5 px-4 py-1.5 text-sm font-medium text-[#2563EB] dark:border-[#2563EB]/30 dark:bg-[#2563EB]/10">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10B981] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#10B981]" />
            </span>
            AI-Powered Analytics Platform
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-[#111827] sm:text-5xl lg:text-6xl dark:text-white">
            Analyze. Learn.{" "}
            <span className="bg-gradient-to-r from-[#2563EB] via-[#7C3AED] to-[#10B981] bg-clip-text text-transparent">
              Visualize. Grow.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-600 sm:text-xl dark:text-gray-400">
            Transform raw data into actionable insights with DataVerse AI — the all-in-one platform for intelligent analysis, stunning visualizations, and continuous learning.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a href="#cta" className="w-full rounded-xl bg-[#2563EB] px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#2563EB]/25 transition-all hover:bg-[#1D4ED8] hover:shadow-xl hover:shadow-[#2563EB]/30 sm:w-auto">
              Start Free
            </a>
            <a href="#features" className="w-full rounded-xl border border-gray-200 bg-white px-8 py-3.5 text-base font-semibold text-[#111827] shadow-sm transition-all hover:border-[#2563EB]/30 hover:shadow-md sm:w-auto dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:border-[#2563EB]/50">
              Explore Features
            </a>
          </div>
          <div className="mt-16 grid grid-cols-3 gap-6 border-t border-gray-100 pt-10 dark:border-gray-800 sm:gap-12">
            {[
              { value: "10K+", label: "Active Users" },
              { value: "500M+", label: "Data Points" },
              { value: "99.9%", label: "Uptime" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl font-bold text-[#2563EB] sm:text-3xl">{stat.value}</div>
                <div className="mt-1 text-xs text-gray-500 sm:text-sm dark:text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="bg-gray-50 px-4 py-20 sm:px-6 sm:py-28 lg:px-8 dark:bg-gray-900/50">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-[#10B981]">Features</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl dark:text-white">
              Everything you need to master your data
            </h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
              Powerful tools designed to help you analyze faster, learn smarter, and grow your business with confidence.
            </p>
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="group rounded-2xl border border-gray-100 bg-white p-8 shadow-sm transition-all hover:border-[#2563EB]/20 hover:shadow-lg hover:shadow-[#2563EB]/5 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-[#2563EB]/30">
                <div className={`inline-flex rounded-xl p-3 ${feature.color}`}>
                  {feature.icon}
                </div>
                <h3 className="mt-5 text-lg font-semibold text-[#111827] dark:text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div id="pricing" className="sr-only" aria-hidden="true" />
      <div id="about" className="sr-only" aria-hidden="true" />
      <div id="contact" className="sr-only" aria-hidden="true" />

      <section id="cta" className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#2563EB] via-[#1D4ED8] to-[#7C3AED] px-8 py-16 text-center shadow-2xl shadow-[#2563EB]/20 sm:px-16 sm:py-20">
            <div className="pointer-events-none absolute inset-0 opacity-10">
              <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white" />
              <div className="absolute -bottom-10 -left-10 h-60 w-60 rounded-full bg-white" />
            </div>
            <h2 className="relative text-3xl font-bold text-white sm:text-4xl">
              Ready to unlock your data&apos;s potential?
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-lg text-blue-100">
              Join thousands of teams using DataVerse AI to make smarter decisions. Start your free trial today — no credit card required.
            </p>
            <div className="relative mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a href={isLoggedIn ? "/dashboard" : "/signup"} className="w-full rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-[#2563EB] shadow-lg transition-all hover:bg-gray-50 sm:w-auto">
                {isLoggedIn ? "Go to Dashboard" : "Create Free Account"}
              </a>
              <a href="#features" className="w-full rounded-xl border border-white/30 px-8 py-3.5 text-base font-semibold text-white transition-all hover:bg-white/10 sm:w-auto">
                View Demo
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-100 bg-white px-4 py-16 sm:px-6 lg:px-8 dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-1">
              <Logo />
              <p className="mt-4 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                The AI-powered data analytics platform that helps you analyze, learn, visualize, and grow.
              </p>
            </div>
            {Object.entries(FOOTER_LINKS).map(([category, links]) => (
              <div key={category}>
                <h4 className="text-sm font-semibold text-[#111827] dark:text-white">{category}</h4>
                <ul className="mt-4 space-y-3">
                  {links.map((link) => (
                    <li key={link}>
                      <a href="#" className="text-sm text-gray-500 transition-colors hover:text-[#2563EB] dark:text-gray-400 dark:hover:text-[#2563EB]">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-gray-100 pt-8 sm:flex-row dark:border-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              &copy; {new Date().getFullYear()} DataVerse AI. All rights reserved.
            </p>
            <div className="flex gap-6">
              {["Twitter", "LinkedIn", "GitHub"].map((social) => (
                <a key={social} href="#" className="text-sm text-gray-500 transition-colors hover:text-[#2563EB] dark:text-gray-400 dark:hover:text-[#2563EB]">
                  {social}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}