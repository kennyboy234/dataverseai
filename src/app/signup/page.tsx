"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthService } from "@/services/auth.service";

export default function SignupPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await AuthService.register({ fullName, email, password });

      if (res.data.requiresEmailVerification) {
        setSuccess(true);
      } else {
        router.push("/login");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#111827] px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#10B981]/10 flex items-center justify-center">
            <svg
              className="w-7 h-7 text-[#10B981]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#111827] dark:text-white mb-2">
            Check your email
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            We sent a verification link to <strong>{email}</strong>. Confirm
            your email to finish creating your account.
          </p>
          <Link
            href="/login"
            className="inline-block mt-6 text-[#2563EB] font-medium hover:underline"
          >
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#111827] px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#111827] dark:text-white">
            Create your account
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Start analyzing, learning, and growing with DataVerse AI.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#111827] dark:text-gray-200 mb-1">
              Full name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="Jane Doe"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#111827] dark:text-gray-200 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#111827] dark:text-gray-200 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="At least 8 characters"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
            <p className="text-xs text-gray-400 mt-1">
              Must include an uppercase letter, a lowercase letter, and a number.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#111827] dark:text-gray-200 mb-1">
              Confirm password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Re-enter your password"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-[#111827] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-[#2563EB] text-white font-medium hover:bg-[#2563EB]/90 transition disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-[#2563EB] font-medium hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}