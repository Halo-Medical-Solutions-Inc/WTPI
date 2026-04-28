"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { format } from "date-fns";
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  Clock,
  List,
  Loader2,
  Phone,
  RefreshCw,
  Search,
  Timer,
  X,
} from "lucide-react";
import { toast } from "sonner";

import SankeyMobileStepper from "@/components/analytics/sankey-mobile-stepper";
import {
  SankeyDiagram,
  SankeyLink,
  SankeyNode,
} from "@/components/analytics/sankey-diagram";
import { CallDetailPanel } from "@/components/calls/call-detail-panel";
import { CallsTable } from "@/components/calls/calls-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { PageSpinner } from "@/components/ui/page-spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import apiClient from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store";
import { AnalyticsData, DoctorBreakdownItem } from "@/types/analytics";
import { ApiResponse } from "@/types/api";
import { Call, CallDetail } from "@/types/call";
import { Team } from "@/types/practice";
import { User } from "@/types/user";

type Period = "1d" | "7d" | "30d" | "all";
type SortField = "doctor_name" | "total_calls" | "review_completion_rate" | "needs_review" | "avg_review_time_minutes";

const PERIODS: { value: Period; label: string }[] = [
  { value: "1d", label: "Day" },
  { value: "7d", label: "Week" },
  { value: "30d", label: "Month" },
  { value: "all", label: "All Time" },
];

const INTENT_COLORS = [
  "#1d4ed8", "#7e22ce", "#be185d", "#b45309", "#0e7490",
  "#4338ca", "#9333ea", "#dc2626", "#0f766e", "#c2410c",
  "#15803d", "#4f46e5",
];

const TRANSFERRED_COLOR = "#0891b2";
const TOTAL_COLOR = "#1e3a5f";

function getDateRangeForPeriod(period: Period, offset: number): { start: Date; end: Date } {
  const now = new Date();

  if (period === "1d") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset, 23, 59, 59, 999);
    return { start, end };
  }

  if (period === "7d") {
    const endDate = new Date(now);
    if (offset === 0) {
      endDate.setHours(23, 59, 59, 999);
    } else {
      const currentDayOfWeek = now.getDay();
      const daysFromSunday = currentDayOfWeek === 0 ? 0 : currentDayOfWeek;
      const lastSaturday = new Date(now);
      lastSaturday.setDate(lastSaturday.getDate() - daysFromSunday - 1 - (offset - 1) * 7);
      lastSaturday.setHours(23, 59, 59, 999);
      endDate.setTime(lastSaturday.getTime());
    }
    const endDayOfWeek = endDate.getDay();
    const daysFromSunday = endDayOfWeek === 0 ? 0 : endDayOfWeek;
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - daysFromSunday);
    startDate.setHours(0, 0, 0, 0);
    return { start: startDate, end: endDate };
  }

  if (period === "30d") {
    const endDate = new Date(now);
    if (offset === 0) {
      endDate.setHours(23, 59, 59, 999);
    } else {
      endDate.setMonth(endDate.getMonth() - offset);
      const lastDayOfMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0);
      endDate.setDate(lastDayOfMonth.getDate());
      endDate.setHours(23, 59, 59, 999);
    }
    const startDate = new Date(endDate);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
    return { start: startDate, end: endDate };
  }

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date("2020-01-01T00:00:00.000Z");
  return { start, end };
}

function formatDateRange(period: Period, offset: number): string {
  const now = new Date();

  if (period === "all") return "All Time";

  if (period === "1d") {
    const date = new Date(now);
    date.setDate(date.getDate() - offset);
    if (offset === 0) return `Today, ${format(date, "MMM d")}`;
    if (offset === 1) return `Yesterday, ${format(date, "MMM d")}`;
    return format(date, "EEE, MMM d");
  }

  if (period === "7d") {
    const { start, end } = getDateRangeForPeriod("7d", offset);
    return `${format(start, "MMM d")} – ${format(end, "MMM d")}`;
  }

  if (period === "30d") {
    const { start, end } = getDateRangeForPeriod("30d", offset);
    return `${format(start, "MMM d")} – ${format(end, "MMM d")}`;
  }

  return "";
}

function formatCallDuration(seconds: number): string {
  if (seconds === 0) return "0s";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}

