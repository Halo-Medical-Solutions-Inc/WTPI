"use client";

import { useEffect, useState, ReactNode } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

import { useAppDispatch, useAppSelector } from "@/store";
import { getCurrentUser } from "@/store/slices/auth-slice";
import { PageSpinner } from "@/components/ui/page-spinner";

const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/accept-invitation",
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const [isInitialized, setIsInitialized] = useState(false);

  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  useEffect(() => {
    async function initialize(): Promise<void> {
      const token = localStorage.getItem("access_token");

      if (!token) {
        setIsInitialized(true);
        return;
      }

      try {
        await dispatch(getCurrentUser()).unwrap();
      } catch {
      } finally {
        setIsInitialized(true);
      }
    }

    initialize();
  }, [dispatch]);

  useEffect(() => {
    if (isInitialized && !isAuthenticated && !isPublicPath) {
      const currentUrl = searchParams.toString()
        ? `${pathname}?${searchParams.toString()}`
        : pathname;
      const redirectParam = encodeURIComponent(currentUrl);
      router.push(`/login?redirect=${redirectParam}`);
    }
  }, [isInitialized, isAuthenticated, isPublicPath, router, pathname, searchParams]);

  if (!isInitialized) {
    return <PageSpinner />;
  }

  if (!isAuthenticated && !isPublicPath) {
    return <PageSpinner />;
  }

  if (isAuthenticated && !user && !isPublicPath) {
    return <PageSpinner />;
  }

  return <>{children}</>;
}
