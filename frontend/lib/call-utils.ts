import { format } from "date-fns";

import { Call, CallStatus } from "@/types/call";

export function formatCommentTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Date.now() - date.getTime() < 60000) return "Just now";
  return format(date, "MMM d, h:mm a");
}


export function formatCallDuration(
  startTime: string | null,
  endTime: string | null
): string {
  if (!startTime || !endTime) return "—";

  const start = new Date(startTime);
  const end = new Date(endTime);
  const durationMs = end.getTime() - start.getTime();
  const durationSeconds = Math.floor(durationMs / 1000);

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;

  return `${minutes}m ${seconds}s`;
}

export function formatCallTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatCallTimeWithDate(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatCallDateTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatCallDateTimeShort(timestamp: string): string {
  const date = new Date(timestamp);
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const y = String(date.getFullYear()).slice(-2);
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${m}/${d}/${y}, ${time}`;
}

export function getStatusColor(status: CallStatus): string {
  switch (status) {
    case CallStatus.IN_PROGRESS:
      return "bg-blue-100 text-blue-700 border-blue-200";
    case CallStatus.COMPLETED:
      return "bg-green-100 text-green-700 border-green-200";
    case CallStatus.QUEUED:
      return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case CallStatus.FAILED:
      return "bg-red-100 text-red-700 border-red-200";
    case CallStatus.ABANDONED:
      return "bg-gray-100 text-gray-700 border-gray-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

export function getStatusLabel(status: CallStatus): string {
  switch (status) {
    case CallStatus.IN_PROGRESS:
      return "In Progress";
    case CallStatus.COMPLETED:
      return "Completed";
    case CallStatus.QUEUED:
      return "Queued";
    case CallStatus.FAILED:
      return "Failed";
    case CallStatus.ABANDONED:
      return "Abandoned";
    default:
      return status;
  }
}

type StatusFilter = "all" | "in_progress" | "reviewed" | "unreviewed";

export function filterCallsByStatus(
  calls: Call[],
  filter: StatusFilter
): Call[] {
  switch (filter) {
    case "all":
      return calls;
    case "in_progress":
      return calls.filter(
        (call) =>
          call.status === CallStatus.IN_PROGRESS ||
          call.status === CallStatus.QUEUED
      );
    case "reviewed":
      return calls.filter((call) => call.is_reviewed);
    case "unreviewed":
      return calls.filter(
        (call) => !call.is_reviewed && call.status === CallStatus.COMPLETED
      );
    default:
      return calls;
  }
}

export function getCallStatusCounts(calls: Call[]) {
  return {
    all: calls.length,
    in_progress: calls.filter(
      (call) =>
        call.status === CallStatus.IN_PROGRESS ||
        call.status === CallStatus.QUEUED
    ).length,
    reviewed: calls.filter((call) => call.is_reviewed).length,
    unreviewed: calls.filter(
      (call) => !call.is_reviewed && call.status === CallStatus.COMPLETED
    ).length,
  };
}

export function formatPhoneNumber(phone: string | null): string {
  if (!phone) return "—";

  const cleaned = phone.replace(/\D/g, "");

  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    const areaCode = cleaned.slice(1, 4);
    const prefix = cleaned.slice(4, 7);
    const suffix = cleaned.slice(7, 11);
    return `(${areaCode}) ${prefix}-${suffix}`;
  }

  if (cleaned.length === 10) {
    const areaCode = cleaned.slice(0, 3);
    const prefix = cleaned.slice(3, 6);
    const suffix = cleaned.slice(6, 10);
    return `(${areaCode}) ${prefix}-${suffix}`;
  }

  return phone;
}

export type PrimaryIntent =
  | "appointment"
  | "prescription_refill"
  | "test_results"
  | "referral_request"
  | "medical_records"
  | "billing_insurance"
  | "speak_to_staff"
  | "report_symptoms"
  | "prior_authorization"
  | "spam"
  | "other"
  | "not_provided";

export function getPrimaryIntentCategory(
  primaryIntent: string | null | undefined
): PrimaryIntent {
  if (!primaryIntent) return "not_provided";

  const intent = primaryIntent.toLowerCase();

  if (intent.includes("appointment")) return "appointment";
  if (intent.includes("prescription") || intent.includes("refill")) return "prescription_refill";
  if (intent.includes("test") || intent.includes("result")) return "test_results";
  if (intent.includes("referral")) return "referral_request";
  if (intent.includes("medical record")) return "medical_records";
  if (intent.includes("billing") || intent.includes("insurance")) return "billing_insurance";
  if (intent.includes("speak") || intent.includes("staff")) return "speak_to_staff";
  if (intent.includes("symptom")) return "report_symptoms";
  if (intent.includes("prior") || intent.includes("authorization")) return "prior_authorization";
  if (intent.includes("spam") || intent.includes("wrong")) return "spam";
  if (intent.includes("other")) return "other";

  return "not_provided";
}

export const PRIMARY_INTENT_LABELS: Record<PrimaryIntent, string> = {
  appointment: "Appointments",
  prescription_refill: "Prescription Refills",
  test_results: "Test Results",
  referral_request: "Referral Requests",
  medical_records: "Medical Records",
  billing_insurance: "Billing/Insurance",
  speak_to_staff: "Speak to Staff",
  report_symptoms: "Report Symptoms",
  prior_authorization: "Prior Authorization",
  spam: "Spam/Wrong Number",
  other: "Other",
  not_provided: "Uncategorized",
};

export const PRIMARY_INTENT_ORDER: PrimaryIntent[] = [
  "appointment",
  "prescription_refill",
  "test_results",
  "referral_request",
  "medical_records",
  "billing_insurance",
  "speak_to_staff",
  "report_symptoms",
  "prior_authorization",
  "spam",
  "other",
  "not_provided",
];

export interface TransferInfo {
  wasTransferred: boolean;
  destination?: string;
  extension?: string;
  destinationLabel?: string;
}

interface VapiToolCall {
  function?: {
    name?: string;
    arguments?: string;
  };
}

interface VapiMessage {
  role?: string;
  toolCalls?: VapiToolCall[];
}

interface VapiDataWithMessages {
  endedReason?: string;
  artifact?: {
    messages?: VapiMessage[];
  };
  messages?: VapiMessage[];
}

const EXTENSION_LABELS: Record<string, string> = {};

const PHONE_NUMBER_LABELS: Record<string, string> = {
  "9153134443": "West Texas Pain Institute",
  "19153134443": "West Texas Pain Institute",
  "9156212512": "West Texas Pain Institute (AI Line)",
  "19156212512": "West Texas Pain Institute (AI Line)",
};

export function extractTransferInfo(vapiData: unknown): TransferInfo {
  if (!vapiData) return { wasTransferred: false };

  const data = vapiData as VapiDataWithMessages;
  const wasTransferred = data.endedReason === "assistant-forwarded-call";

  if (!wasTransferred) return { wasTransferred: false };

  const messages = data.artifact?.messages || data.messages || [];
  const transferCall = messages.find(
    (m) =>
      m.role === "tool_calls" &&
      m.toolCalls?.some((tc) => tc.function?.name === "transfer_call_tool")
  );

  if (transferCall?.toolCalls?.[0]?.function?.arguments) {
    try {
      const args = JSON.parse(transferCall.toolCalls[0].function.arguments);
      const destinationParts = (args.destination || "").split(",");
      const number = destinationParts[0] || "";
      const extension = destinationParts[1] || "";
      const normalizedNumber = number.replace(/\D/g, "");
      const phoneLabel =
        PHONE_NUMBER_LABELS[normalizedNumber] ??
        PHONE_NUMBER_LABELS[normalizedNumber.slice(-10)];
      const extensionLabel = extension
        ? EXTENSION_LABELS[extension] || `Ext ${extension}`
        : null;
      const destinationLabel =
        extensionLabel ?? phoneLabel ?? "Mainline";

      return {
        wasTransferred: true,
        destination: number,
        extension: extension || undefined,
        destinationLabel,
      };
    } catch {
      return { wasTransferred: true, destinationLabel: "Unknown" };
    }
  }

  return { wasTransferred: true, destinationLabel: "Unknown" };
}
