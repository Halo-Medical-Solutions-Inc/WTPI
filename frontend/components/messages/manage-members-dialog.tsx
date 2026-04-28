"use client";

import { useEffect, useMemo, useState } from "react";

import { Loader2, Search } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store";
import { fetchUsers } from "@/store/slices/users-slice";

interface ManageMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberIds: string[];
  conversationName: string;
  memberCount: number;
  isDefault: boolean;
  onAddMember: (userId: string) => void;
  onRemoveMember: (userId: string) => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ManageMembersDialog({
  open,
  onOpenChange,
  memberIds,
  conversationName,
  memberCount,
  isDefault,
  onAddMember,
  onRemoveMember,
}: ManageMembersDialogProps) {
  const dispatch = useAppDispatch();
  const { users, loading: usersLoading } = useAppSelector((state) => state.users);
  const { user: currentUser } = useAppSelector((state) => state.auth);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (open) {
      dispatch(fetchUsers());
      setSearchQuery("");
    }
  }, [open, dispatch]);

  const memberSet = useMemo(() => new Set(memberIds), [memberIds]);

  const filteredUsers = useMemo(() => {
    const base = isDefault ? users.filter((u) => memberSet.has(u.id)) : users;
    if (!searchQuery.trim()) return base;
    return base.filter((u) =>
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [users, searchQuery, isDefault, memberSet]);

  function handleToggle(userId: string): void {
    if (isDefault) return;
    if (userId === currentUser?.id) return;
    if (memberSet.has(userId)) {
      onRemoveMember(userId);
    } else {
      onAddMember(userId);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 sm:max-w-md">
        <DialogHeader className="px-5 pb-0 pt-5">
          <DialogTitle className="text-[16px]">{conversationName}</DialogTitle>
          <p className="text-[13px] text-neutral-500">
            Members {memberCount}
          </p>
        </DialogHeader>

        <div className="px-5 pb-1 pt-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              placeholder="Find members"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {usersLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
          </div>
        ) : (
          <ScrollArea className="max-h-[360px] px-2 pb-4">
            <div className="space-y-0.5">
              {filteredUsers.map((u) => {
                const isMember = memberSet.has(u.id);
                const isSelf = u.id === currentUser?.id;

                const clickable = !isDefault && !isSelf;

                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => clickable && handleToggle(u.id)}
                    disabled={!clickable}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                      clickable ? "cursor-pointer hover:bg-neutral-50" : "cursor-default",
                    )}
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="bg-neutral-200 text-[12px] font-medium text-neutral-700">
                        {getInitials(u.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[14px] font-medium text-neutral-900">
                          {u.full_name}
                        </span>
                      </div>
                      <span className="text-[12px] text-neutral-500">
                        {u.role === "SUPER_ADMIN" ? "HALO" : u.role}
                      </span>
                    </div>
                    {!isDefault && (
                      <div
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                          isMember
                            ? "border-neutral-900 bg-neutral-900"
                            : "border-neutral-300 bg-white",
                          isSelf && "opacity-40",
                        )}
                      >
                        {isMember && (
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
