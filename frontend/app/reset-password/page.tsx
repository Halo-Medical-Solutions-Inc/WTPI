"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PasswordInput from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { PageSpinner } from "@/components/ui/page-spinner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Invalid reset link");
      setIsLoading(false);
      return;
    }

    async function verifyToken(): Promise<void> {
      try {
        const response = await axios.get(
          `${API_URL}/api/auth/verify-reset-token?token=${token}`
        );
        const data = response.data;

        if (!response.data.success) {
          setError(data.detail || "Invalid or expired reset link");
          setIsValid(false);
        } else {
          setEmail(data.data.email);
          setIsValid(true);
        }
      } catch (error: unknown) {
        const axiosError = error as {
          response?: { data?: { detail?: string } };
        };
        setError(
          axiosError.response?.data?.detail || "Failed to verify reset link"
        );
        setIsValid(false);
      } finally {
        setIsLoading(false);
      }
    }

    verifyToken();
  }, [token]);

  function validatePassword(pwd: string): string | null {
    if (pwd.length < 8) return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(pwd)) return "Must contain uppercase letter";
    if (!/[a-z]/.test(pwd)) return "Must contain lowercase letter";
    if (!/[0-9]/.test(pwd)) return "Must contain number";
    return null;
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();

    const passwordError = validatePassword(password);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await axios.post(`${API_URL}/api/auth/reset-password`, {
        token,
        new_password: password,
      });

      const data = response.data;

      if (!response.data.success) {
        toast.error(data.detail || "Failed to reset password");
        return;
      }

      toast.success("Password reset successfully. Please log in.");
      router.push("/login");
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      toast.error(
        axiosError.response?.data?.detail ||
          "An error occurred. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Spinner />
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-4">
        <div className="w-full max-w-md">
          <div className="rounded-lg border border-neutral-200 bg-white">
            <div className="px-8 py-10">
              <div className="mb-6">
                <h1 className="mb-2 text-2xl font-semibold text-neutral-900">
                  Invalid reset link
                </h1>
                <p className="text-[14px] text-neutral-500">{error}</p>
              </div>
              <div className="space-y-3 text-center">
                <p className="text-[14px] text-neutral-600">
                  This reset link may have expired or already been used.
                </p>
                <div className="flex flex-col gap-3 pt-2">
                  <Link href="/forgot-password">
                    <Button className="h-9 w-full rounded-none bg-black px-5 text-[14px] font-medium text-white hover:bg-neutral-800">
                      Request new reset link
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button
                      variant="outline"
                      className="h-9 w-full rounded-none border-neutral-200 text-[14px] font-medium text-neutral-900 hover:bg-neutral-50"
                    >
                      Back to login
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-neutral-200 bg-white">
          <div className="px-8 py-10">
            <div className="mb-8">
              <h1 className="mb-2 text-2xl font-semibold text-neutral-900">
                Reset your password
              </h1>
              <p className="text-[14px] text-neutral-500">
                Enter your new password below
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-[13px] font-medium text-neutral-700"
                >
                  Email address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  readOnly
                  className="h-9 border-neutral-200 bg-neutral-50 text-[14px] text-neutral-900 cursor-default"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-[13px] font-medium text-neutral-700"
                >
                  New password
                </Label>
                <PasswordInput
                  id="password"
                  placeholder="Enter your new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  required
                  className="h-9 border-neutral-200 bg-white text-[14px] text-neutral-900 placeholder:text-neutral-400"
                />
                <p className="text-[12px] text-neutral-500">
                  At least 8 characters with uppercase, lowercase, and number
                </p>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="confirmPassword"
                  className="text-[13px] font-medium text-neutral-700"
                >
                  Confirm password
                </Label>
                <PasswordInput
                  id="confirmPassword"
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSubmitting}
                  required
                  className="h-9 border-neutral-200 bg-white text-[14px] text-neutral-900 placeholder:text-neutral-400"
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="mt-6 h-9 w-full rounded-none bg-black px-5 text-[14px] font-medium text-white hover:bg-neutral-800"
              >
                {isSubmitting ? <Spinner /> : "Reset password"}
              </Button>
            </form>

            <div className="mt-6 border-t border-neutral-100 pt-6">
              <p className="text-center text-[14px] text-neutral-600">
                <Link
                  href="/login"
                  className="font-medium text-neutral-900 hover:text-neutral-700 transition-colors"
                >
                  Back to login
                </Link>
              </p>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-[13px] text-neutral-500">
          Your password will be updated securely
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
