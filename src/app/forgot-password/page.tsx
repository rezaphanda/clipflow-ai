
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleResetRequest(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setSuccess(false);

    try {
      const redirectTo = `${window.location.origin}/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(
        email,
        { redirectTo }
      );

      if (error) throw error;

      setSuccess(true);
      setMessage(
        "If an account exists for this email, a password reset link will be sent. Please check your inbox."
      );
    } catch (error: unknown) {
      console.error("Password reset request error:", error);
      setMessage(
        "Unable to process your request. Please try again later."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#080b14] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111827] p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-wider text-white">
            CLIPFLOW <span className="text-blue-500">AI</span>
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            Reset your account password
          </p>
        </div>

        <form onSubmit={handleResetRequest} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm text-gray-300">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full rounded-lg border border-gray-700 bg-[#080b14] px-4 py-3 text-white outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        {message && (
          <div
            role="status"
            className={`mt-5 rounded-lg border p-3 text-sm ${
              success
                ? "border-green-500/30 bg-green-500/10 text-green-300"
                : "border-red-500/30 bg-red-500/10 text-red-300"
            }`}
          >
            {message}
          </div>
        )}

        <p className="mt-6 text-center text-sm text-gray-400">
          Remember your password?{" "}
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
