
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (!data.user) {
        throw new Error("Login failed. Please try again.");
      }

      router.push("/");
      router.refresh();
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Login failed. Please try again."
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
            Sign in to your account
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
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
              className="w-full rounded-lg border border-gray-700 bg-[#080b14] px-4 py-3 text-white outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-gray-300">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              className="w-full rounded-lg border border-gray-700 bg-[#080b14] px-4 py-3 text-white outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>

        {message && (
          <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {message}
          </div>
        )}

        <p className="mt-6 text-center text-sm text-gray-400">
          Don&apos;t have an account?{" "}
          <a
            href="/register"
            className="font-medium text-blue-400 hover:text-blue-300"
          >
            Create Account
          </a>
        </p>
      </div>
    </main>
  );
}