function formatReviewTime(minutes: number): string {
  if (minutes === 0) return "0 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function buildSankeyData(
  data: AnalyticsData,
): { nodes: SankeyNode[]; links: SankeyLink[] } {
  const nodes: SankeyNode[] = [];
  const links: SankeyLink[] = [];

  const sankey = data.sankey?.by_intent;
  if (!sankey || sankey.total === 0) return { nodes, links };

  nodes.push({ id: "total", label: "All Calls", value: sankey.total, layer: 0, color: TOTAL_COLOR });

  if (sankey.transferred > 0) {
    nodes.push({ id: "transferred", label: "Transferred", value: sankey.transferred, layer: 1, color: TRANSFERRED_COLOR });
    links.push({ source: "total", target: "transferred", value: sankey.transferred });
  }

  const sortedNonTransferred = Object.entries(sankey.non_transferred_intents)
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1]);

  sortedNonTransferred.forEach(([category, count], idx) => {
    const color = INTENT_COLORS[idx % INTENT_COLORS.length];
    nodes.push({ id: `nt_${idx}`, label: category, value: count, layer: 1, color });
    links.push({ source: "total", target: `nt_${idx}`, value: count });
  });

  if (sankey.transferred > 0) {
    const sortedExtensions = Object.entries(sankey.transferred_extensions)
      .filter(([, c]) => c > 0)
      .sort((a, b) => b[1] - a[1]);

    sortedExtensions.forEach(([extension, count], idx) => {
      const color = INTENT_COLORS[idx % INTENT_COLORS.length];
      nodes.push({ id: `tr_${idx}`, label: extension, value: count, layer: 2, color });
      links.push({ source: "transferred", target: `tr_${idx}`, value: count });
    });
  }

  return { nodes, links };
}

function buildSankeyDataByDoctor(
  data: AnalyticsData,
): { nodes: SankeyNode[]; links: SankeyLink[] } {
  const nodes: SankeyNode[] = [];
  const links: SankeyLink[] = [];

  const sankey = data.sankey?.by_doctor;
  if (!sankey || sankey.total === 0) return { nodes, links };

  nodes.push({ id: "total", label: "All Calls", value: sankey.total, layer: 0, color: TOTAL_COLOR });

  const sortedDoctors = Object.entries(sankey.all_doctors)
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1]);

  sortedDoctors.forEach(([doctor, count], idx) => {
    const color = INTENT_COLORS[idx % INTENT_COLORS.length];
    const nodeId = `doc_${idx}`;
    nodes.push({ id: nodeId, label: doctor, value: count, layer: 1, color });
    links.push({ source: "total", target: nodeId, value: count });
  });

  return { nodes, links };
}

interface DrillDownState {
  filterType: "intent" | "extension" | "doctor";
  filterValue: string;
  label: string;
}

