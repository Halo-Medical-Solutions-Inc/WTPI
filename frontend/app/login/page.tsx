"use client";

import { useState, FormEvent, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PasswordInput from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { PageSpinner } from "@/components/ui/page-spinner";
import { useAppDispatch, useAppSelector } from "@/store";
import { login, clearError } from "@/store/slices/auth-slice";

const VALID_REDIRECT_PATHS = [
  "/dashboard",
  "/search",
  "/practice-settings",
  "/account-settings",
];

function getValidRedirect(redirect: string | null): string {
  if (!redirect) return "/dashboard";
  const path = decodeURIComponent(redirect).split("?")[0];
  if (VALID_REDIRECT_PATHS.includes(path)) return redirect;
  return "/dashboard";
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const { isAuthenticated, loading } = useAppSelector((state) => state.auth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [contactAdminOpen, setContactAdminOpen] = useState(false);

  const redirectUrl = getValidRedirect(searchParams.get("redirect"));

  useEffect(() => {
    if (isAuthenticated) {
      router.push(redirectUrl);
    }
  }, [isAuthenticated, router, redirectUrl]);

  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      await dispatch(login({ email, password })).unwrap();
    } catch (err: unknown) {
      const error = err as string;
      toast.error(error || "Login failed");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-neutral-200 bg-white">
          <div className="px-8 py-10">
            <div className="mb-8">
              <h1 className="mb-2 text-2xl font-semibold text-neutral-900">
                Welcome back
              </h1>
              <p className="text-[14px] text-neutral-500">
                Sign in to West Texas Pain Institute
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
                  disabled={loading}
                  required
                  className="h-9 border-neutral-200 bg-white text-[14px] text-neutral-900 placeholder:text-neutral-400"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="password"
                    className="text-[13px] font-medium text-neutral-700"
                  >
                    Password
                  </Label>
                  <Link
                    href="/forgot-password"
                    className="text-[13px] text-neutral-500 hover:text-neutral-700 transition-colors"
                  >
                    Forgot?
                  </Link>
                </div>
                <PasswordInput
                  id="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                  className="h-9 border-neutral-200 bg-white text-[14px] text-neutral-900 placeholder:text-neutral-400"
                />
              </div>

              <Button
                type="submit"
                disabled={loading || !email || !password}
                className="mt-6 h-9 w-full rounded-none bg-black px-5 text-[14px] font-medium text-white hover:bg-neutral-800"
              >
                {loading ? <Spinner /> : "Sign in"}
              </Button>
            </form>

            <div className="mt-6 border-t border-neutral-100 pt-6">
              <p className="text-center text-[14px] text-neutral-600">
                Need an account?{" "}
                <button
                  type="button"
                  onClick={() => setContactAdminOpen(true)}
                  className="font-medium text-neutral-900 hover:text-neutral-700 transition-colors"
                >
                  Contact your administrator
                </button>
              </p>
            </div>

            <Dialog open={contactAdminOpen} onOpenChange={setContactAdminOpen}>
              <DialogContent className="max-w-md border-neutral-200 bg-white">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-semibold text-neutral-900">
                    Need an account?
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <p className="text-[14px] text-neutral-500">
                    Request an invitation to get started.
                  </p>
                  <p className="text-[14px] text-neutral-900">
                    Email Mandika Swartz at{" "}
                    <a
                      href="mailto:mandika@halohealth.app"
                      className="font-semibold text-neutral-900 hover:text-neutral-700"
                    >
                      mandika@halohealth.app
                    </a>{" "}
                    to receive an invitation link.
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <p className="mt-6 text-center text-[13px] text-neutral-500">
          Protected by bank-level encryption and HIPAA compliance
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <LoginContent />
    </Suspense>
  );
}
