
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    if (password !== confirmPassword) {
      setMessage("Password confirmation does not match.");
      return;
    }

    if (password.length < 12) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
  emailRedirectTo: window.location.origin,
  data: {
    full_name: fullName,
  },
},
      });

      if (error) throw error;

      if (data.user) {
        setMessage(
          "Registration successful! Please check your email to verify your account."
        );
      }
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Registration failed. Please try again."
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
            Create your account and start your journey
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm text-gray-300">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="Enter your full name"
              className="w-full rounded-lg border border-gray-700 bg-[#080b14] px-4 py-3 text-white outline-none focus:border-blue-500"
            />
          </div>

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
              minLength={12}
              placeholder="Minimum 12 characters"
              className="w-full rounded-lg border border-gray-700 bg-[#080b14] px-4 py-3 text-white outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-gray-300">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Repeat your password"
              className="w-full rounded-lg border border-gray-700 bg-[#080b14] px-4 py-3 text-white outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        {message && (
          <div className="mt-5 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-300">
            {message}
          </div>
        )}

        <p className="mt-6 text-center text-sm text-gray-400">
          Already have an account?{" "}
          <a href="/login" className="font-medium text-blue-400 hover:text-blue-300">
            Sign In
          </a>
        </p>
      </div>
    </main>
  );
}
