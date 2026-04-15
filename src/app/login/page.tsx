"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Flag,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  Chrome,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const error = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState(
    error ? "Invalid credentials" : ""
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError("");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setAuthError("Invalid email or password");
        setIsLoading(false);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      setAuthError("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    await signIn("google", { callbackUrl });
  };

  return (
    <div className="min-h-screen bg-sand-50 dark:bg-dark-950 flex flex-col transition-colors">
      {/* Header */}
      <header className="p-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-fairway-700 dark:text-fairway-400 hover:text-fairway-800 dark:hover:text-fairway-300"
        >
          <div className="w-10 h-10 rounded-xl bg-fairway-gradient dark:bg-fairway-gradient-dark flex items-center justify-center">
            <Flag className="w-5 h-5 text-white" />
          </div>
          <span className="font-display text-xl font-bold">GolfnMe</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-sand-900 dark:text-sand-100 mb-2">
              Welcome back
            </h1>
            <p className="text-sand-600 dark:text-sand-400">
              Sign in to track your golf game
            </p>
          </div>

          <div className="card p-8">
            {/* Google Sign In */}
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-sand-200 dark:border-dark-700 rounded-xl hover:bg-sand-50 dark:hover:bg-dark-800 transition-colors disabled:opacity-50"
            >
              <Chrome className="w-5 h-5 text-sand-600 dark:text-sand-400" />
              <span className="font-medium text-sand-700 dark:text-sand-300">
                Continue with Google
              </span>
            </button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-sand-200 dark:border-dark-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white dark:bg-dark-900 text-sand-500 dark:text-sand-400">
                  or continue with email
                </span>
              </div>
            </div>

            {/* Error Message */}
            {authError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-red-700 dark:text-red-400"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{authError}</span>
              </motion.div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="input-label">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-sand-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="input pl-12"
                  />
                </div>
              </div>

              <div>
                <label className="input-label">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-sand-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="input pl-12 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-sand-400 hover:text-sand-600 dark:hover:text-sand-300"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="rounded border-sand-300 dark:border-dark-600 text-fairway-600 focus:ring-fairway-500 bg-white dark:bg-dark-800"
                  />
                  <span className="text-sand-600 dark:text-sand-400">
                    Remember me
                  </span>
                </label>
                <Link
                  href="/forgot-password"
                  className="text-fairway-600 dark:text-fairway-400 hover:text-fairway-700 dark:hover:text-fairway-300 font-medium"
                >
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>
          </div>

          <p className="text-center mt-6 text-sand-600 dark:text-sand-400">
            Don't have an account?{" "}
            <Link
              href="/signup"
              className="text-fairway-600 dark:text-fairway-400 hover:text-fairway-700 dark:hover:text-fairway-300 font-medium"
            >
              Sign up free
            </Link>
          </p>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-sm text-sand-500 dark:text-sand-500">
        © 2025 Fairway Golf Tracker. All rights reserved.
      </footer>
    </div>
  );
}
