"use client";

import { useState } from "react";
import Link from "next/link";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();

    if (!email) {
      toast.error("Please enter your email address");
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/auth/forgot-password`, {
        email,
      });
      const data = response.data;

      if (data.data?.dev_reset_link) {
        toast.success("Reset link generated (dev mode)", {
          description: "Copy the reset link below",
          action: {
            label:
              copiedLink === data.data.dev_reset_link ? "Copied!" : "Copy Link",
            onClick: async () => {
              try {
                await navigator.clipboard.writeText(data.data.dev_reset_link);
                setCopiedLink(data.data.dev_reset_link);
                setTimeout(() => setCopiedLink(null), 2000);
              } catch {
                toast.error("Failed to copy link");
              }
            },
          },
        });

        toast.info(data.data.dev_reset_link, { duration: 10000 });
        setIsSubmitted(false);
      } else {
        toast.success(
          "If an account exists, a reset link has been sent to your email."
        );
        setIsSubmitted(true);
      }
    } catch (error: unknown) {
      const axiosError = error as {
        response?: { status?: number; data?: { detail?: string } };
      };
      if (axiosError.response?.status === 429) {
        toast.error("Too many reset requests. Please try again in 1 hour.");
      } else {
        toast.error(
          axiosError.response?.data?.detail || "Failed to send reset link"
        );
      }
    } finally {
      setIsLoading(false);
    }
  }

  if (isSubmitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-4">
        <div className="w-full max-w-md">
          <div className="rounded-lg border border-neutral-200 bg-white">
            <div className="px-8 py-10">
              <div className="mb-6">
                <h1 className="mb-2 text-2xl font-semibold text-neutral-900">
                  Check your email
                </h1>
                <p className="text-[14px] text-neutral-500">
                  If an account exists with that email, we&apos;ve sent a
                  password reset link.
                </p>
              </div>
              <div className="space-y-3">
                <p className="text-[14px] text-neutral-600">
                  Check your inbox and follow the link to reset your password.
                </p>
                <Link href="/login" className="block">
                  <Button className="h-9 w-full rounded-none bg-black px-5 text-[14px] font-medium text-white hover:bg-neutral-800">
                    Back to login
                  </Button>
                </Link>
              </div>
            </div>
          </div>
          <p className="mt-6 text-center text-[13px] text-neutral-500">
            Didn&apos;t receive an email? Check your spam folder or try again.
          </p>
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
                Enter your email address and we&apos;ll send you a reset link
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
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                  className="h-9 border-neutral-200 bg-white text-[14px] text-neutral-900 placeholder:text-neutral-400"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="mt-6 h-9 w-full rounded-none bg-black px-5 text-[14px] font-medium text-white hover:bg-neutral-800"
              >
                {isLoading ? <Spinner /> : "Send reset link"}
              </Button>
            </form>

            <div className="mt-6 border-t border-neutral-100 pt-6">
              <p className="text-center text-[14px] text-neutral-600">
                Remember your password?{" "}
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
          We&apos;ll send a secure reset link to your email address
        </p>
      </div>
    </div>
  );
}
