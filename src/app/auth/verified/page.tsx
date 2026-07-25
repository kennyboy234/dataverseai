"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function VerifiedPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "error">("loading");

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);

    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (accessToken && refreshToken) {
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      router.push("/");
    } else {
      setStatus("error");
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#111827] px-4">
      <div className="text-center">
        {status === "loading" ? (
          <>
            <div className="w-8 h-8 mx-auto mb-4 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 dark:text-gray-400">
              Verifying your email...
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-[#111827] dark:text-white mb-2">
              Verification link expired or invalid
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Please try logging in, or sign up again.
            </p>
          </>
        )}
      </div>
    </div>
  );
}