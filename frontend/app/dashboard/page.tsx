"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { format } from "date-fns";
import { CheckCircle2, Circle, CircleAlert, ChevronLeft, ChevronRight, List, Loader2, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";

import { CallDetailPanel } from "@/components/calls/call-detail-panel";
import { CallsTable } from "@/components/calls/calls-table";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import apiClient from "@/lib/api-client";
import { localDateToUtcEndOfDay, localDateToUtcStartOfDay } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import {
  clearSelectedCall,
  deleteCall,
  fetchCallDetail,
  fetchCallsForDateRange,
  setCalls,
  setSelectedCall,
  updateCall,
} from "@/store/slices/calls-slice";
import { useAppDispatch, useAppSelector } from "@/store";
import { ApiResponse } from "@/types/api";
import { Call, CallDetail } from "@/types/call";
import { UserRole } from "@/types/user";
import { PageSpinner } from "@/components/ui/page-spinner";

const INTENT_ORDER = [
  "Appointment (New/Reschedule/Cancel)",
  "Prescription Refill",
  "Test Results",
  "Referral Request",
  "Medical Records",
  "Billing/Insurance Question",
  "Speak to Staff",
  "Report Symptoms",
  "Prior Authorization",
  "Spam/Wrong Number",
  "Other",
  "Not Provided",
];

function DashboardContent() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const { isMobile } = useIsMobile();
  const { calls, selectedCall, loading, detailLoading } = useAppSelector(
    (state) => state.calls
  );
  const { practice } = useAppSelector((state) => state.practice);
  const { user } = useAppSelector((state) => state.auth);
  const { users } = useAppSelector((state) => state.users);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [handledCallParam, setHandledCallParam] = useState<string | null>(null);
  const [isLargeScreen, setIsLargeScreen] = useState(true);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [addTabPopoverOpen, setAddTabPopoverOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [reviewFilter, setReviewFilter] = useState<string>("needs_reviewed");
  const [hasSetDefaultTabs, setHasSetDefaultTabs] = useState(false);
  const callRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  useEffect(() => {
    const callId = searchParams.get("call");
    const cacheKey = callId ? `${callId}_${searchParams.get("t") || ""}` : null;
    if (callId && cacheKey !== handledCallParam) {
      setHandledCallParam(cacheKey);
      dispatch(fetchCallDetail(callId)).then((result) => {
        if (fetchCallDetail.fulfilled.match(result)) {
          setIsPanelOpen(true);
        }
      });
    }
  }, [searchParams, handledCallParam, dispatch]);

  useEffect(() => {
    if (user && practice && !hasSetDefaultTabs) {
      const teams = practice.teams?.teams || [];
      const userTeams = teams.filter((t) => t.members.includes(user.id));

      if (userTeams.length === 0) {
        setOpenTabs(["all"]);
        setActiveTab("all");
      } else {
        const teamTabs = userTeams.map((t) => t.title);
        setOpenTabs(teamTabs);
        setActiveTab(teamTabs[0]);
      }
      setHasSetDefaultTabs(true);
    }
  }, [user, practice, hasSetDefaultTabs]);

  useEffect(() => {
    setReviewFilter("needs_reviewed");
  }, [activeTab]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && isPanelOpen && selectedCall) {
        dispatch(fetchCallDetail(selectedCall.id));
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isPanelOpen, selectedCall, dispatch]);

  useEffect(() => {
    if (!selectedCall && isPanelOpen) {
      setIsPanelOpen(false);
    }
  }, [selectedCall, isPanelOpen]);

  useEffect(() => {
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(selectedDate);
      date.setDate(date.getDate() - i);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      dates.push(`${year}-${month}-${day}`);
    }

    dispatch(fetchCallsForDateRange(dates));

    const sortedDates = [...dates].sort();
    const interval = setInterval(async () => {
      try {
        const queryParams = new URLSearchParams();
        queryParams.append("start_date", localDateToUtcStartOfDay(sortedDates[0]));
        queryParams.append("end_date", localDateToUtcEndOfDay(sortedDates[sortedDates.length - 1]));
        const response = await apiClient.get<ApiResponse<CallDetail[]>>(`/api/calls?${queryParams}`);
        if (response.data.success && response.data.data) {
          dispatch(setCalls(response.data.data));
        }
      } catch {
      }
    }, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [selectedDate, dispatch]);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsLargeScreen(mql.matches);
    setIsLargeScreen(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setDatePickerOpen(false);
    }
  };

  const navigateDate = (days: number) => {
    const shiftDays = days * 7;
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + shiftDays);

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (newDate > today) return;

    setSelectedDate(newDate);
  };

  const isToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);
    return selected.getTime() >= today.getTime();
  };

  const getDateRangeText = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);

    if (selected.getTime() >= today.getTime()) {
      return "Last 7 Days";
    }

    const startOfRange = new Date(selectedDate);
    startOfRange.setDate(startOfRange.getDate() - 6);

    return `${format(startOfRange, "MMM d")} - ${format(selectedDate, "MMM d")}`;
  };

  const handleSelectCall = useCallback(
    (call: Call) => {
      setIsPanelOpen(true);
      dispatch(setSelectedCall(call));
      dispatch(fetchCallDetail(call.id));

      setTimeout(() => {
        const rowElement = callRowRefs.current[call.id];
        if (rowElement) {
          rowElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 0);
    },
    [dispatch]
  );

  const handleClosePanel = useCallback(() => {
    setIsPanelOpen(false);
    dispatch(clearSelectedCall());
  }, [dispatch]);

  const handleToggleReview = async (callId: string, isReviewed: boolean) => {
    dispatch(updateCall({ id: callId, is_reviewed: isReviewed, reviewed_by: isReviewed ? user?.id || null : null }));

    try {
      const response = await apiClient.patch<ApiResponse<Call>>(`/api/calls/${callId}/review`, {
        is_reviewed: isReviewed,
      });

      if (response.data.success && response.data.data) {
        dispatch(updateCall(response.data.data));
      }
    } catch {
      dispatch(updateCall({ id: callId, is_reviewed: !isReviewed }));
      toast.error("Failed to update review status");
    }
  };

  const handleToggleFlag = async (callId: string, isFlagged: boolean) => {
    dispatch(updateCall({ id: callId, is_flagged: isFlagged, flagged_by: isFlagged ? user?.id || null : null }));

    try {
      const response = await apiClient.patch<ApiResponse<Call>>(`/api/calls/${callId}/flag`, {
        is_flagged: isFlagged,
      });

      if (response.data.success && response.data.data) {
        dispatch(updateCall(response.data.data));
      }
    } catch {
      dispatch(updateCall({ id: callId, is_flagged: !isFlagged }));
      toast.error("Failed to update flag status");
    }
  };

  const handleUpdateTeams = async (callId: string, teams: string[]) => {
    const call = calls.find((c) => c.id === callId) || selectedCall;
    const previousDisplayTeams = call?.display_data?.call_teams || [];
    const previousExtractionTeams = call?.extraction_data?.call_teams || [];

    dispatch(
      updateCall({
        id: callId,
        display_data: { ...call?.display_data, call_teams: teams },
        extraction_data: { ...call?.extraction_data, call_teams: teams },
      })
    );

    try {
      const response = await apiClient.patch<ApiResponse<Call>>(`/api/calls/${callId}/teams`, {
        call_teams: teams,
      });

      if (response.data.success && response.data.data) {
        dispatch(updateCall(response.data.data));
      }
    } catch {
      dispatch(
        updateCall({
          id: callId,
          display_data: { ...call?.display_data, call_teams: previousDisplayTeams },
          extraction_data: { ...call?.extraction_data, call_teams: previousExtractionTeams },
        })
      );
      toast.error("Failed to update teams");
    }
  };

  const handleDeleteCall = async (callId: string): Promise<void> => {
    try {
      await dispatch(deleteCall(callId)).unwrap();
      toast.success("Call deleted successfully");
      handleClosePanel();
    } catch (error) {
      toast.error((error as string) || "Failed to delete call");
    }
  };


  const practiceTeams = practice?.teams?.teams || [];

  const getTeamCount = (teamTitle: string): number => {
    const teamCalls = calls.filter((call) => {
      const callTeams = call.display_data?.call_teams || [];
      return callTeams.includes(teamTitle);
    });
    return teamCalls.filter((call) => !call.is_reviewed).length;
  };

  const allAvailableTabs = [
    { id: "all", label: "All", count: 0 },
    ...practiceTeams.map((team) => ({
      id: team.title,
      label: team.title,
      count: getTeamCount(team.title),
    })),
  ];

  const visibleTabs = openTabs
    .map((tabId) => allAvailableTabs.find((t) => t.id === tabId))
    .filter((t): t is { id: string; label: string; count: number } => t !== undefined);

  const addableTabs = allAvailableTabs.filter((t) => !openTabs.includes(t.id));

  const handleAddTab = (tabId: string) => {
    if (!openTabs.includes(tabId)) {
      setOpenTabs([...openTabs, tabId]);
      setActiveTab(tabId);
    }
    setAddTabPopoverOpen(false);
  };

  const handleRemoveTab = (tabId: string) => {
    const newTabs = openTabs.filter((t) => t !== tabId);
    setOpenTabs(newTabs);
    if (activeTab === tabId && newTabs.length > 0) {
      setActiveTab(newTabs[0]);
    }
  };

  const filteredByTeam = calls.filter((call) => {
    if (activeTab === "all") return true;
    const callTeams = call.display_data?.call_teams || [];
    return callTeams.includes(activeTab);
  });

  const filteredCalls = filteredByTeam
    .filter((call) => {
      if (reviewFilter === "reviewed" && !call.is_reviewed) return false;
      if (reviewFilter === "needs_reviewed" && call.is_reviewed) return false;
      if (reviewFilter === "flagged" && !call.is_flagged) return false;

      if (!searchQuery) return true;

      const query = searchQuery.toLowerCase();
      const callerName = call.display_data?.caller_name || "";
      const patientName = call.display_data?.patient_name || "";
      const phoneNumber = call.display_data?.phone_number || "";
      const summary = call.display_data?.summary || "";

      return (
        callerName.toLowerCase().includes(query) ||
        patientName.toLowerCase().includes(query) ||
        phoneNumber.includes(query) ||
        summary.toLowerCase().includes(query)
      );
    })
    .sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  const intentGroups = useMemo(() => {
    const groups: Map<string, Call[]> = new Map();
    for (const call of filteredCalls) {
      const intent = call.display_data?.primary_intent || "Not Provided";
      if (!groups.has(intent)) {
        groups.set(intent, []);
      }
      groups.get(intent)!.push(call);
    }

    const ordered = INTENT_ORDER
      .filter((intent) => groups.has(intent))
      .map((intent) => ({
        intent,
        calls: groups.get(intent)!,
      }));

    const knownIntents = new Set(INTENT_ORDER);
    for (const [intent, calls] of groups) {
      if (!knownIntents.has(intent)) {
        ordered.push({ intent, calls });
      }
    }

    return ordered;
  }, [filteredCalls]);

  const orderedCalls = useMemo(() => {
    if (activeTab === "all") return filteredCalls;
    return intentGroups.flatMap((group) => group.calls);
  }, [activeTab, filteredCalls, intentGroups]);

  const visibleCallsRef = useRef(orderedCalls);
  visibleCallsRef.current = orderedCalls;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape" && isPanelOpen) {
        handleClosePanel();
        return;
      }

      const active = document.activeElement;
      if (
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          (active as HTMLElement).isContentEditable)
      ) {
        return;
      }

      if (!isPanelOpen || !selectedCall) return;

      const navList = visibleCallsRef.current;

      const currentIndex = navList.findIndex(
        (c) => c.id === selectedCall.id
      );
      if (currentIndex === -1) return;

      if (
        (event.key === "ArrowLeft" || event.key === "ArrowUp") &&
        currentIndex > 0
      ) {
        event.preventDefault();
        const previousCall = navList[currentIndex - 1];
        handleSelectCall(previousCall);
      } else if (
        (event.key === "ArrowRight" || event.key === "ArrowDown") &&
        currentIndex < navList.length - 1
      ) {
        event.preventDefault();
        const nextCall = navList[currentIndex + 1];
        handleSelectCall(nextCall);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    isPanelOpen,
    selectedCall,
    handleSelectCall,
    handleClosePanel,
  ]);

  const currentCallIndex = selectedCall
    ? orderedCalls.findIndex((c) => c.id === selectedCall.id)
    : -1;

  const handleNavigatePrev = currentCallIndex > 0
    ? () => handleSelectCall(orderedCalls[currentCallIndex - 1])
    : undefined;

  const handleNavigateNext = currentCallIndex >= 0 && currentCallIndex < orderedCalls.length - 1
    ? () => handleSelectCall(orderedCalls[currentCallIndex + 1])
    : undefined;

  return (
    <div
      className="flex flex-col h-dvh"
      style={{
        marginRight:
          !isMobile && isPanelOpen && isLargeScreen
            ? "calc(50vw - 1.5rem)"
            : "0",
      }}
    >
      <header className="sticky top-0 z-10 bg-white">
        <div className="px-4 py-4 md:px-10 md:py-8">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-neutral-900 md:text-[24px]">
                Dashboard
              </h1>
              <p className="mt-0.5 hidden text-[15px] text-neutral-500 lg:block">
                View and manage incoming calls
              </p>
            </div>

            <div className="hidden shrink-0 flex-col items-end gap-1.5 lg:flex">
              <div className="flex items-center border border-neutral-200 bg-white shadow-none overflow-hidden">
                <button
                  className="h-9 w-9 flex items-center justify-center hover:bg-neutral-50 transition-colors"
                  onClick={() => navigateDate(-1)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>

                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <button className="h-9 px-4 flex items-center hover:bg-neutral-50 transition-colors text-[13px] font-medium text-neutral-900">
                      {getDateRangeText()}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    {(() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const selected = new Date(selectedDate);
                      selected.setHours(0, 0, 0, 0);
                      const isTodaySelected = today.getTime() === selected.getTime();

                      return (
                        <>
                          {!isTodaySelected && (
                            <div className="p-3 border-b space-y-2">
                              <Button
                                variant="outline"
                                className="w-full h-9"
                                onClick={() => {
                                  setSelectedDate(new Date());
                                  setDatePickerOpen(false);
                                }}
                              >
                                Today
                              </Button>
                            </div>
                          )}
                          <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={handleDateChange}
                            initialFocus
                            disabled={(date) => date > new Date()}
                          />
                        </>
                      );
                    })()}
                  </PopoverContent>
                </Popover>

                <button
                  className="h-9 w-9 flex items-center justify-center hover:bg-neutral-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                  onClick={() => navigateDate(1)}
                  disabled={isToday()}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              {user?.role === UserRole.SUPER_ADMIN && practice && (
                <div className="text-[14px] text-neutral-600">
                  <span>Active Calls:</span>{" "}
                  <span className="font-medium text-neutral-900">
                    {practice.active_call_ids.length} /{" "}
                    {practice.max_concurrent_calls}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 lg:hidden">
            <div className="flex items-center border border-neutral-200 bg-white shadow-none overflow-hidden">
              <button
                className="h-8 w-8 flex items-center justify-center hover:bg-neutral-50 transition-colors"
                onClick={() => navigateDate(-1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>

              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <button className="h-8 px-2.5 flex items-center hover:bg-neutral-50 transition-colors text-[12px] font-medium text-neutral-900">
                    {getDateRangeText()}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  {(() => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const selected = new Date(selectedDate);
                    selected.setHours(0, 0, 0, 0);
                    const isTodaySelected = today.getTime() === selected.getTime();

                    return (
                      <>
                        {!isTodaySelected && (
                          <div className="p-3 border-b space-y-2">
                            <Button
                              variant="outline"
                              className="w-full h-9"
                              onClick={() => {
                                setSelectedDate(new Date());
                                setDatePickerOpen(false);
                              }}
                            >
                              Today
                            </Button>
                          </div>
                        )}
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={handleDateChange}
                          initialFocus
                          disabled={(date) => date > new Date()}
                        />
                      </>
                    );
                  })()}
                </PopoverContent>
              </Popover>

              <button
                className="h-8 w-8 flex items-center justify-center hover:bg-neutral-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                onClick={() => navigateDate(1)}
                disabled={isToday()}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            {user?.role === UserRole.SUPER_ADMIN && practice && (
              <div className="text-[12px] text-neutral-500">
                <span>Active:</span>{" "}
                <span className="font-medium text-neutral-900">
                  {practice.active_call_ids.length} /{" "}
                  {practice.max_concurrent_calls}
                </span>
              </div>
            )}
          </div>
        </div>

        {practiceTeams.length > 0 && (
          <div className="px-4 md:px-10">
            <div className="flex items-center gap-1 overflow-x-auto border-b border-neutral-100 scrollbar-hide">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative pb-3 pt-1 px-3 text-[14px] font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 group",
                    activeTab === tab.id
                      ? "text-neutral-900"
                      : "text-neutral-500 hover:text-neutral-700"
                  )}
                >
                  <span>{tab.label}</span>
                  {tab.id !== "all" && tab.count > 0 && (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs",
                        activeTab === tab.id
                          ? "bg-neutral-900 text-white"
                          : "bg-neutral-100 text-neutral-600"
                      )}
                    >
                      {tab.count}
                    </span>
                  )}
                  {visibleTabs.length > 1 && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveTab(tab.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemoveTab(tab.id);
                        }
                      }}
                      className="ml-1 p-0.5 rounded hover:bg-neutral-200 opacity-100 transition-opacity cursor-pointer inline-flex lg:opacity-0 lg:group-hover:opacity-100"
                    >
                      <X className="h-3 w-3 text-neutral-500" />
                    </span>
                  )}
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-neutral-900" />
                  )}
                </button>
              ))}
              <Popover open={addTabPopoverOpen} onOpenChange={setAddTabPopoverOpen}>
                <PopoverTrigger asChild>
                  <button className="pb-3 pt-1 px-2 text-neutral-400 hover:text-neutral-600 transition-colors">
                    <Plus className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1 max-h-[512px] overflow-y-auto" align="start">
                  {addableTabs.length === 0 ? (
                    <div className="px-3 py-2 text-[13px] text-neutral-500">
                      All tabs are open
                    </div>
                  ) : (
                    addableTabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => handleAddTab(tab.id)}
                        className="w-full px-3 py-2 text-left text-[13px] hover:bg-neutral-100 rounded flex items-center justify-between"
                      >
                        <span>{tab.label}</span>
                        {tab.id !== "all" && tab.count > 0 && (
                          <span className="rounded-full px-2 py-0.5 text-xs bg-neutral-100 text-neutral-600">
                            {tab.count}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-hide md:px-10 md:py-6">
        <div className="space-y-4">
          <div className="flex gap-2 md:gap-3">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
              <Input
                type="text"
                placeholder="Search calls"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery.trim()) {
                    router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                  }
                }}
                className={cn("pl-9 h-8 border-neutral-200 bg-white text-neutral-600 md:h-9 md:text-neutral-900", searchQuery && "pr-8")}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex shrink-0 bg-white rounded-md border border-neutral-200">
              <button
                onClick={() => setReviewFilter("all")}
                title="All"
                className={cn(
                  "px-2 py-1.5 text-[13px] font-medium transition-colors flex items-center gap-1.5 md:px-3",
                  reviewFilter === "all"
                    ? "bg-neutral-900 text-white rounded-l"
                    : "text-neutral-600 hover:text-neutral-900"
                )}
              >
                <List className={cn("h-3.5 w-3.5", reviewFilter === "all" ? "text-white" : "text-neutral-400")} />
                <span className="hidden md:inline">All</span>
              </button>
              <button
                onClick={() => setReviewFilter("reviewed")}
                title="Reviewed"
                className={cn(
                  "px-2 py-1.5 text-[13px] font-medium transition-colors flex items-center gap-1.5 md:px-3",
                  reviewFilter === "reviewed"
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-600 hover:text-neutral-900"
                )}
              >
                <CheckCircle2 className={cn("h-3.5 w-3.5", reviewFilter === "reviewed" ? "text-white" : "text-green-600")} />
                <span className="hidden md:inline">Reviewed</span>
              </button>
              <button
                onClick={() => setReviewFilter("needs_reviewed")}
                title="Needs Review"
                className={cn(
                  "px-2 py-1.5 text-[13px] font-medium transition-colors flex items-center gap-1.5 md:px-3",
                  reviewFilter === "needs_reviewed"
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-600 hover:text-neutral-900"
                )}
              >
                <Circle className={cn("h-3.5 w-3.5", reviewFilter === "needs_reviewed" ? "text-white" : "text-amber-600")} strokeWidth={2} />
                <span className="hidden whitespace-nowrap md:inline">Needs Review</span>
              </button>
              <button
                onClick={() => setReviewFilter("flagged")}
                title="Flagged"
                className={cn(
                  "px-2 py-1.5 text-[13px] font-medium transition-colors flex items-center gap-1.5 md:px-3",
                  reviewFilter === "flagged"
                    ? "bg-neutral-900 text-white rounded-r"
                    : "text-neutral-600 hover:text-neutral-900"
                )}
              >
                <CircleAlert className={cn("h-3.5 w-3.5", reviewFilter === "flagged" ? "text-white" : "text-amber-500")} />
                <span className="hidden whitespace-nowrap md:inline">Flagged</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
              <p className="mt-4 text-sm text-neutral-500">Loading calls...</p>
            </div>
          ) : filteredCalls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm font-medium text-neutral-900">
                No calls found
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                Calls will appear here as they come in
              </p>
            </div>
          ) : activeTab === "all" ? (
            <CallsTable
              calls={filteredCalls}
              onSelectCall={handleSelectCall}
              loading={false}
              onToggleReview={handleToggleReview}
              isPanelOpen={isPanelOpen}
              callRowRefs={callRowRefs}
              selectedCallId={selectedCall?.id || null}
              users={users}
            />
          ) : (
            <div className="space-y-8">
              {intentGroups.map((group) => (
                <div key={group.intent}>
                  <h2 className="text-[14px] font-semibold text-neutral-900 mb-3">
                    {group.intent}
                    <span className="ml-2 text-neutral-400 font-normal">
                      ({group.calls.length})
                    </span>
                  </h2>
                  <CallsTable
                    calls={group.calls}
                    onSelectCall={handleSelectCall}
                    loading={false}
                    onToggleReview={handleToggleReview}
                    isPanelOpen={isPanelOpen}
                    callRowRefs={callRowRefs}
                    selectedCallId={selectedCall?.id || null}
                    users={users}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <CallDetailPanel
        call={selectedCall}
        loading={detailLoading}
        open={isPanelOpen}
        onClose={handleClosePanel}
        onToggleReview={handleToggleReview}
        onToggleFlag={handleToggleFlag}
        onUpdateTeams={handleUpdateTeams}
        onDeleteCall={handleDeleteCall}
        onNavigatePrev={handleNavigatePrev}
        onNavigateNext={handleNavigateNext}
        isLargeScreen={isLargeScreen}
        users={users}
        currentUser={user}
        practiceTeams={practiceTeams}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <DashboardContent />
    </Suspense>
  );
}
