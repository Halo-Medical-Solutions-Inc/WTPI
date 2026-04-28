"use client";

import { useEffect, useState } from "react";

import { Loader2, X } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppDispatch, useAppSelector } from "@/store";
import { fetchUsers } from "@/store/slices/users-slice";

interface CreateDmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (memberIds: string[]) => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function CreateDmDialog({
  open,
  onOpenChange,
  onSubmit,
}: CreateDmDialogProps) {
  const dispatch = useAppDispatch();
  const { users, loading: usersLoading } = useAppSelector((state) => state.users);
  const { user: currentUser } = useAppSelector((state) => state.auth);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (open) {
      dispatch(fetchUsers());
      setSelectedIds([]);
      setSearchQuery("");
    }
  }, [open, dispatch]);

  const sortedUsers = [...users].sort((a, b) => {
    if (a.id === currentUser?.id) return -1;
    if (b.id === currentUser?.id) return 1;
    return 0;
  });
  const filteredUsers = sortedUsers.filter((u) => {
    const displayName = u.full_name;
    return displayName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  function toggleUser(userId: string): void {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

  function handleSubmit(): void {
    if (selectedIds.length === 0) return;
    const allMembers = [...selectedIds];
    if (currentUser && !allMembers.includes(currentUser.id)) {
      allMembers.push(currentUser.id);
    }
    onSubmit(allMembers);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
          <DialogDescription>
            Select one or more people to start a conversation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedIds.map((id) => {
                const u = users.find((usr) => usr.id === id);
                const isSelf = id === currentUser?.id;
                return (
                  <Badge key={id} variant="secondary" className="gap-1 text-[11px]">
                    {u?.full_name || "Unknown"}
                    <button type="button" onClick={() => toggleUser(id)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}

          <Input
            placeholder="Search people..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {usersLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
            </div>
          ) : (
            <ScrollArea className="h-[240px] rounded-md border border-neutral-200">
              <div className="p-1">
                {filteredUsers.length === 0 ? (
                  <p className="py-4 text-center text-[13px] text-neutral-500">No users found</p>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelf = u.id === currentUser?.id;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleUser(u.id)}
                        className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors ${
                          selectedIds.includes(u.id) ? "bg-neutral-100" : "hover:bg-neutral-50"
                        }`}
                      >
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="bg-neutral-200 text-[10px] font-medium text-neutral-700">
                            {getInitials(u.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-neutral-900">
                            {u.full_name}
                          </p>
                          <p className="text-[11px] text-neutral-500">
                            {isSelf ? "Notes to self" : u.role}
                          </p>
                        </div>
                        <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-neutral-300">
                          {selectedIds.includes(u.id) && (
                            <div className="h-2 w-2 rounded-sm bg-neutral-900" />
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={selectedIds.length === 0}>
            {selectedIds.length <= 1 ? "Start Conversation" : "Create Group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
