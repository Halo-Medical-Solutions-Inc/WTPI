"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { Spinner } from "@/components/ui/spinner";

export default function TeamSettingsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/practice-settings");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner />
    </div>
  );
}
