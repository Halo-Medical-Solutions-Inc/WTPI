"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PasswordInput from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { PageSpinner } from "@/components/ui/page-spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { setTokens, getCurrentUser } from "@/store/slices/auth-slice";
import { useAppDispatch } from "@/store";
import { InvitationVerifyResponse } from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const MIN_PASSWORD_LENGTH = 8;

const TIMEZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Phoenix",
  "Pacific/Honolulu",
  "America/Anchorage",
];

function AcceptInvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const token = searchParams.get("token");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [region, setRegion] = useState("America/Los_Angeles");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [verificationStatus, setVerificationStatus] =
    useState<InvitationVerifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    async function verifyToken(): Promise<void> {
      try {
        const response = await axios.get(
          `${API_URL}/api/invitations/verify?token=${token}`
        );
        const data = response.data;

        if (data.success && data.data) {
          setVerificationStatus(data.data);
        } else {
          setError("Invalid invitation token");
        }
      } catch (err: unknown) {
        const axiosError = err as { response?: { data?: { detail?: string } } };
        setError(
          axiosError.response?.data?.detail || "Failed to verify invitation"
        );
      } finally {
        setLoading(false);
      }
    }

    verifyToken();
  }, [token]);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();

    if (!fullName || !password || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
      );
      return;
    }

    if (!token) {
      toast.error("Invalid invitation link");
      return;
    }

    setSubmitting(true);
    try {
      const response = await axios.post(`${API_URL}/api/invitations/accept`, {
        token,
        full_name: fullName,
        password,
        region,
      });

      const data = response.data;

      if (data.success && data.data) {
        localStorage.setItem("access_token", data.data.access_token);
        localStorage.setItem("refresh_token", data.data.refresh_token);
        dispatch(
          setTokens({
            accessToken: data.data.access_token,
            refreshToken: data.data.refresh_token,
          })
        );
        await dispatch(getCurrentUser()).unwrap();
        toast.success("Welcome to the team!");
        router.push("/dashboard");
      } else {
        toast.error(data.message || "Failed to accept invitation");
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } } };
      toast.error(
        axiosError.response?.data?.detail || "Failed to accept invitation"
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-4">
        <div className="w-full max-w-md">
          <div className="rounded-lg border border-neutral-200 bg-white">
            <div className="px-8 py-10">
              <div className="mb-6">
                <h1 className="mb-2 text-2xl font-semibold text-neutral-900">
                  Invitation error
                </h1>
                <p className="text-[14px] text-neutral-500">
                  Unable to process invitation
                </p>
              </div>
              <div className="space-y-3">
                <p className="text-[14px] text-neutral-600">
                  This invitation link is not valid.
                </p>
                <p className="text-[13px] text-neutral-500">
                  Please contact your administrator for a new invitation link.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Spinner />
      </div>
    );
  }

  if (verificationStatus && !verificationStatus.valid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-4">
        <div className="w-full max-w-md">
          <div className="rounded-lg border border-neutral-200 bg-white">
            <div className="px-8 py-10">
              <div className="mb-6">
                <h1 className="mb-2 text-2xl font-semibold text-neutral-900">
                  Invitation error
                </h1>
                <p className="text-[14px] text-neutral-500">
                  Unable to process invitation
                </p>
              </div>
              <div className="space-y-3">
                <p className="text-[14px] text-neutral-600">
                  This invitation has expired or has already been used.
                </p>
                <p className="text-[13px] text-neutral-500">
                  Please contact your administrator for a new invitation link.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-4">
        <div className="w-full max-w-md">
          <div className="rounded-lg border border-neutral-200 bg-white">
            <div className="px-8 py-10">
              <div className="mb-6">
                <h1 className="mb-2 text-2xl font-semibold text-neutral-900">
                  Invitation error
                </h1>
                <p className="text-[14px] text-neutral-500">
                  Unable to process invitation
                </p>
              </div>
              <div className="space-y-3">
                <p className="text-[14px] text-neutral-600">{error}</p>
                <p className="text-[13px] text-neutral-500">
                  Please contact your administrator for a new invitation link.
                </p>
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
                Accept invitation
              </h1>
              <p className="text-[14px] text-neutral-500">
                Create your account to join West Texas Pain Institute
              </p>
            </div>

            <div className="mb-6 rounded-lg border border-neutral-100 bg-neutral-50 p-4">
              <div className="mb-3 flex items-center justify-between pb-3 border-b border-neutral-100">
                <span className="text-[13px] font-medium text-neutral-600">
                  Email
                </span>
                <span className="text-[13px] font-medium text-neutral-900">
                  {verificationStatus?.email || "example@westtexaspain.com"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-neutral-600">
                  Role
                </span>
                {verificationStatus?.role === "ADMIN" ||
                verificationStatus?.role === "SUPER_ADMIN" ? (
                  <Badge className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50">
                    Admin
                  </Badge>
                ) : (
                  <Badge className="border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-50">
                    Staff
                  </Badge>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="fullName"
                  className="text-[13px] font-medium text-neutral-700"
                >
                  Full name
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  required
                  disabled={submitting}
                  className="h-9 border-neutral-200 bg-white text-[14px] text-neutral-900 placeholder:text-neutral-400"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-[13px] font-medium text-neutral-700"
                >
                  Password
                </Label>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters, uppercase, lowercase, number"
                  required
                  disabled={submitting}
                  className="h-9 border-neutral-200 bg-white text-[14px] text-neutral-900 placeholder:text-neutral-400"
                />
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
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  disabled={submitting}
                  className="h-9 border-neutral-200 bg-white text-[14px] text-neutral-900 placeholder:text-neutral-400"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="timezone"
                  className="text-[13px] font-medium text-neutral-700"
                >
                  Timezone
                </Label>
                <Select
                  value={region}
                  onValueChange={setRegion}
                  disabled={submitting}
                >
                  <SelectTrigger
                    id="timezone"
                    className="h-9 border-neutral-200 bg-white text-[14px] text-neutral-900"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz} className="text-[14px]">
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="mt-6 h-9 w-full rounded-none bg-black px-5 text-[14px] font-medium text-white hover:bg-neutral-800"
              >
                {submitting ? <Spinner /> : "Accept Invitation"}
              </Button>
            </form>

            <div className="mt-6 border-t border-neutral-100 pt-6">
              <p className="text-center text-[13px] text-neutral-500">
                Your account will be created with the credentials above
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <AcceptInvitationContent />
    </Suspense>
  );
}
