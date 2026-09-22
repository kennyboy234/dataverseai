"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthService } from "@/services/auth.service";

export default function ResetPasswordPage() {
  const [checkedHash, setCheckedHash] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;

    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");

    setToken(accessToken);
    setCheckedHash(true);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!token) {
      setError("This reset link is invalid or has expired.");
      return;
    }

    setLoading(true);

    try {
      await AuthService.resetPassword(token, { password });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!checkedHash) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#111827] px-4">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
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
            Password updated
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Your password has been reset. You can now log in with your new
            password.
          </p>
          <Link
            href="/login"
            className="inline-block mt-6 text-[#2563EB] font-medium hover:underline"
          >
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#111827] px-4">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-[#111827] dark:text-white mb-2">
            Invalid or expired link
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            This password reset link is invalid or has expired. Please
            request a new one.
          </p>
          <Link
            href="/forgot-password"
            className="inline-block mt-6 text-[#2563EB] font-medium hover:underline"
          >
            Request a new link
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
            Set a new password
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Choose a new password for your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#111827] dark:text-gray-200 mb-1">
              New password
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
              Confirm new password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Re-enter your new password"
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
            {loading ? "Updating password..." : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}