"use client";

import { useCallback, useEffect, useState } from "react";

import {
  AlertCircle,
  Archive,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Circle,
  CircleAlert,
  MoreHorizontal,
  Trash2,
  Users,
  X,
  XCircle,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { useIsMobile } from "@/hooks/use-mobile";
import CommentContent from "@/components/calls/comment-content";
import MentionInput from "@/components/calls/mention-input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import apiClient from "@/lib/api-client";
import { extractTransferInfo, formatCallDateTime, formatCallDateTimeShort, formatCommentTimestamp, formatPhoneNumber } from "@/lib/call-utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ApiResponse } from "@/types/api";
import { CallComment, CallDetail, CallStatus, ExtractionStatus } from "@/types/call";
import { Team } from "@/types/practice";
import { User, UserRole } from "@/types/user";

interface CallDetailPanelProps {
  call: CallDetail | null;
  loading: boolean;
  open: boolean;
  onClose: () => void;
  onToggleReview: (callId: string, isReviewed: boolean) => Promise<void>;
  onToggleFlag: (callId: string, isFlagged: boolean) => Promise<void>;
  onUpdateTeams: (callId: string, teams: string[]) => Promise<void>;
  onDeleteCall: (callId: string) => Promise<void>;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  isLargeScreen: boolean;
  users: User[];
  currentUser: User | null;
  practiceTeams: Team[];
}

export function CallDetailPanel({
  call,
  loading,
  open,
  onClose,
  onToggleReview,
  onToggleFlag,
  onUpdateTeams,
  onDeleteCall,
  onNavigatePrev,
  onNavigateNext,
  isLargeScreen,
  users,
  currentUser,
  practiceTeams,
}: CallDetailPanelProps) {
  const { isMobile } = useIsMobile();
  const [isClosing, setIsClosing] = useState(false);
  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "admin">("overview");
  const [comments, setComments] = useState<CallComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentValue, setCommentValue] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [isVapiDataOpen, setIsVapiDataOpen] = useState(false);
  const [isExtractedDataOpen, setIsExtractedDataOpen] = useState(false);
  const [summaryCopied, setSummaryCopied] = useState(false);
  const [summaryTooltipOpen, setSummaryTooltipOpen] = useState(false);
  const [transcriptCopied, setTranscriptCopied] = useState(false);
  const [transcriptTooltipOpen, setTranscriptTooltipOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [teamsPopoverOpen, setTeamsPopoverOpen] = useState(false);

  useEffect(() => {
    if (open && call) {
      setIsClosing(false);
      setVisible(true);
    } else if (visible) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setIsClosing(false);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [open, call]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 250);
  }, [onClose]);

  const fetchComments = useCallback(async () => {
    if (!call?.id) return;
    setLoadingComments(true);
    try {
      const response = await apiClient.get<ApiResponse<CallComment[]>>(`/api/calls/${call.id}/comments`);
      if (response.data.success && response.data.data) {
        setComments(response.data.data);
      }
    } finally {
      setLoadingComments(false);
    }
  }, [call?.id]);

  useEffect(() => {
    setCommentValue("");
    if (call?.id && open) {
      fetchComments();
    } else {
      setComments([]);
    }
  }, [call?.id, open, fetchComments]);

  useEffect(() => {
    if (!call?.id || !open) return;
    function handleVisibility(): void {
      if (document.visibilityState === "visible") {
        fetchComments();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [call?.id, open, fetchComments]);

  const handleArchiveComment = async (commentId: string) => {
    if (!call) return;
    try {
      await apiClient.delete<ApiResponse<null>>(`/api/calls/${call.id}/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      toast.success("Comment archived");
    } catch {
      toast.error("Failed to archive comment");
    }
  };

  const handleAddComment = async () => {
    if (!call || !commentValue.trim()) return;
    setSavingComment(true);
    try {
      const response = await apiClient.post<ApiResponse<CallComment>>(`/api/calls/${call.id}/comments`, {
        content: commentValue.trim(),
      });
      if (response.data.success && response.data.data) {
        setComments((prev) => [...prev, response.data.data!]);
        setCommentValue("");
        toast.success("Comment added");
      }
    } catch {
      toast.error("Failed to add comment");
    } finally {
      setSavingComment(false);
    }
  };

  const getReviewerName = (reviewerId: string | null): string | null => {
    if (!reviewerId) return null;
    const reviewer = users.find((u) => u.id === reviewerId);
    return reviewer?.full_name || null;
  };

  const handleCopySummary = async () => {
    const summary = call?.extraction_data?.summary;
    if (summary) {
      await navigator.clipboard.writeText(summary);
      setSummaryCopied(true);
      setSummaryTooltipOpen(true);
      setTimeout(() => {
        setSummaryCopied(false);
        setSummaryTooltipOpen(false);
      }, 2000);
    }
  };

  const handleCopyTranscript = async () => {
    const transcript = call?.vapi_data?.artifact?.transcript;
    if (transcript) {
      const lines = transcript.split("\n");
      const result: string[] = [];
      let prevSpeaker: string | null = null;
      for (const line of lines) {
        const match = line.match(/^(AI|User):\s*(.+)$/);
        if (match) {
          const speaker = match[1];
          if (prevSpeaker !== null && prevSpeaker !== speaker) {
            result.push("");
          }
          prevSpeaker = speaker;
        }
        result.push(line);
      }
      await navigator.clipboard.writeText(result.join("\n"));
      setTranscriptCopied(true);
      setTranscriptTooltipOpen(true);
      setTimeout(() => {
        setTranscriptCopied(false);
        setTranscriptTooltipOpen(false);
      }, 2000);
    }
  };

  const handleDeleteCall = async () => {
    if (!call) return;
    setLoadingDelete(true);
    try {
      await onDeleteCall(call.id);
      setDeleteDialogOpen(false);
    } finally {
      setLoadingDelete(false);
    }
  };

  const currentCallTeams = call?.display_data?.call_teams || call?.extraction_data?.call_teams || [];

  const handleToggleTeam = async (teamTitle: string) => {
    if (!call) return;
    const isSelected = currentCallTeams.includes(teamTitle);
    const newTeams = isSelected
      ? currentCallTeams.filter((t) => t !== teamTitle)
      : [...currentCallTeams, teamTitle];
    await onUpdateTeams(call.id, newTeams);
  };

  if (!visible || !call) return null;

  const artifact = call.vapi_data?.artifact;
  const extractionData = call.extraction_data;

  const handleToggleReview = async () => {
    await onToggleReview(call.id, !call.is_reviewed);
  };

  const headerName = extractionData?.patient_name || extractionData?.caller_name || call.display_data?.patient_name || call.display_data?.caller_name || "Unknown";
  const phoneNumber = call.vapi_data?.call?.customer?.number || call.display_data?.phone_number || "";
  const priority = extractionData?.priority || call.display_data?.priority || "Normal";

  const extractionStatus = call.extraction_status;
  const isExtractionPending =
    extractionStatus === ExtractionStatus.PENDING ||
    extractionStatus === ExtractionStatus.IN_PROGRESS;
  const isExtractionFailed = extractionStatus === ExtractionStatus.FAILED;

  const transferInfo = extractTransferInfo(call.vapi_data);

  const headerDurationSeconds =
    call.display_data?.duration_seconds ??
    call.vapi_data?.call?.durationSeconds ??
    call.vapi_data?.durationSeconds;

  let headerDurationStr = "";
  if (
    headerDurationSeconds !== undefined &&
    headerDurationSeconds !== null &&
    headerDurationSeconds > 0
  ) {
    if (headerDurationSeconds < 60) {
      headerDurationStr = `${Math.round(headerDurationSeconds)}s`;
    } else {
      const minutes = Math.floor(headerDurationSeconds / 60);
      const seconds = Math.round(headerDurationSeconds % 60);
      headerDurationStr = `${minutes}m ${seconds}s`;
    }
  }

  const panelIsFullScreen = isMobile || !isLargeScreen;

  const headerSubline = panelIsFullScreen
    ? formatCallDateTimeShort(call.created_at)
    : headerDurationStr !== ""
      ? `${formatCallDateTime(call.created_at)} · ${headerDurationStr}`
      : formatCallDateTime(call.created_at);
  const phoneInline = !panelIsFullScreen;

  return (
    <div
      className={cn(
        "fixed right-0 top-0 z-50 border-l border-neutral-200 bg-white duration-250 ease-out fill-mode-forwards",
        isClosing
          ? "animate-out slide-out-to-right"
          : "animate-in slide-in-from-right"
      )}
      style={{
        height: "100dvh",
        width: panelIsFullScreen ? "calc(100% - 3rem)" : "calc(50vw - 1.5rem)",
      }}
    >
      <div className="relative flex h-full flex-col bg-white">
        <div className="sticky top-0 z-10 bg-neutral-50">
          <div className="flex items-start justify-between gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-5 lg:px-6 lg:py-6">
            <div className="min-w-0 flex-1">
              {phoneInline ? (
                <>
                  <h3 className="flex min-w-0 items-baseline gap-x-2 text-lg leading-tight tracking-tight text-neutral-900 lg:text-xl">
                    <span className="truncate font-semibold">{headerName}</span>
                    <span className="shrink-0 font-normal text-neutral-300">·</span>
                    <span className="shrink-0 text-sm font-normal tabular-nums text-neutral-500 lg:text-base">
                      {phoneNumber ? formatPhoneNumber(phoneNumber) : "No phone number"}
                    </span>
                  </h3>
                  <p className="mt-1 min-w-0 truncate text-[11px] leading-snug tabular-nums text-neutral-400 lg:text-xs">
                    {headerSubline}
                  </p>
                </>
              ) : (
                <>
                  <h3 className="truncate text-lg font-semibold leading-tight tracking-tight text-neutral-900 lg:text-xl">
                    {headerName}
                  </h3>
                  <p className="mt-1 min-w-0 truncate text-[10px] leading-snug tabular-nums text-neutral-400 lg:text-xs">
                    {phoneNumber ? formatPhoneNumber(phoneNumber) : "No phone number"}
                    <span className="mx-1.5">·</span>
                    {headerSubline}
                  </p>
                </>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1 pt-0.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={onNavigatePrev}
                disabled={!onNavigatePrev}
                className="h-8 w-8 p-0"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onNavigateNext}
                disabled={!onNavigateNext}
                className="h-8 w-8 p-0"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="bg-white px-4 pt-6 pb-4 lg:px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {call.is_flagged ? (
                  <>
                    <CircleAlert className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-amber-900">
                        Flagged
                      </p>
                      <p className="text-xs text-amber-700">
                        This call has been flagged for attention.
                      </p>
                    </div>
                  </>
                ) : call.is_reviewed ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-emerald-900">
                        Reviewed
                      </p>
                      <p className="text-xs text-emerald-700">
                        This call has been reviewed and marked complete
                        {getReviewerName(call.reviewed_by) ? ` by ${getReviewerName(call.reviewed_by)}` : ""}.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-amber-900">
                        Needs Review
                      </p>
                      <p className="text-xs text-amber-700">
                        This call is waiting for review.
                      </p>
                    </div>
                  </>
                )}
              </div>
              {call.status === CallStatus.COMPLETED && (
                <div
                  className={cn(
                    "inline-flex items-center border text-[12px] font-medium",
                    call.is_flagged
                      ? "bg-amber-500 border-amber-500 text-white"
                      : call.is_reviewed
                        ? "bg-green-900 border-green-900 text-white"
                        : "border-neutral-200 text-neutral-600"
                  )}
                >
                  <button
                    onClick={call.is_flagged ? () => onToggleFlag(call.id, false) : handleToggleReview}
                    className={cn(
                      "px-3 py-1.5 transition-colors inline-flex items-center gap-1.5 cursor-pointer",
                      call.is_flagged
                        ? "hover:bg-amber-600"
                        : call.is_reviewed
                          ? "hover:bg-green-950"
                          : "hover:bg-neutral-50"
                    )}
                    title={call.is_flagged ? "Remove flag" : call.is_reviewed ? "Mark as unreviewed" : "Mark as reviewed"}
                  >
                    {call.is_flagged ? (
                      <>
                        <CircleAlert className="h-3.5 w-3.5" />
                        <span>Flagged</span>
                      </>
                    ) : call.is_reviewed ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>{call.reviewed_by ? (getReviewerName(call.reviewed_by)?.split(/\s+/)[0] || "Reviewed") : "Halo"}</span>
                      </>
                    ) : (
                      <>
                        <Circle className="h-3.5 w-3.5" strokeWidth={2} />
                        <span>Review</span>
                      </>
                    )}
                  </button>
                  <div
                    className={cn(
                      "w-px self-stretch",
                      call.is_flagged
                        ? "bg-amber-400"
                        : call.is_reviewed
                          ? "bg-green-700"
                          : "bg-neutral-200"
                    )}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={cn(
                          "px-1.5 py-1.5 transition-colors cursor-pointer inline-flex items-center justify-center",
                          call.is_flagged
                            ? "hover:bg-amber-600"
                            : call.is_reviewed
                              ? "hover:bg-green-950"
                              : "hover:bg-neutral-50"
                        )}
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {call.is_flagged ? (
                        <>
                          <DropdownMenuItem
                            onClick={async () => {
                              await onToggleFlag(call.id, false);
                              await onToggleReview(call.id, true);
                            }}
                            className="cursor-pointer"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Mark as Reviewed
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onToggleFlag(call.id, false)}
                            className="cursor-pointer"
                          >
                            <CircleAlert className="h-4 w-4" />
                            Remove Flag
                          </DropdownMenuItem>
                        </>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => onToggleFlag(call.id, true)}
                          className="cursor-pointer"
                        >
                          <CircleAlert className="h-4 w-4" />
                          Flag
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          </div>

          {practiceTeams.length > 0 && (
            <div className="bg-white px-4 lg:px-6 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-neutral-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-neutral-900">
                      Teams
                    </p>
                    <p className="text-xs text-neutral-500">
                      {currentCallTeams.length > 0
                        ? currentCallTeams.join(", ")
                        : "No teams assigned to this call."}
                    </p>
                  </div>
                </div>
                <Popover open={teamsPopoverOpen} onOpenChange={setTeamsPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      className="px-3 py-1.5 border text-[12px] font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                    >
                      <ChevronsUpDown className="h-3.5 w-3.5" />
                      <span>{currentCallTeams.length > 0 ? currentCallTeams.join(", ") : "None"}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-1" align="end">
                    {practiceTeams.map((team) => {
                      const isChecked = currentCallTeams.includes(team.title);
                      return (
                        <button
                          key={team.id}
                          onClick={() => handleToggleTeam(team.title)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-[13px] hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                        >
                          <Checkbox checked={isChecked} className="pointer-events-none" />
                          <span className="text-neutral-900">{team.title}</span>
                        </button>
                      );
                    })}
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          <div className="border-b border-neutral-100 bg-white px-4 lg:px-6 pt-6">
            <div className="flex gap-6">
              <button
                onClick={() => setActiveTab("overview")}
                className={`relative pb-3 text-[14px] font-medium transition-colors ${
                  activeTab === "overview"
                    ? "text-neutral-900"
                    : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                Overview
                {activeTab === "overview" && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-neutral-900" />
                )}
              </button>
              {currentUser?.role === UserRole.SUPER_ADMIN && (
                <button
                  onClick={() => setActiveTab("admin")}
                  className={`relative pb-3 text-[14px] font-medium transition-colors ${
                    activeTab === "admin"
                      ? "text-neutral-900"
                      : "text-neutral-500 hover:text-neutral-700"
                  }`}
                >
                  Admin
                  {activeTab === "admin" && (
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-neutral-900" />
                  )}
                </button>
              )}
            </div>
          </div>

        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : (
            <div className="bg-white p-4 lg:p-6 space-y-6">
              {activeTab === "overview" || currentUser?.role !== UserRole.SUPER_ADMIN ? (
                <>
                  {/* Summary */}
                  <div>
                    {extractionData?.summary ? (
                      <Tooltip open={summaryTooltipOpen} onOpenChange={setSummaryTooltipOpen}>
                        <TooltipTrigger asChild>
                          <h3
                            className="text-xs font-semibold text-neutral-900 mb-3 cursor-pointer hover:text-neutral-600 transition-colors w-fit"
                            onClick={handleCopySummary}
                          >
                            Summary
                          </h3>
                        </TooltipTrigger>
                        <TooltipContent>
                          {summaryCopied ? "Copied" : "Copy"}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <h3 className="text-xs font-semibold text-neutral-900 mb-3">
                        Summary
                      </h3>
                    )}
                    {isExtractionPending ? (
                      <div className="flex items-center gap-2 text-xs text-neutral-500">
                        <Spinner className="h-3 w-3" />
                        <span>Generating summary...</span>
                      </div>
                    ) : isExtractionFailed ? (
                      <div className="flex items-center gap-2 text-xs text-red-600">
                        <XCircle className="h-3 w-3" />
                        <span>Failed to generate summary</span>
                      </div>
                    ) : extractionData?.summary ? (
                      <p className="text-[13px] text-neutral-700 leading-relaxed">
                        {extractionData.summary}
                      </p>
                    ) : (
                      <p className="text-xs text-neutral-500">No summary available</p>
                    )}
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-neutral-900 mb-2">
                      Comments
                    </h3>
                    {loadingComments ? (
                      <div className="mb-3 flex items-center gap-2 text-xs text-neutral-500">
                        <Spinner className="h-3.5 w-3.5" />
                        Loading comments...
                      </div>
                    ) : (
                      comments.map((c) => (
                        <div
                          key={c.id}
                          className="group/comment mb-3 flex gap-2"
                        >
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarFallback className="bg-neutral-200 text-[11px] font-medium text-neutral-600">
                              {c.user_name
                                ? c.user_name.split(/\s+/).map((n) => n[0]).slice(0, 2).join("").toUpperCase()
                                : "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="text-[13px] font-semibold text-neutral-900">
                                {c.user_name || "Unknown"}
                              </span>
                              <span className="text-[11px] text-neutral-500">
                                {formatCommentTimestamp(c.created_at)}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[13px] text-neutral-700 leading-relaxed">
                              <CommentContent content={c.content} users={users} />
                            </p>
                          </div>
                          {c.user_id === currentUser?.id && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className="opacity-0 group-hover/comment:opacity-100 flex h-7 w-7 shrink-0 items-center justify-center rounded text-neutral-400 transition-opacity hover:bg-neutral-100 hover:text-neutral-600"
                                  aria-label="Comment options"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => handleArchiveComment(c.id)}
                                  className="cursor-pointer"
                                >
                                  <Archive className="h-4 w-4" />
                                  Archive
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      ))
                    )}
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className="bg-neutral-200 text-[11px] font-medium text-neutral-600">
                          {currentUser?.full_name
                            ? currentUser.full_name.split(/\s+/).map((n) => n[0]).slice(0, 2).join("").toUpperCase()
                            : "?"}
                        </AvatarFallback>
                      </Avatar>
                      <MentionInput
                        value={commentValue}
                        onChange={setCommentValue}
                        onSubmit={handleAddComment}
                        users={users}
                        disabled={savingComment}
                        placeholder="Add a comment — use @ to mention"
                      />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={handleAddComment}
                            disabled={savingComment || !commentValue.trim()}
                            className={cn(
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors",
                              commentValue.trim()
                                ? "bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
                                : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-neutral-400"
                            )}
                          >
                            {savingComment ? (
                              <Spinner className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowUp className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Send</TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="mt-2 border-t border-neutral-200" />
                  </div>

                  {/* Details */}
                  <div>
                    <h3 className="text-xs font-semibold text-neutral-900 mb-3">
                      Details
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-[11px] font-medium text-neutral-500 mb-1 uppercase tracking-wide">
                          Caller Name
                        </h4>
                        <p className="text-[13px] text-neutral-900">
                          {extractionData?.caller_name || call.display_data?.caller_name || "Not provided"}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-[11px] font-medium text-neutral-500 mb-1 uppercase tracking-wide">
                          Caller Affiliation
                        </h4>
                        <p className="text-[13px] text-neutral-900">
                          {extractionData?.caller_affiliation || call.display_data?.caller_affiliation || "Not provided"}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-[11px] font-medium text-neutral-500 mb-1 uppercase tracking-wide">
                          Patient Name
                        </h4>
                        <p className="text-[13px] text-neutral-900">
                          {extractionData?.patient_name || call.display_data?.patient_name || "Not provided"}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-[11px] font-medium text-neutral-500 mb-1 uppercase tracking-wide">
                          Patient DOB
                        </h4>
                        <p className="text-[13px] text-neutral-900">
                          {extractionData?.patient_dob || call.display_data?.patient_dob || "Not provided"}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-[11px] font-medium text-neutral-500 mb-1 uppercase tracking-wide">
                          Primary Intent
                        </h4>
                        <p className="text-[13px] text-neutral-900">
                          {extractionData?.primary_intent || call.display_data?.primary_intent || "Not provided"}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-[11px] font-medium text-neutral-500 mb-1 uppercase tracking-wide">
                          Provider Name
                        </h4>
                        <p className="text-[13px] text-neutral-900">
                          {extractionData?.provider_name || call.display_data?.provider_name || "Not provided"}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-[11px] font-medium text-neutral-500 mb-1 uppercase tracking-wide">
                          Teams
                        </h4>
                        <p className="text-[13px] text-neutral-900">
                          {extractionData?.call_teams && extractionData.call_teams.length > 0
                            ? extractionData.call_teams.join(", ")
                            : "Not provided"}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-[11px] font-medium text-neutral-500 mb-1 uppercase tracking-wide">
                          Priority
                        </h4>
                        <p className={cn(
                          "text-[13px]",
                          priority?.toLowerCase() === "high" ? "text-red-600 font-medium" :
                          priority?.toLowerCase() === "medium" ? "text-amber-600 font-medium" :
                          "text-neutral-900"
                        )}>
                          {priority || "Not provided"}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-[11px] font-medium text-neutral-500 mb-1 uppercase tracking-wide">
                          Reviewed By
                        </h4>
                        <p className="text-[13px] text-neutral-900">
                          {call.is_reviewed && call.reviewed_by
                            ? getReviewerName(call.reviewed_by) || "Unknown"
                            : "Not reviewed"}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-[11px] font-medium text-neutral-500 mb-1 uppercase tracking-wide">
                          Call Time
                        </h4>
                        <p className="text-[13px] text-neutral-900">
                          {formatCallDateTime(call.created_at)}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-[11px] font-medium text-neutral-500 mb-1 uppercase tracking-wide">
                          Reviewed At
                        </h4>
                        <p className="text-[13px] text-neutral-900">
                          {call.is_reviewed && call.reviewed_at
                            ? formatCallDateTime(call.reviewed_at)
                            : "Not reviewed"}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-[11px] font-medium text-neutral-500 mb-1 uppercase tracking-wide">
                          Transferred
                        </h4>
                        <p className={cn(
                          "text-[13px]",
                          transferInfo.wasTransferred ? "text-blue-600 font-medium" : "text-neutral-900"
                        )}>
                          {transferInfo.wasTransferred
                            ? transferInfo.destinationLabel
                            : "No"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Recording */}
                  <div>
                    <h3 className="text-xs font-semibold text-neutral-900 mb-3">
                      Recording
                    </h3>
                    {artifact?.recordingUrl ? (
                      <audio key={call.id} controls className="w-full">
                        <source src={artifact.recordingUrl} type="audio/mpeg" />
                        Your browser does not support the audio element.
                      </audio>
                    ) : (
                      <p className="text-xs text-neutral-500">No recording available</p>
                    )}
                  </div>

                  {/* Transcript */}
                  <div>
                    {artifact?.transcript ? (
                      <Tooltip open={transcriptTooltipOpen} onOpenChange={setTranscriptTooltipOpen}>
                        <TooltipTrigger asChild>
                          <h3
                            className="text-xs font-semibold text-neutral-900 mb-3 cursor-pointer hover:text-neutral-600 transition-colors w-fit"
                            onClick={handleCopyTranscript}
                          >
                            Transcript
                          </h3>
                        </TooltipTrigger>
                        <TooltipContent>
                          {transcriptCopied ? "Copied" : "Copy"}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <h3 className="text-xs font-semibold text-neutral-900 mb-3">
                        Transcript
                      </h3>
                    )}
                    {artifact?.transcript ? (
                      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 space-y-3">
                        {artifact.transcript.split("\n").map((line, idx) => {
                          const match = line.match(/^(AI|User):\s*(.+)$/);
                          if (match) {
                            const [, speaker, text] = match;
                            return (
                              <p
                                key={idx}
                                className="text-xs text-neutral-700 leading-relaxed"
                              >
                                <span className="font-semibold text-neutral-900">
                                  {speaker}:
                                </span>{" "}
                                {text}
                              </p>
                            );
                          }
                          return line.trim() ? (
                            <p
                              key={idx}
                              className="text-xs text-neutral-700 leading-relaxed"
                            >
                              {line}
                            </p>
                          ) : null;
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-500">No transcript available</p>
                    )}
                    {currentUser?.role === UserRole.SUPER_ADMIN && (
                      <Button
                        onClick={() => setDeleteDialogOpen(true)}
                        className="mt-4 h-9 rounded-none bg-red-600 px-5 text-[14px] font-medium text-white hover:bg-red-700"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Call
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Database Fields */}
                  <div>
                    <h3 className="text-xs font-semibold text-neutral-900 mb-3">
                      Call Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-[11px] font-medium text-neutral-500 mb-1 uppercase tracking-wide">
                          Call ID
                        </h4>
                        <p className="text-[13px] text-neutral-900">{call.id}</p>
                      </div>
                      <div>
                        <h4 className="text-[11px] font-medium text-neutral-500 mb-1 uppercase tracking-wide">
                          Twilio Call SID
                        </h4>
                        <p className="text-[13px] text-neutral-900">{call.twilio_call_sid}</p>
                      </div>
                      {call.vapi_call_id && (
                        <div>
                          <h4 className="text-[11px] font-medium text-neutral-500 mb-1 uppercase tracking-wide">
                            VAPI Call ID
                          </h4>
                          <p className="text-[13px] text-neutral-900">{call.vapi_call_id}</p>
                        </div>
                      )}
                      <div>
                        <h4 className="text-[11px] font-medium text-neutral-500 mb-1 uppercase tracking-wide">
                          Status
                        </h4>
                        <p className="text-[13px] text-neutral-900">{call.status}</p>
                      </div>
                      {call.extraction_status && (
                        <div>
                          <h4 className="text-[11px] font-medium text-neutral-500 mb-1 uppercase tracking-wide">
                            Extraction Status
                          </h4>
                          <p className="text-[13px] text-neutral-900">{call.extraction_status}</p>
                        </div>
                      )}
                      <div>
                        <h4 className="text-[11px] font-medium text-neutral-500 mb-1 uppercase tracking-wide">
                          Created At
                        </h4>
                        <p className="text-[13px] text-neutral-900">{formatCallDateTime(call.created_at)}</p>
                      </div>
                      {call.updated_at && (
                        <div>
                          <h4 className="text-[11px] font-medium text-neutral-500 mb-1 uppercase tracking-wide">
                            Updated At
                          </h4>
                          <p className="text-[13px] text-neutral-900">{formatCallDateTime(call.updated_at)}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Recording */}
                  <div>
                    <h3 className="text-xs font-semibold text-neutral-900 mb-3">
                      Recording
                    </h3>
                    {artifact?.recordingUrl ? (
                      <audio key={call.id} controls className="w-full">
                        <source src={artifact.recordingUrl} type="audio/mpeg" />
                        Your browser does not support the audio element.
                      </audio>
                    ) : (
                      <p className="text-xs text-neutral-500">No recording available</p>
                    )}
                  </div>

                  {/* Transcript */}
                  <Collapsible open={isTranscriptOpen} onOpenChange={setIsTranscriptOpen}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between w-full mb-3">
                        <h3 className="text-xs font-semibold text-neutral-900">
                          Transcript
                        </h3>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 text-neutral-500 transition-transform",
                            isTranscriptOpen && "transform rotate-180"
                          )}
                        />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      {artifact?.transcript ? (
                        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 space-y-3">
                          {artifact.transcript.split("\n").map((line, idx) => {
                            const match = line.match(/^(AI|User):\s*(.+)$/);
                            if (match) {
                              const [, speaker, text] = match;
                              return (
                                <p
                                  key={idx}
                                  className="text-xs text-neutral-700 leading-relaxed"
                                >
                                  <span className="font-semibold text-neutral-900">
                                    {speaker}:
                                  </span>{" "}
                                  {text}
                                </p>
                              );
                            }
                            return line.trim() ? (
                              <p
                                key={idx}
                                className="text-xs text-neutral-700 leading-relaxed"
                              >
                                {line}
                              </p>
                            ) : null;
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-500">No transcript available</p>
                      )}
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Extracted Data */}
                  <Collapsible open={isExtractedDataOpen} onOpenChange={setIsExtractedDataOpen}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between w-full mb-3">
                        <h3 className="text-xs font-semibold text-neutral-900">
                          Extracted Data
                        </h3>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 text-neutral-500 transition-transform",
                            isExtractedDataOpen && "transform rotate-180"
                          )}
                        />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      {isExtractionPending ? (
                        <div className="flex items-center gap-2 text-xs text-neutral-500">
                          <Spinner className="h-3 w-3" />
                          <span>Extracting data...</span>
                        </div>
                      ) : isExtractionFailed ? (
                        <div className="flex items-center gap-2 text-xs text-red-600">
                          <XCircle className="h-3 w-3" />
                          <span>Failed to extract data</span>
                        </div>
                      ) : extractionData ? (
                        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4">
                          <pre className="text-xs text-neutral-700 whitespace-pre-wrap overflow-x-auto">
                            {JSON.stringify(extractionData, null, 2)}
                          </pre>
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-500">No extracted data available</p>
                      )}
                    </CollapsibleContent>
                  </Collapsible>

                  {/* VAPI Data */}
                  <Collapsible open={isVapiDataOpen} onOpenChange={setIsVapiDataOpen}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between w-full mb-3">
                        <h3 className="text-xs font-semibold text-neutral-900">
                          VAPI Data
                        </h3>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 text-neutral-500 transition-transform",
                            isVapiDataOpen && "transform rotate-180"
                          )}
                        />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      {call.vapi_data ? (
                        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4">
                          <pre className="text-xs text-neutral-700 whitespace-pre-wrap overflow-x-auto">
                            {JSON.stringify(call.vapi_data, null, 2)}
                          </pre>
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-500">No VAPI data available</p>
                      )}
                    </CollapsibleContent>
                  </Collapsible>

                  {currentUser?.role === UserRole.SUPER_ADMIN && (
                    <div className="pt-6 border-t border-neutral-200">
                      <h3 className="text-xs font-semibold text-red-600 mb-3">
                        Danger Zone
                      </h3>
                      <Button
                        variant="outline"
                        onClick={() => setDeleteDialogOpen(true)}
                        className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Call
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open && loadingDelete) return;
          setDeleteDialogOpen(open);
        }}
      >
        <AlertDialogContent className="max-w-sm border-neutral-200 bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-semibold text-neutral-900">
              Delete Call
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[14px] text-neutral-500">
              Are you sure you want to delete this call? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={loadingDelete}
              className="h-9 rounded-none border-neutral-200 text-[14px] font-medium text-neutral-900 hover:bg-neutral-50"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              onClick={handleDeleteCall}
              disabled={loadingDelete}
              className="h-9 rounded-none bg-red-600 px-5 text-[14px] font-medium text-white hover:bg-red-700"
            >
              {loadingDelete ? <Spinner className="h-4 w-4" /> : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