function AnalyticsContent() {
  const { user } = useAppSelector((state) => state.auth);
  const { users } = useAppSelector((state) => state.users);
  const { practice } = useAppSelector((state) => state.practice);

  const practiceTeams: Team[] = useMemo(() => {
    return practice?.teams?.teams || [];
  }, [practice]);

  const [period, setPeriod] = useState<Period>("1d");
  const [offset, setOffset] = useState(0);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [dailyBreakdown, setDailyBreakdown] = useState<Record<string, { total_calls: number; needs_review: number }> | null>(null);
  const dailyBreakdownRef = useRef(dailyBreakdown);
  dailyBreakdownRef.current = dailyBreakdown;
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortField>("needs_review");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [callFlowTab, setCallFlowTab] = useState<string>("by_intent");
  const [selectedSankeyNodeId, setSelectedSankeyNodeId] = useState<string | null>(null);
  const [drillDown, setDrillDown] = useState<DrillDownState | null>(null);
  const [drillDownCalls, setDrillDownCalls] = useState<Call[]>([]);
  const [drillDownLoading, setDrillDownLoading] = useState(false);
  const [drillDownSearch, setDrillDownSearch] = useState("");
  const [drillDownReviewFilter, setDrillDownReviewFilter] = useState<"all" | "reviewed" | "needs_reviewed">("all");
  const [selectedCall, setSelectedCall] = useState<CallDetail | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const callRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const drillDownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsLargeScreen(mql.matches);
    setIsLargeScreen(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDrillDown(null);
    setDrillDownCalls([]);
    setIsPanelOpen(false);
    setSelectedCall(null);
    try {
      const { start, end } = getDateRangeForPeriod(period, offset);
      const response = await apiClient.get<ApiResponse<AnalyticsData>>("/api/analytics", {
        params: {
          start_datetime: start.toISOString(),
          end_datetime: end.toISOString(),
        },
      });
      if (response.data.success && response.data.data) {
        setData(response.data.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [period, offset]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    if (!datePickerOpen || period === "all") {
      setDailyBreakdown(null);
      return;
    }
    setDailyBreakdown(null);
    const selectedDate = period === "1d"
      ? (() => {
          const d = new Date();
          d.setDate(d.getDate() - offset);
          return d;
        })()
      : getDateRangeForPeriod(period, offset).end;
    const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const end = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);

    const fetchDaily = async () => {
      try {
        const response = await apiClient.get<ApiResponse<Record<string, { total_calls: number; needs_review: number }>>>(
          "/api/analytics/daily-breakdown",
          {
            params: {
              start_date: format(start, "yyyy-MM-dd"),
              end_date: format(end, "yyyy-MM-dd"),
              tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          }
        );
        if (response.data.success && response.data.data) {
          setDailyBreakdown(response.data.data);
        }
      } catch {
        setDailyBreakdown(null);
      }
    };
    fetchDaily();
  }, [datePickerOpen, period, offset]);

  const handlePeriodChange = (newPeriod: Period) => {
    setPeriod(newPeriod);
    setOffset(0);
  };

  const canGoNext = period !== "all" && offset > 0;
  const canGoPrev = period !== "all";

  const currentPeriodLabel = PERIODS.find((p) => p.value === period)?.label || "";
  const dateRangeLabel = formatDateRange(period, offset);

  const StableDayButton = useCallback((props: React.ComponentProps<typeof CalendarDayButton>) => {
    return <CalendarDayButton {...props} />;
  }, []);

  const calendarComponents = useMemo(() => ({ DayButton: StableDayButton }), [StableDayButton]);

  const sankeyDataByIntent = useMemo(() => {
    if (!data) return { nodes: [], links: [] };
    return buildSankeyData(data);
  }, [data]);

  const sankeyDataByDoctor = useMemo(() => {
    if (!data) return { nodes: [], links: [] };
    return buildSankeyDataByDoctor(data);
  }, [data]);

  const sortedDoctors = useMemo(() => {
    if (!data) return [];
    const sorted = [...data.doctor_breakdown];
    sorted.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "doctor_name":
          comparison = a.doctor_name.localeCompare(b.doctor_name);
          break;
        case "total_calls":
          comparison = a.total_calls - b.total_calls;
          break;
        case "review_completion_rate":
          comparison = a.review_completion_rate - b.review_completion_rate;
          break;
        case "needs_review":
          comparison = a.needs_review - b.needs_review;
          break;
        case "avg_review_time_minutes":
          comparison = (a.avg_review_time_minutes ?? 0) - (b.avg_review_time_minutes ?? 0);
          break;
        default:
          comparison = 0;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [data, sortBy, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const handleSankeyNodeClick = useCallback(
    async (node: SankeyNode, tab: "by_intent" | "by_doctor") => {
      if (period !== "1d") return;

      let filterType: "intent" | "extension" | "doctor";
      if (node.id.startsWith("tr_")) {
        filterType = "extension";
      } else if (tab === "by_intent") {
        filterType = "intent";
      } else {
        filterType = "doctor";
      }

      const newDrillDown: DrillDownState = {
        filterType,
        filterValue: node.label,
        label: node.label,
      };

      setDrillDown(newDrillDown);
      setSelectedSankeyNodeId(node.id);
      setDrillDownLoading(true);
      setDrillDownCalls([]);
      setDrillDownSearch("");
      setDrillDownReviewFilter("all");
      setIsPanelOpen(false);
      setSelectedCall(null);

      try {
        const { start, end } = getDateRangeForPeriod(period, offset);
        const response = await apiClient.get<ApiResponse<Call[]>>("/api/analytics/calls", {
          params: {
            start_datetime: start.toISOString(),
            end_datetime: end.toISOString(),
            filter_type: filterType,
            filter_value: node.label,
          },
        });
        if (response.data.success && response.data.data) {
          setDrillDownCalls(response.data.data);
        }
      } catch {
        toast.error("Failed to load calls");
        setDrillDown(null);
      } finally {
        setDrillDownLoading(false);
        setTimeout(() => {
          drillDownRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    },
    [period, offset],
  );

  const handleDoctorRowClick = useCallback(
    (doctorName: string) => {
      if (period !== "1d") return;
      setCallFlowTab("by_doctor");
      const node = sankeyDataByDoctor.nodes.find((n) => n.label === doctorName);
      if (node) {
        setTimeout(() => {
          handleSankeyNodeClick(node, "by_doctor");
        }, 150);
      }
    },
    [period, sankeyDataByDoctor.nodes, handleSankeyNodeClick],
  );

  const handleSelectCall = useCallback((call: Call) => {
    setIsPanelOpen(true);
    setSelectedCall(call as CallDetail);
    setTimeout(() => {
      const rowElement = callRowRefs.current[call.id];
      if (rowElement) {
        rowElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 0);
  }, []);

  const handleClosePanel = useCallback(() => {
    setIsPanelOpen(false);
    setSelectedCall(null);
  }, []);

  const handleToggleReview = async (callId: string, isReviewed: boolean) => {
    setDrillDownCalls((prev) =>
      prev.map((c) => (c.id === callId ? { ...c, is_reviewed: isReviewed } : c)),
    );
    if (selectedCall?.id === callId) {
      setSelectedCall((prev) => (prev ? { ...prev, is_reviewed: isReviewed } : prev));
    }

    try {
      const response = await apiClient.patch<ApiResponse<CallDetail>>(
        `/api/calls/${callId}/review`,
        { is_reviewed: isReviewed },
      );
      if (response.data.success && response.data.data) {
        setDrillDownCalls((prev) =>
          prev.map((c) => (c.id === callId ? response.data.data! : c)),
        );
        if (selectedCall?.id === callId) {
          setSelectedCall(response.data.data);
        }
      }
    } catch {
      setDrillDownCalls((prev) =>
        prev.map((c) => (c.id === callId ? { ...c, is_reviewed: !isReviewed } : c)),
      );
      if (selectedCall?.id === callId) {
        setSelectedCall((prev) => (prev ? { ...prev, is_reviewed: !isReviewed } : prev));
      }
      toast.error("Failed to update review status");
    }
  };

  const handleToggleFlag = async (callId: string, isFlagged: boolean) => {
    setDrillDownCalls((prev) =>
      prev.map((c) => (c.id === callId ? { ...c, is_flagged: isFlagged } : c)),
    );
    if (selectedCall?.id === callId) {
      setSelectedCall((prev) => (prev ? { ...prev, is_flagged: isFlagged } : prev));
    }

    try {
      const response = await apiClient.patch<ApiResponse<CallDetail>>(
        `/api/calls/${callId}/flag`,
        { is_flagged: isFlagged },
      );
      if (response.data.success && response.data.data) {
        setDrillDownCalls((prev) =>
          prev.map((c) => (c.id === callId ? response.data.data! : c)),
        );
        if (selectedCall?.id === callId) {
          setSelectedCall(response.data.data);
        }
      }
    } catch {
      setDrillDownCalls((prev) =>
        prev.map((c) => (c.id === callId ? { ...c, is_flagged: !isFlagged } : c)),
      );
      if (selectedCall?.id === callId) {
        setSelectedCall((prev) => (prev ? { ...prev, is_flagged: !isFlagged } : prev));
      }
      toast.error("Failed to update flag status");
    }
  };

  const handleUpdateTeams = async (callId: string, teams: string[]) => {
    try {
      const response = await apiClient.patch<ApiResponse<CallDetail>>(
        `/api/calls/${callId}/teams`,
        { call_teams: teams },
      );
      if (response.data.success && response.data.data) {
        setDrillDownCalls((prev) =>
          prev.map((c) => (c.id === callId ? response.data.data! : c)),
        );
        if (selectedCall?.id === callId) {
          setSelectedCall(response.data.data);
        }
      }
    } catch {
      toast.error("Failed to update teams");
    }
  };

  const handleDeleteCall = async (callId: string): Promise<void> => {
    try {
      await apiClient.delete(`/api/calls/${callId}`);
      setDrillDownCalls((prev) => prev.filter((c) => c.id !== callId));
      if (selectedCall?.id === callId) {
        setIsPanelOpen(false);
        setSelectedCall(null);
      }
      toast.success("Call deleted successfully");
    } catch {
      toast.error("Failed to delete call");
    }
  };

  const handleCloseDrillDown = () => {
    setDrillDown(null);
    setSelectedSankeyNodeId(null);
    setDrillDownCalls([]);
    setDrillDownSearch("");
    setDrillDownReviewFilter("all");
    setIsPanelOpen(false);
    setSelectedCall(null);
  };

  const filteredDrillDownCalls = useMemo(() => {
    let filtered = drillDownCalls;

    if (drillDownReviewFilter === "reviewed") {
      filtered = filtered.filter((c) => c.is_reviewed);
    } else if (drillDownReviewFilter === "needs_reviewed") {
      filtered = filtered.filter((c) => !c.is_reviewed);
    }

    if (drillDownSearch) {
      const query = drillDownSearch.toLowerCase();
      filtered = filtered.filter((c) => {
        const callerName = c.display_data?.caller_name || "";
        const patientName = c.display_data?.patient_name || "";
        const phoneNumber = c.display_data?.phone_number || "";
        const summary = c.display_data?.summary || "";
        return (
          callerName.toLowerCase().includes(query) ||
          patientName.toLowerCase().includes(query) ||
          phoneNumber.includes(query) ||
          summary.toLowerCase().includes(query)
        );
      });
    }

    return filtered;
  }, [drillDownCalls, drillDownReviewFilter, drillDownSearch]);

  return (
    <div
      ref={contentRef}
      className="flex flex-col h-screen transition-all duration-300"
      style={{
        marginRight: isPanelOpen && isLargeScreen ? "calc(50vw - 1.5rem)" : "0",
      }}
    >
      <header className="sticky top-0 z-10 bg-white">
        <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-[24px] font-semibold tracking-tight text-neutral-900">Analytics</h1>
              <p className="mt-1 text-[15px] text-neutral-500">Call analytics and performance metrics</p>
            </div>
            <div className="flex items-center border border-neutral-200 bg-white overflow-hidden">
              <button
                className="h-9 w-9 flex items-center justify-center hover:bg-neutral-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={fetchAnalytics}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
              </button>
              <div className="w-px h-9 bg-neutral-200" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-9 px-3 flex items-center gap-1.5 hover:bg-neutral-50 transition-colors text-[13px] font-medium text-neutral-900" disabled={loading}>
                    {currentPeriodLabel}
                    <ChevronDown className="h-3 w-3 text-neutral-500" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {PERIODS.map((p) => (
                    <DropdownMenuItem
                      key={p.value}
                      onClick={() => handlePeriodChange(p.value)}
                      className={period === p.value ? "bg-neutral-100" : ""}
                    >
                      {p.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="w-px h-9 bg-neutral-200" />
              <button
                className="h-9 w-9 flex items-center justify-center hover:bg-neutral-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setOffset(offset + 1)}
                disabled={!canGoPrev || loading}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    className="min-w-[120px] h-9 flex items-center justify-center hover:bg-neutral-50 transition-colors text-[13px] font-medium text-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={loading || period === "all"}
                  >
                    {dateRangeLabel}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
                  <TooltipProvider delayDuration={300}>
                    {period === "1d" ? (
                      <>
                        {offset !== 0 && (
                          <div className="p-3 border-b">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full h-9"
                              onClick={() => {
                                setOffset(0);
                                setDatePickerOpen(false);
                              }}
                            >
                              Today
                            </Button>
                          </div>
                        )}
                        <Calendar
                          mode="single"
                          selected={(() => {
                            const d = new Date();
                            d.setDate(d.getDate() - offset);
                            d.setHours(0, 0, 0, 0);
                            return d;
                          })()}
                          onSelect={(date) => {
                            if (!date) return;
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            date.setHours(0, 0, 0, 0);
                            const diffMs = today.getTime() - date.getTime();
                            const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
                            setOffset(Math.max(0, diffDays));
                            setDatePickerOpen(false);
                          }}
                          disabled={(date) => date > new Date()}
                          components={calendarComponents}
                        />
                      </>
                    ) : period === "7d" || period === "30d" ? (
                      <Calendar
                        mode="single"
                        selected={getDateRangeForPeriod(period, offset).end}
                        onSelect={(date) => {
                          if (!date) return;
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          date.setHours(0, 0, 0, 0);
                          if (date > today) return;
                          setPeriod("1d");
                          const diffMs = today.getTime() - date.getTime();
                          setOffset(Math.round(diffMs / (24 * 60 * 60 * 1000)));
                          setDatePickerOpen(false);
                        }}
                        disabled={(date) => date > new Date()}
                        components={calendarComponents}
                      />
                    ) : null}
                  </TooltipProvider>
                </PopoverContent>
              </Popover>
              <button
                className="h-9 w-9 flex items-center justify-center hover:bg-neutral-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setOffset(offset - 1)}
                disabled={!canGoNext || loading}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 py-4 sm:py-6 scrollbar-hide">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
            <p className="mt-4 text-sm text-neutral-500">Loading analytics...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <p className="text-sm text-neutral-500">{error}</p>
            <Button variant="outline" onClick={fetchAnalytics}>Retry</Button>
          </div>
        ) : data ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label="Total Calls"
                value={data.cards.total_calls.toLocaleString()}
                icon={<Phone className="h-4 w-4 text-neutral-400" />}
              />
              <MetricCard
                label="Avg Call Duration"
                value={formatCallDuration(data.cards.avg_call_duration_seconds)}
                icon={<Clock className="h-4 w-4 text-neutral-400" />}
              />
              <MetricCard
                label="Review Completion"
                value={`${(data.cards.review_completion_rate * 100).toFixed(1)}%`}
                icon={<CheckCircle2 className="h-4 w-4 text-neutral-400" />}
              />
              <MetricCard
                label="Avg Review Time"
                value={formatReviewTime(data.cards.avg_review_time_minutes)}
                icon={<Timer className="h-4 w-4 text-neutral-400" />}
              />
            </div>

            <div className="border border-neutral-200 bg-white p-3 sm:p-4 md:p-6">
              <h2 className="text-[15px] font-semibold text-neutral-900 mb-4">Call Flow</h2>
              <Tabs value={callFlowTab} onValueChange={(v) => { setCallFlowTab(v); handleCloseDrillDown(); }}>
                <TabsList>
                  <TabsTrigger value="by_intent">By Intent</TabsTrigger>
                  <TabsTrigger value="by_doctor">By Doctor</TabsTrigger>
                </TabsList>
                <TabsContent value="by_intent">
                  <div className="hidden sm:block">
                    <SankeyDiagram
                      nodes={sankeyDataByIntent.nodes}
                      links={sankeyDataByIntent.links}
                      onNodeClick={period === "1d" ? (node) => handleSankeyNodeClick(node, "by_intent") : undefined}
                      selectedNodeId={callFlowTab === "by_intent" ? selectedSankeyNodeId : null}
                    />
                  </div>
                  <div className="sm:hidden">
                    <SankeyMobileStepper
                      nodes={sankeyDataByIntent.nodes}
                      links={sankeyDataByIntent.links}
                      onNodeClick={period === "1d" ? (node) => handleSankeyNodeClick(node, "by_intent") : undefined}
                      selectedNodeId={callFlowTab === "by_intent" ? selectedSankeyNodeId : null}
                    />
                  </div>
                </TabsContent>
                <TabsContent value="by_doctor">
                  <div className="hidden sm:block">
                    <SankeyDiagram
                      nodes={sankeyDataByDoctor.nodes}
                      links={sankeyDataByDoctor.links}
                      onNodeClick={period === "1d" ? (node) => handleSankeyNodeClick(node, "by_doctor") : undefined}
                      selectedNodeId={callFlowTab === "by_doctor" ? selectedSankeyNodeId : null}
                    />
                  </div>
                  <div className="sm:hidden">
                    <SankeyMobileStepper
                      nodes={sankeyDataByDoctor.nodes}
                      links={sankeyDataByDoctor.links}
                      onNodeClick={period === "1d" ? (node) => handleSankeyNodeClick(node, "by_doctor") : undefined}
                      selectedNodeId={callFlowTab === "by_doctor" ? selectedSankeyNodeId : null}
                    />
                  </div>
                </TabsContent>
              </Tabs>

              {drillDown && (
                <div ref={drillDownRef} className="mt-4 sm:mt-6 border-t border-neutral-200 pt-4 sm:pt-6">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <h3 className="text-[13px] sm:text-[14px] font-semibold text-neutral-900">
                      {drillDown.label}
                      <span className="ml-1.5 sm:ml-2 text-[12px] sm:text-[13px] font-normal text-neutral-500">
                        ({filteredDrillDownCalls.length} of {drillDownCalls.length} {drillDownCalls.length === 1 ? "call" : "calls"})
                      </span>
                    </h3>
                    <button
                      onClick={handleCloseDrillDown}
                      className="p-1 hover:bg-neutral-100 transition-colors rounded"
                    >
                      <X className="h-4 w-4 text-neutral-500" />
                    </button>
                  </div>
                  <div className="flex gap-2 md:gap-3 mb-3 sm:mb-4">
                    <div className="relative min-w-0 flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
                      <Input
                        type="text"
                        placeholder="Search calls"
                        value={drillDownSearch}
                        onChange={(e) => setDrillDownSearch(e.target.value)}
                        className="pl-9 h-8 border-neutral-200 bg-white text-neutral-600 md:h-9 md:text-neutral-900"
                      />
                    </div>
                    <div className="flex shrink-0 bg-white rounded-md border border-neutral-200">
                      <button
                        onClick={() => setDrillDownReviewFilter("all")}
                        title="All"
                        className={cn(
                          "px-2 py-1.5 text-[13px] font-medium transition-colors flex items-center gap-1.5 md:px-3",
                          drillDownReviewFilter === "all"
                            ? "bg-neutral-900 text-white rounded-l"
                            : "text-neutral-600 hover:text-neutral-900",
                        )}
                      >
                        <List className={cn("h-3.5 w-3.5", drillDownReviewFilter === "all" ? "text-white" : "text-neutral-400")} />
                        <span className="hidden md:inline">All</span>
                      </button>
                      <button
                        onClick={() => setDrillDownReviewFilter("reviewed")}
                        title="Reviewed"
                        className={cn(
                          "px-2 py-1.5 text-[13px] font-medium transition-colors flex items-center gap-1.5 md:px-3",
                          drillDownReviewFilter === "reviewed"
                            ? "bg-neutral-900 text-white"
                            : "text-neutral-600 hover:text-neutral-900",
                        )}
                      >
                        <CheckCircle2 className={cn("h-3.5 w-3.5", drillDownReviewFilter === "reviewed" ? "text-white" : "text-green-600")} />
                        <span className="hidden md:inline">Reviewed</span>
                      </button>
                      <button
                        onClick={() => setDrillDownReviewFilter("needs_reviewed")}
                        title="Needs Review"
                        className={cn(
                          "px-2 py-1.5 text-[13px] font-medium transition-colors flex items-center gap-1.5 md:px-3",
                          drillDownReviewFilter === "needs_reviewed"
                            ? "bg-neutral-900 text-white rounded-r"
                            : "text-neutral-600 hover:text-neutral-900",
                        )}
                      >
                        <Circle className={cn("h-3.5 w-3.5", drillDownReviewFilter === "needs_reviewed" ? "text-white" : "text-amber-600")} strokeWidth={2} />
                        <span className="hidden whitespace-nowrap md:inline">Needs Review</span>
                      </button>
                    </div>
                  </div>
                  <CallsTable
                    calls={filteredDrillDownCalls}
                    onSelectCall={handleSelectCall}
                    loading={drillDownLoading}
                    onToggleReview={handleToggleReview}
                    isPanelOpen={isPanelOpen}
                    callRowRefs={callRowRefs}
                    selectedCallId={selectedCall?.id || null}
                    showDate={false}
                    users={users}
                  />
                </div>
              )}
            </div>

            <div>
              <h2 className="text-[15px] font-semibold text-neutral-900 mb-4">Doctor Breakdown</h2>


              <div className="sm:hidden border border-neutral-200 bg-white">
                {sortedDoctors.length === 0 ? (
                  <div className="px-4 py-8 text-center text-neutral-500 text-[13px]">
                    No data available for this period
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-100">
                    {sortedDoctors.map((doctor) => {
                      const reviewPct = Math.round(doctor.review_completion_rate * 100);
                      const reviewers = doctor.performers
                        .map((p) => ({
                          name: p.user_name === "Auto-Review" ? "Auto-Review" : p.user_name.split(/\s+/)[0],
                          reviews: p.reviews,
                          isAuto: p.user_name === "Auto-Review",
                        }))
                        .sort((a, b) => {
                          if (a.isAuto && !b.isAuto) return 1;
                          if (!a.isAuto && b.isAuto) return -1;
                          return b.reviews - a.reviews;
                        });

                      return (
                        <div
                          key={doctor.doctor_name}
                          className={cn(
                            "px-4 py-3 transition-colors",
                            period === "1d" && "cursor-pointer hover:bg-neutral-50 active:bg-neutral-100"
                          )}
                          onClick={period === "1d" ? () => handleDoctorRowClick(doctor.doctor_name) : undefined}
                        >
                          <div className="mb-1.5">
                            <span className="text-[13px] font-semibold text-neutral-900">{doctor.doctor_name}</span>
                          </div>
                          <div className="flex items-center gap-2.5 mb-1.5">
                            <div className="h-1.5 flex-1 rounded-full bg-neutral-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all"
                                style={{ width: `${reviewPct}%` }}
                              />
                            </div>
                            <span className="shrink-0 text-[12px] font-semibold tabular-nums text-neutral-700">{doctor.reviewed}/{doctor.total_calls}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-neutral-400">
                            {doctor.avg_review_time_minutes !== null && (
                              <span>{formatReviewTime(doctor.avg_review_time_minutes)} avg</span>
                            )}
                            {reviewers.length > 0 && (
                              <span>
                                {reviewers.map((r, i) => (
                                  <span key={r.name}>
                                    {i > 0 && ", "}
                                    <span className={r.isAuto ? "text-neutral-400" : "text-neutral-500"}>{r.name}</span>
                                    <span className="tabular-nums"> {r.reviews}</span>
                                  </span>
                                ))}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <TooltipProvider delayDuration={200}>
                <div className="hidden sm:block border border-neutral-200 bg-white overflow-x-auto">
                  <Table style={{ tableLayout: "fixed", minWidth: "650px", width: "100%" }}>
                    <colgroup>
                      <col style={{ width: "30%" }} />
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "16%" }} />
                      <col style={{ width: "16%" }} />
                      <col style={{ width: "24%" }} />
                    </colgroup>
                    <TableHeader>
                      <TableRow className="bg-neutral-50 hover:bg-neutral-50">
                        <TableHead className="text-neutral-700 px-4 py-3 cursor-pointer hover:bg-neutral-100 text-[13px] font-medium" onClick={() => handleSort("doctor_name")}>
                          Doctor <SortIcon column="doctor_name" sortBy={sortBy} sortOrder={sortOrder} />
                        </TableHead>
                        <TableHead className="text-neutral-700 px-4 py-3 cursor-pointer hover:bg-neutral-100 text-[13px] font-medium" onClick={() => handleSort("total_calls")}>
                          Calls <SortIcon column="total_calls" sortBy={sortBy} sortOrder={sortOrder} />
                        </TableHead>
                        <TableHead className="text-neutral-700 px-4 py-3 cursor-pointer hover:bg-neutral-100 text-[13px] font-medium" onClick={() => handleSort("needs_review")}>
                          Needs Review <SortIcon column="needs_review" sortBy={sortBy} sortOrder={sortOrder} />
                        </TableHead>
                        <TableHead className="text-neutral-700 px-4 py-3 cursor-pointer hover:bg-neutral-100 text-[13px] font-medium" onClick={() => handleSort("review_completion_rate")}>
                          Review Rate <SortIcon column="review_completion_rate" sortBy={sortBy} sortOrder={sortOrder} />
                        </TableHead>
                        <TableHead className="text-neutral-700 px-4 py-3 cursor-pointer hover:bg-neutral-100 text-[13px] font-medium" onClick={() => handleSort("avg_review_time_minutes")}>
                          Avg Review Time <SortIcon column="avg_review_time_minutes" sortBy={sortBy} sortOrder={sortOrder} />
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedDoctors.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-neutral-500 py-8">No data available for this period</TableCell>
                        </TableRow>
                      ) : (
                        <>
                          {sortedDoctors.map((doctor) => {
                            const reviewPct = (doctor.review_completion_rate * 100).toFixed(0);
                            const allReviewers = doctor.performers
                              .map((p) => ({
                                name: p.user_name === "Auto-Review" ? "Auto-Review" : p.user_name.split(/\s+/)[0],
                                reviews: p.reviews,
                                percentage: p.percentage,
                                isAuto: p.user_name === "Auto-Review",
                              }))
                              .sort((a, b) => {
                                if (a.isAuto && !b.isAuto) return 1;
                                if (!a.isAuto && b.isAuto) return -1;
                                return b.reviews - a.reviews;
                              });
                            return (
                              <TableRow
                                key={doctor.doctor_name}
                                className={cn("hover:bg-neutral-50", period === "1d" && "cursor-pointer")}
                                onClick={period === "1d" ? () => handleDoctorRowClick(doctor.doctor_name) : undefined}
                              >
                                <TableCell className="px-4 py-3">
                                  <span className="font-medium text-neutral-900 text-[13px]">{doctor.doctor_name}</span>
                                </TableCell>
                                <TableCell className="px-4 py-3 text-neutral-900 font-medium text-[13px]">
                                  {doctor.total_calls.toLocaleString()}
                                </TableCell>
                                <TableCell className="px-4 py-3 text-neutral-600 text-[13px]">
                                  {doctor.needs_review}
                                </TableCell>
                                <TableCell className="px-4 py-3">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-neutral-600 text-[13px] cursor-default border-b border-dashed border-neutral-300">
                                        {reviewPct}%
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" align="start" className="p-0">
                                      <div className="px-3 py-2 space-y-1.5">
                                        <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
                                          {doctor.reviewed} of {doctor.total_calls} reviewed
                                        </p>
                                        {allReviewers.map((r) => (
                                          <div key={r.name} className="flex items-center justify-between gap-4 text-[12px]">
                                            <span className="text-neutral-200">{r.name}</span>
                                            <span className="text-neutral-400 tabular-nums">{r.reviews} ({r.percentage}%)</span>
                                          </div>
                                        ))}
                                        {allReviewers.length === 0 && (
                                          <p className="text-[11px] text-neutral-400">No reviews yet</p>
                                        )}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TableCell>
                                <TableCell className="px-4 py-3 text-neutral-600 text-[13px]">
                                  {doctor.avg_review_time_minutes !== null ? formatReviewTime(doctor.avg_review_time_minutes) : "—"}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          <TableRow className="bg-neutral-50 hover:bg-neutral-50 border-t-2 border-neutral-200">
                            <TableCell className="px-4 py-3"><span className="font-semibold text-neutral-900 text-[13px]">Total</span></TableCell>
                            <TableCell className="px-4 py-3 text-neutral-900 font-semibold text-[13px]">{sortedDoctors.reduce((sum, d) => sum + d.total_calls, 0).toLocaleString()}</TableCell>
                            <TableCell className="px-4 py-3 text-neutral-600 text-[13px] font-medium">{sortedDoctors.reduce((sum, d) => sum + d.needs_review, 0)}</TableCell>
                            <TableCell className="px-4 py-3 text-neutral-600 text-[13px] font-medium">
                              {sortedDoctors.length > 0
                                ? `${((sortedDoctors.reduce((sum, d) => sum + d.reviewed, 0) / Math.max(1, sortedDoctors.reduce((sum, d) => sum + d.total_calls, 0))) * 100).toFixed(0)}%`
                                : "—"}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-neutral-600 text-[13px] font-medium">
                              {(() => {
                                const withTime = sortedDoctors.filter((d) => d.avg_review_time_minutes != null);
                                const totalWeighted = withTime.reduce((sum, d) => sum + (d.avg_review_time_minutes ?? 0) * d.total_calls, 0);
                                const totalCalls = withTime.reduce((sum, d) => sum + d.total_calls, 0);
                                return totalCalls > 0 ? formatReviewTime(totalWeighted / totalCalls) : "—";
                              })()}
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TooltipProvider>
            </div>
          </div>
        ) : null}
      </div>

      <CallDetailPanel
        call={selectedCall}
        loading={false}
        open={isPanelOpen}
        onClose={handleClosePanel}
        onToggleReview={handleToggleReview}
        onToggleFlag={handleToggleFlag}
        onUpdateTeams={handleUpdateTeams}
        onDeleteCall={handleDeleteCall}
        onNavigatePrev={(() => {
          const idx = selectedCall ? filteredDrillDownCalls.findIndex((c) => c.id === selectedCall.id) : -1;
          return idx > 0 ? () => { setSelectedCall(filteredDrillDownCalls[idx - 1] as CallDetail); } : undefined;
        })()}
        onNavigateNext={(() => {
          const idx = selectedCall ? filteredDrillDownCalls.findIndex((c) => c.id === selectedCall.id) : -1;
          return idx >= 0 && idx < filteredDrillDownCalls.length - 1 ? () => { setSelectedCall(filteredDrillDownCalls[idx + 1] as CallDetail); } : undefined;
        })()}
        isLargeScreen={isLargeScreen}
        users={users}
        currentUser={user}
        practiceTeams={practiceTeams}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">{label}</span>
        {icon}
      </div>
      <span className="text-2xl font-semibold text-neutral-900">{value}</span>
    </div>
  );
}

function SortIcon({
  column,
  sortBy,
  sortOrder,
}: {
  column: SortField;
  sortBy: SortField;
  sortOrder: "asc" | "desc";
}) {
  if (sortBy !== column) return null;
  return sortOrder === "asc" ? (
    <ChevronUp className="h-3 w-3 inline ml-1" />
  ) : (
    <ChevronDown className="h-3 w-3 inline ml-1" />
  );
}


export default function AnalyticsPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <AnalyticsContent />
    </Suspense>
  );
}
