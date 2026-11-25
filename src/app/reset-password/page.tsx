
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [validSession, setValidSession] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function checkSession() {
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session) {
        setValidSession(false);
        setMessage(
          "Your reset link is invalid or has expired. Please request a new one."
        );
      } else {
        setValidSession(true);
      }

      setChecking(false);
    }

    checkSession();
  }, []);

  async function handleUpdatePassword(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();
    setMessage("");

    if (password.length < 12) {
      setMessage("Password must be at least 12 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Password confirmation does not match.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      await supabase.auth.signOut();

      router.replace("/login?password_reset=success");
    } catch (error: unknown) {
      console.error("Password update error:", error);
      setMessage(
        "Unable to update your password. Please request a new reset link."
      );
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#080b14] px-4">
        <p className="text-gray-300">Verifying reset link...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#080b14] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111827] p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-wider text-white">
            CLIPFLOW <span className="text-blue-500">AI</span>
          </h1>

          <p className="mt-2 text-sm text-gray-400">
            Create a new password
          </p>
        </div>

        {validSession ? (
          <form onSubmit={handleUpdatePassword} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm text-gray-300">
                New Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={12}
                autoComplete="new-password"
                placeholder="Minimum 12 characters"
                className="w-full rounded-lg border border-gray-700 bg-[#080b14] px-4 py-3 text-white outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-300">
                Confirm New Password
              </label>

              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={12}
                autoComplete="new-password"
                placeholder="Repeat your new password"
                className="w-full rounded-lg border border-gray-700 bg-[#080b14] px-4 py-3 text-white outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        ) : (
          <div className="text-center">
            <p className="text-sm text-gray-300">{message}</p>

            <a
              href="/forgot-password"
              className="mt-5 inline-block font-medium text-blue-400 hover:text-blue-300"
            >
              Request a New Reset Link
            </a>
          </div>
        )}

        {validSession && message && (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
          >
            {message}
          </div>
        )}

        <p className="mt-6 text-center text-sm text-gray-400">
          <a
            href="/login"
            className="font-medium text-blue-400 hover:text-blue-300"
          >
            Back to Sign In
          </a>
        </p>
      </div>
    </main>
  );
}
