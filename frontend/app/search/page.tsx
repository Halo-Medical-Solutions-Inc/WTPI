"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAppSelector } from "@/store";
import { CallsTable } from "@/components/calls/calls-table";
import { CallDetailPanel } from "@/components/calls/call-detail-panel";
import { Call } from "@/types/call";
import { SearchResult } from "@/types/call";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { ApiResponse } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const { users } = useAppSelector((state) => state.users);
  const { user } = useAppSelector((state) => state.auth);
  const { practice } = useAppSelector((state) => state.practice);
  const practiceTeams = practice?.teams?.teams || [];

  const initialQuery = searchParams.get("q") || "";
  const [searchQuery, setSearchQuery] = useState<string>(initialQuery);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [handledCallParam, setHandledCallParam] = useState<string | null>(null);
  const [urlQueryHandled, setUrlQueryHandled] = useState(false);
  const [urlCallLoading, setUrlCallLoading] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const callRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  useEffect(() => {
    const callId = searchParams.get("call");
    const cacheKey = callId ? `${callId}_${searchParams.get("t") || ""}` : null;
    if (callId && cacheKey !== handledCallParam) {
      setHandledCallParam(cacheKey);
      setUrlCallLoading(true);
      apiClient
        .get<ApiResponse<Call>>(`/api/calls/${callId}`)
        .then((response) => {
          if (response.data.success && response.data.data) {
            const callData = response.data.data;
            setSelectedCall(callData);
            setIsPanelOpen(true);
            setHasSearched(true);
            setSearchResults([
              {
                ...callData,
                relevance_score: 100,
                is_top_result: false,
              },
            ]);
          }
        })
        .catch(() => {
          toast.error("Failed to load call");
        })
        .finally(() => {
          setUrlCallLoading(false);
        });
    }
  }, [searchParams, handledCallParam]);

  useEffect(() => {
    if (initialQuery && !urlQueryHandled) {
      setUrlQueryHandled(true);
      setSearchQuery(initialQuery);
      setIsSearching(true);
      setHasSearched(true);
      apiClient
        .post<ApiResponse<SearchResult[]>>("/api/calls/search", {
          query: initialQuery.trim(),
        })
        .then((response) => {
          if (response.data.success && Array.isArray(response.data.data)) {
            setSearchResults(response.data.data);
          } else {
            setSearchResults([]);
          }
        })
        .catch(() => {
          toast.error("Search failed. Please try again.");
          setSearchResults([]);
        })
        .finally(() => {
          setIsSearching(false);
        });
    }
  }, [initialQuery, urlQueryHandled]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && isPanelOpen && selectedCall) {
        apiClient
          .get<ApiResponse<Call>>(`/api/calls/${selectedCall.id}`)
          .then((response) => {
            if (response.data.success && response.data.data) {
              setSelectedCall(response.data.data);
            }
          })
          .catch(() => {});
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isPanelOpen, selectedCall]);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsLargeScreen(mql.matches);
    setIsLargeScreen(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a search query");
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const response = await apiClient.post<ApiResponse<SearchResult[]>>("/api/calls/search", {
        query: searchQuery.trim(),
      });

      if (response.data.success && Array.isArray(response.data.data)) {
        setSearchResults(response.data.data);
      } else {
        setSearchResults([]);
      }
    } catch {
      toast.error("Search failed. Please try again.");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleSelectCall = useCallback((call: Call) => {
    setIsPanelOpen(true);
    setSelectedCall(call);

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
    const resultIndex = searchResults.findIndex((r) => r.id === callId);
    if (resultIndex === -1) return;

    const reviewedBy = isReviewed ? user?.id || null : null;
    const updatedResults = [...searchResults];
    updatedResults[resultIndex] = {
      ...updatedResults[resultIndex],
      is_reviewed: isReviewed,
      reviewed_by: reviewedBy,
    };
    setSearchResults(updatedResults);

    if (selectedCall && selectedCall.id === callId) {
      setSelectedCall({ ...selectedCall, is_reviewed: isReviewed, reviewed_by: reviewedBy });
    }

    try {
      await apiClient.patch<ApiResponse<Call>>(`/api/calls/${callId}/review`, {
        is_reviewed: isReviewed,
      });
    } catch {
      updatedResults[resultIndex] = {
        ...updatedResults[resultIndex],
        is_reviewed: !isReviewed,
      };
      setSearchResults(updatedResults);
      if (selectedCall && selectedCall.id === callId) {
        setSelectedCall({ ...selectedCall, is_reviewed: !isReviewed });
      }
      toast.error("Failed to update review status");
    }
  };

  const handleToggleFlag = async (callId: string, isFlagged: boolean) => {
    const resultIndex = searchResults.findIndex((r) => r.id === callId);
    if (resultIndex === -1) return;

    const flaggedBy = isFlagged ? user?.id || null : null;
    const updatedResults = [...searchResults];
    updatedResults[resultIndex] = {
      ...updatedResults[resultIndex],
      is_flagged: isFlagged,
      flagged_by: flaggedBy,
    };
    setSearchResults(updatedResults);

    if (selectedCall && selectedCall.id === callId) {
      setSelectedCall({ ...selectedCall, is_flagged: isFlagged, flagged_by: flaggedBy });
    }

    try {
      await apiClient.patch<ApiResponse<Call>>(`/api/calls/${callId}/flag`, {
        is_flagged: isFlagged,
      });
    } catch {
      updatedResults[resultIndex] = {
        ...updatedResults[resultIndex],
        is_flagged: !isFlagged,
      };
      setSearchResults(updatedResults);
      if (selectedCall && selectedCall.id === callId) {
        setSelectedCall({ ...selectedCall, is_flagged: !isFlagged });
      }
      toast.error("Failed to update flag status");
    }
  };

  const handleUpdateTeams = async (callId: string, teams: string[]) => {
    const resultIndex = searchResults.findIndex((r) => r.id === callId);
    if (resultIndex === -1) return;

    const original = searchResults[resultIndex];
    const updatedResults = [...searchResults];
    updatedResults[resultIndex] = {
      ...original,
      display_data: { ...original.display_data, call_teams: teams },
      extraction_data: { ...original.extraction_data, call_teams: teams },
    };
    setSearchResults(updatedResults);

    if (selectedCall && selectedCall.id === callId) {
      setSelectedCall({
        ...selectedCall,
        display_data: { ...selectedCall.display_data, call_teams: teams },
        extraction_data: { ...selectedCall.extraction_data, call_teams: teams },
      });
    }

    try {
      await apiClient.patch<ApiResponse<Call>>(`/api/calls/${callId}/teams`, {
        call_teams: teams,
      });
    } catch {
      setSearchResults((prev) => {
        const reverted = [...prev];
        const idx = reverted.findIndex((r) => r.id === callId);
        if (idx !== -1) {
          reverted[idx] = original;
        }
        return reverted;
      });
      if (selectedCall && selectedCall.id === callId) {
        setSelectedCall({
          ...selectedCall,
          display_data: { ...original.display_data },
          extraction_data: { ...original.extraction_data },
        });
      }
      toast.error("Failed to update teams");
    }
  };

  const handleDeleteCall = async (callId: string): Promise<void> => {
    try {
      await apiClient.delete<ApiResponse<null>>(`/api/calls/${callId}`);
      setSearchResults(searchResults.filter((r) => r.id !== callId));
      handleClosePanel();
      toast.success("Call deleted successfully");
    } catch {
      toast.error("Failed to delete call");
    }
  };


  const calls: Call[] = (searchResults || []).map((result) => ({
    id: result.id,
    twilio_call_sid: result.twilio_call_sid,
    vapi_call_id: result.vapi_call_id,
    display_data: result.display_data,
    vapi_data: result.vapi_data,
    extraction_data: result.extraction_data,
    extraction_status: result.extraction_status,
    status: result.status,
    is_reviewed: result.is_reviewed,
    reviewed_by: result.reviewed_by,
    reviewed_at: result.reviewed_at,
    is_flagged: result.is_flagged,
    flagged_by: result.flagged_by,
    flagged_at: result.flagged_at,
    created_at: result.created_at,
    updated_at: result.updated_at,
  }));

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

      const currentIndex = calls.findIndex((c) => c.id === selectedCall.id);
      if (currentIndex === -1) return;

      if ((event.key === "ArrowLeft" || event.key === "ArrowUp") && currentIndex > 0) {
        event.preventDefault();
        const previousCall = calls[currentIndex - 1];
        handleSelectCall(previousCall);
      } else if ((event.key === "ArrowRight" || event.key === "ArrowDown") && currentIndex < calls.length - 1) {
        event.preventDefault();
        const nextCall = calls[currentIndex + 1];
        handleSelectCall(nextCall);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPanelOpen, selectedCall, calls, handleSelectCall, handleClosePanel]);

  return (
    <div
      ref={contentRef}
      className="flex flex-col h-screen transition-all duration-300"
      style={{
        marginRight: isPanelOpen && isLargeScreen ? "calc(50vw - 1.5rem)" : "0",
      }}
    >
      <header className="sticky top-0 z-10 border-b border-neutral-100 bg-white">
        <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
          <div className="mb-4 sm:mb-6">
            <h1 className="text-[20px] sm:text-[24px] font-semibold tracking-tight text-neutral-900">Search</h1>
            <p className="mt-1 text-[13px] sm:text-[15px] text-neutral-500">
              Search across all calls by phone number, name, or details
            </p>
          </div>

          <div className="flex gap-2 sm:gap-3">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
              <Input
                type="text"
                placeholder="Phone, name, summary..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className={cn("pl-9 h-8 border-neutral-200 bg-white text-neutral-600 md:h-9 md:text-neutral-900", searchQuery && "pr-8")}
                disabled={isSearching}
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
            <Button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="h-8 px-4 sm:h-9 sm:px-6 rounded-none bg-neutral-900 text-white hover:bg-neutral-800 text-[13px]"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Search"
              )}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-hide sm:px-6 sm:py-6 lg:px-10">
        {!hasSearched ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="h-8 w-8 text-neutral-200 mb-4" />
            <p className="text-sm font-medium text-neutral-900">Enter a search query</p>
            <p className="mt-1 text-sm text-neutral-500">
              Search by phone number, patient name, or call summary
            </p>
          </div>
        ) : isSearching ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
          </div>
        ) : searchResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm font-medium text-neutral-900">No results found</p>
            <p className="mt-1 text-sm text-neutral-500">
              Try a different search query
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-neutral-600">
                Found {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
              </p>
            </div>

            {searchResults.length > 0 && searchResults[0].is_top_result && (
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 hover:bg-indigo-100">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Top Match - {Math.round(searchResults[0].relevance_score)}%
                </Badge>
              </div>
            )}

            <CallsTable
              calls={calls}
              onSelectCall={handleSelectCall}
              loading={false}
              onToggleReview={handleToggleReview}
              isPanelOpen={isPanelOpen}
              callRowRefs={callRowRefs}
              selectedCallId={selectedCall?.id || null}
              showDate={true}
              users={users}
            />
          </div>
        )}
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
          const idx = selectedCall ? calls.findIndex((c) => c.id === selectedCall.id) : -1;
          return idx > 0 ? () => { setSelectedCall(calls[idx - 1]); setIsPanelOpen(true); } : undefined;
        })()}
        onNavigateNext={(() => {
          const idx = selectedCall ? calls.findIndex((c) => c.id === selectedCall.id) : -1;
          return idx >= 0 && idx < calls.length - 1 ? () => { setSelectedCall(calls[idx + 1]); setIsPanelOpen(true); } : undefined;
        })()}
        isLargeScreen={isLargeScreen}
        users={users}
        currentUser={user}
        practiceTeams={practiceTeams}
      />
    </div>
  );
}
