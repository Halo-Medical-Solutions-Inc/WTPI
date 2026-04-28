"use client";

import React from "react";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { CheckCircle2, Circle, CircleAlert, Loader2, User as UserIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatCallTime,
  formatPhoneNumber,
} from "@/lib/call-utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Call, CallStatus, ExtractionStatus } from "@/types/call";
import { User } from "@/types/user";

function getReviewerLabel(reviewedBy: string | null, users: User[]): string {
  if (!reviewedBy) return "Halo";
  const reviewer = users.find((u) => u.id === reviewedBy);
  if (!reviewer) return "Reviewed";
  const firstName = reviewer.full_name.split(/\s+/)[0];
  return firstName || "Reviewed";
}

interface CallsTableProps {
  calls: Call[];
  onSelectCall: (call: Call) => void;
  loading?: boolean;
  onToggleReview?: (callId: string, isReviewed: boolean) => Promise<void>;
  isPanelOpen?: boolean;
  callRowRefs?: React.MutableRefObject<
    Record<string, HTMLTableRowElement | null>
  >;
  selectedCallId?: string | null;
  showDate?: boolean;
  users?: User[];
}

interface CallsByDate {
  dateKey: string;
  dateLabel: string;
  calls: Call[];
}

function getDateLabel(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) {
    return "Today";
  }
  if (isYesterday(date)) {
    return "Yesterday";
  }
  return format(date, "EEEE, MMMM d, yyyy");
}

function getDateKey(createdAt: string): string {
  const date = parseISO(createdAt);
  return format(date, "yyyy-MM-dd");
}

function groupCallsByDate(calls: Call[]): CallsByDate[] {
  const sortedCalls = [...calls].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const groups: Map<string, Call[]> = new Map();

  for (const call of sortedCalls) {
    const dateKey = getDateKey(call.created_at);
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(call);
  }

  const result: CallsByDate[] = [];
  for (const [dateKey, dateCalls] of groups) {
    result.push({
      dateKey,
      dateLabel: getDateLabel(dateCalls[0].created_at),
      calls: dateCalls,
    });
  }

  return result;
}

