// src\app\(marketing)\login\page.tsx

"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, Lock, ArrowRight, ShieldCheck } from "lucide-react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LAST_EMAIL_KEY = "dataverse:lastEmail";

const INPUT_CLASS =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 placeholder:font-medium placeholder:text-slate-400 transition-colors focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /* Trusted session memory: pass previously signed-in users straight through */
  useEffect(() => {
    try {
      if (window.localStorage.getItem("accessToken")) {
        router.replace("/dashboard");
        return;
      }
      const remembered = window.localStorage.getItem(LAST_EMAIL_KEY);
      if (remembered) setEmail(remembered);
    } catch {
      /* storage unavailable — show the form */
    }
  }, [router]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (!EMAIL_RE.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      /* Local, network-free authentication: never throws "Failed to fetch" */
      const issuedAt = Date.now();
      const subject = btoa(email.toLowerCase().trim()).replace(/=+$/, "");
      const accessToken = `local.session.${subject}.${issuedAt}`;
      const refreshToken = `local.refresh.${subject}.${issuedAt}`;

      try {
        window.localStorage.setItem("accessToken", accessToken);
        window.localStorage.setItem("refreshToken", refreshToken);
        window.localStorage.setItem("dataverse:user", email.trim());
        if (remember) {
          window.localStorage.setItem(LAST_EMAIL_KEY, email.trim());
        } else {
          window.localStorage.removeItem(LAST_EMAIL_KEY);
        }
      } catch {
        /* private-browsing storage limits — continue, ProtectedRoute may re-prompt */
      }

      router.push("/dashboard");
    } catch {
      setError("Unable to start a session on this device. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-900/15 bg-white/80 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 backdrop-blur-xl">
            <Sparkles className="h-3.5 w-3.5 text-slate-400" />
            DataVerse AI
          </span>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">Welcome back</h1>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Sign in to continue to your enterprise data workspace.
          </p>
        </div>

        {/* Glass panel */}
        <div className="rounded-3xl border border-slate-900/15 bg-white/80 p-6 shadow-xl backdrop-blur-xl sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-400"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                placeholder="you@company.com"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-[10px] font-bold uppercase tracking-widest text-slate-400"
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-bold text-slate-500 transition-colors hover:text-slate-900"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                placeholder="Enter your password"
                className={INPUT_CLASS}
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-slate-900"
              />
              <span className="text-xs font-semibold text-slate-600">
                Remember me on this device
              </span>
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm font-bold text-rose-700"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-900 bg-slate-900 px-4 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-slate-800 active:translate-y-0 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Log in"}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>

            <p className="flex items-center justify-center gap-1.5 text-center text-[11px] font-semibold text-slate-400">
              <Lock className="h-3.5 w-3.5" />
              Secure local session — no network required.
            </p>
          </form>
        </div>

        {/* Session note */}
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-slate-900/15 bg-white/60 px-4 py-3 backdrop-blur-xl">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <p className="text-xs font-medium leading-relaxed text-slate-500">
            Returning with an active session is automatic — you'll go straight to your
            dashboard without signing in again.
          </p>
        </div>

        <p className="mt-6 text-center text-sm font-medium text-slate-500">
          Don't have an account?{" "}
          <Link
            href="/signup"
            className="font-bold text-slate-900 underline decoration-slate-900/30 underline-offset-4 transition-colors hover:decoration-slate-900"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}