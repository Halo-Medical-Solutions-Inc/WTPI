"use client";

import { useEffect, useState } from "react";

import { Loader2, X } from "lucide-react";

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

interface CreateChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, memberIds: string[]) => void;
}

export default function CreateChannelDialog({
  open,
  onOpenChange,
  onSubmit,
}: CreateChannelDialogProps) {
  const dispatch = useAppDispatch();
  const { users, loading: usersLoading } = useAppSelector((state) => state.users);
  const { user: currentUser } = useAppSelector((state) => state.auth);
  const [channelName, setChannelName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (open) {
      dispatch(fetchUsers());
      setChannelName("");
      setSelectedIds([]);
      setSearchQuery("");
    }
  }, [open, dispatch]);

  const availableUsers = users.filter((u) => u.id !== currentUser?.id);
  const filteredUsers = availableUsers.filter((u) =>
    u.full_name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  function toggleUser(userId: string): void {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

  function handleSubmit(): void {
    if (!channelName.trim()) return;
    const allMembers = [...selectedIds];
    if (currentUser && !allMembers.includes(currentUser.id)) {
      allMembers.push(currentUser.id);
    }
    onSubmit(channelName.trim(), allMembers);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Channel</DialogTitle>
          <DialogDescription>
            Create a new channel and add members.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-neutral-700">
              Channel Name
            </label>
            <Input
              placeholder="e.g. general, announcements"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[13px] font-medium text-neutral-700">
                Members
              </label>
              <button
                type="button"
                onClick={() => {
                  if (selectedIds.length === availableUsers.length) {
                    setSelectedIds([]);
                  } else {
                    setSelectedIds(availableUsers.map((u) => u.id));
                  }
                }}
                className="text-[12px] font-medium text-neutral-500 transition-colors hover:text-neutral-900"
              >
                {selectedIds.length === availableUsers.length ? "Deselect all" : "Select all"}
              </button>
            </div>
            {selectedIds.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {selectedIds.map((id) => {
                  const u = users.find((usr) => usr.id === id);
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
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mb-2"
            />
            {usersLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
              </div>
            ) : (
              <ScrollArea className="h-[160px] rounded-md border border-neutral-200">
                <div className="p-1">
                  {filteredUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleUser(u.id)}
                      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors ${
                        selectedIds.includes(u.id) ? "bg-neutral-100" : "hover:bg-neutral-50"
                      }`}
                    >
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-neutral-300">
                        {selectedIds.includes(u.id) && (
                          <div className="h-2.5 w-2.5 rounded-sm bg-neutral-900" />
                        )}
                      </div>
                      <span className="text-[13px] text-neutral-900">{u.full_name}</span>
                      <span className="text-[11px] text-neutral-500">{u.role}</span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!channelName.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