export function CallsTable({
  calls,
  onSelectCall,
  loading = false,
  onToggleReview,
  isPanelOpen = false,
  callRowRefs,
  selectedCallId,
  showDate = true,
  users = [],
}: CallsTableProps) {
  const getCallerName = (call: Call): string => {
    return call.display_data?.patient_name || call.display_data?.caller_name || "Unknown";
  };

  const getPhoneNumber = (call: Call): string => {
    return call.display_data?.phone_number || "";
  };

  const getDuration = (call: Call): string => {
    const durationSeconds = call.display_data?.duration_seconds;
    if (
      durationSeconds === undefined ||
      durationSeconds === null ||
      durationSeconds === 0
    )
      return "";
    if (durationSeconds < 60) {
      return `${Math.round(durationSeconds)}s`;
    }
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = Math.round(durationSeconds % 60);
    return `${minutes}m ${seconds}s`;
  };

  const getPriority = (call: Call): string => {
    return call.extraction_data?.priority || call.display_data?.priority || "";
  };

  const getSummary = (call: Call): string => {
    return call.display_data?.summary || "No summary available";
  };

  const isExtractionPending = (call: Call): boolean => {
    return (
      call.extraction_status === ExtractionStatus.PENDING ||
      call.extraction_status === ExtractionStatus.IN_PROGRESS
    );
  };

  const isExtractionFailed = (call: Call): boolean => {
    return call.extraction_status === ExtractionStatus.FAILED;
  };

  const getCallerType = (call: Call): string => {
    return call.display_data?.caller_affiliation || "Unknown";
  };

  const getPriorityIndicator = (priority: string, call?: Call): string => {
    if (call?.extraction_data?.auto_review) {
      return "bg-sky-400";
    }
    const p = priority?.toLowerCase() || "low";
    switch (p) {
      case "high":
      case "critical":
        return "bg-red-500";
      case "medium":
        return "bg-amber-500";
      case "low":
      default:
        return "bg-emerald-500";
    }
  };


  const getCallerTypeBadgeColor = (type: string): string => {
    const t = type?.toLowerCase() || "unknown";
    switch (t) {
      case "patient":
        return "text-blue-700 border-blue-700";
      case "family member":
        return "text-green-700 border-green-700";
      case "caregiver":
        return "text-emerald-700 border-emerald-700";
      case "pharmacy":
        return "text-purple-700 border-purple-700";
      case "other provider":
        return "text-violet-700 border-violet-700";
      case "hospital":
        return "text-red-700 border-red-700";
      case "insurance":
        return "text-amber-700 border-amber-700";
      case "doctor":
      case "physician":
        return "text-indigo-700 border-indigo-700";
      case "nurse":
        return "text-cyan-700 border-cyan-700";
      case "other":
        return "text-orange-700 border-orange-700";
      case "not provided":
      case "unknown":
      default:
        return "text-slate-700 border-slate-700";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm font-medium text-neutral-900">No calls found</p>
        <p className="mt-1 text-sm text-neutral-500">
          Calls will appear here as they come in
        </p>
      </div>
    );
  }

  const { isMobile } = useIsMobile();
  const groupedCalls = groupCallsByDate(calls);

  if (isMobile) {
    return (
      <div className="space-y-3">
        {groupedCalls.map((group) => (
          <div key={group.dateKey}>
            <div className="px-1 py-2">
              <span className="text-[13px] font-semibold text-neutral-700">
                {group.dateLabel}
              </span>
              <span className="ml-1.5 text-[13px] font-normal text-neutral-500">
                ({group.calls.length})
              </span>
            </div>
            <div className="space-y-2">
              {group.calls.map((call) => {
                const patientName = getCallerName(call);
                const phoneNumber = getPhoneNumber(call);
                const duration = getDuration(call);
                const priority = getPriority(call);
                const summary = getSummary(call);
                const timeStr = formatCallTime(call.created_at);
                const isInProgress = call.status === CallStatus.IN_PROGRESS;

                return (
                  <div
                    key={call.id}
                    onClick={() => {
                      if (!isInProgress) onSelectCall(call);
                    }}
                    className={cn(
                      "rounded-lg border border-neutral-200 bg-white px-4 py-3",
                      isInProgress
                        ? "opacity-60"
                        : "cursor-pointer active:bg-neutral-50",
                      selectedCallId === call.id && isPanelOpen && "border-neutral-400 bg-neutral-50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="mt-1.5 shrink-0">
                          {isInProgress ? (
                            <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                          ) : (
                            <div
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                getPriorityIndicator(priority || "low", call)
                              )}
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[14px] font-medium text-neutral-900 truncate">
                            {patientName}
                          </p>
                          {phoneNumber && (
                            <p className="text-[13px] text-neutral-500 tabular-nums">
                              {formatPhoneNumber(phoneNumber)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[13px] text-neutral-900">{timeStr}</p>
                        {duration && (
                          <p className="text-[12px] text-neutral-500">{duration}</p>
                        )}
                      </div>
                    </div>
                    {isExtractionPending(call) ? (
                      <div className="mt-2 flex items-center gap-1.5 text-[13px] text-neutral-500">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Generating summary...</span>
                      </div>
                    ) : isExtractionFailed(call) ? (
                      <p className="mt-2 text-[13px] text-red-600">
                        Failed to generate summary
                      </p>
                    ) : (
                      <p className="mt-2 line-clamp-2 text-[13px] text-neutral-600">
                        {summary}
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <div />
                      {!isInProgress && call.is_flagged ? (
                        <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                          <CircleAlert className="h-3 w-3" />
                          Flagged
                        </span>
                      ) : !isInProgress && call.is_reviewed ? (
                        <span className="inline-flex items-center gap-1 rounded bg-green-900 px-2 py-0.5 text-[11px] font-medium text-white">
                          <CheckCircle2 className="h-3 w-3" />
                          {getReviewerLabel(call.reviewed_by, users)}
                        </span>
                      ) : !isInProgress ? (
                        <span className="inline-flex items-center gap-1 rounded border border-neutral-200 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                          <Circle className="h-3 w-3" strokeWidth={2} />
                          Review
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-200 overflow-hidden bg-white">
      <Table>
        <TableHeader>
          <TableRow className="border-neutral-200 bg-neutral-50">
            <TableHead className="w-6 px-4 py-3"></TableHead>
            <TableHead className="text-[13px] font-medium text-neutral-600 px-4 py-3">
              Caller
            </TableHead>
            <TableHead className="text-[13px] font-medium text-neutral-600 px-4 py-3">
              {showDate ? "Date & Duration" : "Time & Duration"}
            </TableHead>
            <TableHead className="text-[13px] font-medium text-neutral-600 px-4 py-3">
              Details
            </TableHead>
            <TableHead className="w-8 px-4 py-3" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupedCalls.map((group, groupIndex) => (
            <React.Fragment key={group.dateKey}>
              <TableRow
                className={cn(
                  "bg-neutral-50 hover:bg-neutral-50",
                  groupIndex === 0
                    ? "border-b border-neutral-200"
                    : "border-t border-b border-neutral-200"
                )}
              >
                <TableCell colSpan={5} className="px-4 py-2">
                  <span className="text-[13px] font-semibold text-neutral-700">
                    {group.dateLabel}
                  </span>
                  <span className="ml-1.5 text-[13px] font-normal text-neutral-500">
                    ({group.calls.length})
                  </span>
                </TableCell>
              </TableRow>
              {group.calls.map((call) => {
                const patientName = getCallerName(call);
                const phoneNumber = getPhoneNumber(call);
                const duration = getDuration(call);
                const priority = getPriority(call);
                const callerType = getCallerType(call);
                const summary = getSummary(call);
                const timeStr = formatCallTime(call.created_at);

                return (
                  <TableRow
                    key={call.id}
                    ref={(el) => {
                      if (callRowRefs) {
                        callRowRefs.current[call.id] = el;
                      }
                    }}
                    onClick={() => {
                      if (call.status !== CallStatus.IN_PROGRESS) {
                        onSelectCall(call);
                      }
                    }}
                    className={cn(
                      "transition-colors border-neutral-50 group align-middle",
                      call.status === CallStatus.IN_PROGRESS
                        ? "opacity-60 cursor-default"
                        : "cursor-pointer hover:bg-neutral-50",
                      selectedCallId === call.id && isPanelOpen && "bg-neutral-100"
                    )}
                  >
                    <TableCell className="w-6 px-4 py-4">
                      {call.status === CallStatus.IN_PROGRESS ? (
                        <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                      ) : (
                        <div
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            getPriorityIndicator(priority || "low", call)
                          )}
                        />
                      )}
                    </TableCell>

                    <TableCell className="px-4 py-4 w-40">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-[14px] font-medium text-neutral-900 truncate">
                          {patientName}
                        </span>
                        {phoneNumber && (
                          <span className="text-[13px] text-neutral-600 truncate">
                            {formatPhoneNumber(phoneNumber)}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="px-4 py-4 w-40">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[13px] text-neutral-900">
                          {timeStr}
                        </span>
                        <span className="text-[12px] text-neutral-500">
                          {duration || "—"}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="px-4 py-4 max-w-0">
                      <div className="flex flex-col gap-1.5 min-w-0 w-full">
                        <div className="flex items-center gap-2 min-w-0">
                          {callerType && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-medium flex-shrink-0 flex items-center gap-1",
                                getCallerTypeBadgeColor(callerType),
                                isPanelOpen && "max-w-[80px]"
                              )}
                            >
                              <UserIcon className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">
                                {callerType.charAt(0).toUpperCase() +
                                  callerType.slice(1).toLowerCase()}
                              </span>
                            </Badge>
                          )}
                        </div>
                        {isExtractionPending(call) ? (
                          <div className="flex items-center gap-1.5 text-[13px] text-neutral-500">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Generating summary...</span>
                          </div>
                        ) : isExtractionFailed(call) ? (
                          <p className="text-[13px] text-red-600">
                            Failed to generate summary
                          </p>
                        ) : (
                          <p
                            className={cn(
                              "text-[13px] text-neutral-600 min-w-0 w-full overflow-hidden",
                              isPanelOpen ? "truncate" : "line-clamp-2"
                            )}
                          >
                            {summary}
                          </p>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="px-4 py-4 align-middle">
                      {!isPanelOpen && call.status !== CallStatus.IN_PROGRESS && (
                        <div className="flex justify-end items-center gap-2">
                          {call.is_flagged ? (
                            <div className="px-3 py-1.5 border border-amber-300 bg-amber-50 text-[12px] font-medium inline-flex items-center gap-1.5 text-amber-700">
                              <CircleAlert className="h-3.5 w-3.5" />
                              <span>Flagged</span>
                            </div>
                          ) : onToggleReview ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleReview(call.id, !call.is_reviewed);
                              }}
                              className={cn(
                                "px-3 py-1.5 border text-[12px] font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer",
                                call.is_reviewed
                                  ? "bg-green-900 border-green-900 text-white hover:bg-green-950"
                                  : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                              )}
                              title={call.is_reviewed ? "Mark as unreviewed" : "Mark as reviewed"}
                            >
                              {call.is_reviewed ? (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  <span>{getReviewerLabel(call.reviewed_by, users)}</span>
                                </>
                              ) : (
                                <>
                                  <Circle className="h-3.5 w-3.5" strokeWidth={2} />
                                  <span>Review</span>
                                </>
                              )}
                            </button>
                          ) : null}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>

      {calls.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm font-medium text-neutral-900">No calls found</p>
          <p className="mt-1 text-sm text-neutral-500">
            Calls will appear here as they come in
          </p>
        </div>
      )}
    </div>
  );
}
