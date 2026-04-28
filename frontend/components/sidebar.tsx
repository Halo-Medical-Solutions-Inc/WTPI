"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
  BarChart3,
  Inbox,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  User,
  Stethoscope,
  Search,
} from "lucide-react";
import { useAppSelector, useAppDispatch } from "@/store";
import { logout } from "@/store/slices/auth-slice";
import { clearSelectedCall } from "@/store/slices/calls-slice";
import { closeThread, setSelectedConversation } from "@/store/slices/messages-slice";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import InboxPopoverContent from "@/components/inbox-popover";

export function AppSidebar() {
  const pathname: string | null = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { practice } = useAppSelector((state) => state.practice);
  const { unreadTotal } = useAppSelector((state) => state.messages);
  const { unreadCount: mentionUnread } = useAppSelector((state) => state.mentions);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxClosing, setInboxClosing] = useState(false);
  const [inboxExpanded, setInboxExpanded] = useState(false);
  const inboxVisible = inboxOpen || inboxClosing;

  useEffect(() => {
    if (inboxOpen) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setInboxExpanded(true));
      });
    }
  }, [inboxOpen]);

  useEffect(() => {
    if (!inboxClosing) return;
    const timer = setTimeout(() => {
      setInboxClosing(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [inboxClosing]);

  const closeInbox = useCallback(() => {
    if (!inboxOpen) return;
    setInboxExpanded(false);
    setInboxOpen(false);
    setInboxClosing(true);
  }, [inboxOpen]);

  useEffect(() => {
    if (!inboxOpen) return;
    function handleEscape(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        closeInbox();
      }
    }
    document.addEventListener("keydown", handleEscape, true);
    return () => document.removeEventListener("keydown", handleEscape, true);
  }, [inboxOpen, closeInbox]);

  async function handleLogout(): Promise<void> {
    try {
      await dispatch(logout()).unwrap();
      router.push("/login");
    } catch {
      router.push("/login");
    }
  }

  function getInitials(name: string): string {
    return name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  return (
    <>
      <Sidebar collapsible="icon" className="border-r border-neutral-200">
        <SidebarHeader className="border-b border-neutral-200">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Image
                    src="/halo-icon.png"
                    alt="Halo Health"
                    width={32}
                    height={32}
                    className="object-contain"
                  />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {practice?.practice_name || "Practice Name"}
                  </span>
                  <span className="truncate text-xs">West Texas Pain Institute</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => {
                      if (pathname === "/dashboard") {
                        dispatch(clearSelectedCall());
                      }
                      router.push("/dashboard");
                    }}
                    isActive={pathname === "/dashboard"}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2"
                    tooltip="Dashboard"
                  >
                    <LayoutDashboard className="h-[18px] w-[18px]" />
                    <span className="text-[14px]">Dashboard</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setInboxOpen(true)}
                    isActive={inboxOpen}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2"
                    tooltip="Inbox"
                  >
                    <div className="relative">
                      <Inbox className="h-[18px] w-[18px]" />
                      {mentionUnread > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500">
                          <span className="sr-only">{mentionUnread} unread</span>
                        </span>
                      )}
                    </div>
                    <span className="text-[14px]">Inbox</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => {
                      if (pathname === "/messages") {
                        dispatch(setSelectedConversation(null));
                        dispatch(closeThread());
                      }
                      router.push("/messages");
                    }}
                    isActive={pathname === "/messages"}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2"
                    tooltip="Messages"
                  >
                    <div className="relative">
                      <MessageSquare className="h-[18px] w-[18px]" />
                      {unreadTotal > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500">
                          <span className="sr-only">{unreadTotal} unread</span>
                        </span>
                      )}
                    </div>
                    <span className="text-[14px]">Messages</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => router.push("/analytics")}
                    isActive={pathname === "/analytics"}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2"
                    tooltip="Analytics"
                  >
                    <BarChart3 className="h-[18px] w-[18px]" />
                    <span className="text-[14px]">Analytics</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => router.push("/search")}
                    isActive={pathname === "/search"}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2"
                    tooltip="Search"
                  >
                    <Search className="h-[18px] w-[18px]" />
                    <span className="text-[14px]">Search</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => router.push("/practice-settings")}
                    isActive={pathname === "/practice-settings"}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2"
                    tooltip="Practice"
                  >
                    <Stethoscope className="h-[18px] w-[18px]" />
                    <span className="text-[14px]">Practice</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>

              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-neutral-200">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="cursor-pointer data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-neutral-200 text-[12px] font-medium text-neutral-700">
                        {user ? getInitials(user.full_name) : "??"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {user?.full_name || "User"}
                      </span>
                      <span className="truncate text-xs">
                        {user?.role || ""}
                      </span>
                    </div>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-56"
                  side="right"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => router.push("/account-settings")}
                  >
                    <User className="mr-2 h-4 w-4" />
                    <span>Account Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    className="cursor-pointer"
                    onClick={handleLogout}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      {inboxVisible && (
        <>
          <div
            className="fixed inset-0 z-[60]"
            onClick={closeInbox}
          />
          <div
            className="fixed left-[3rem] top-0 z-[70] h-dvh overflow-hidden border-r border-neutral-200 bg-white shadow-md transition-[width] duration-200 ease-in-out"
            style={{ width: inboxExpanded ? "20rem" : "0" }}
          >
            <div className="h-full w-80">
              <InboxPopoverContent onClose={closeInbox} />
            </div>
          </div>
        </>
      )}
    </>
  );
}
