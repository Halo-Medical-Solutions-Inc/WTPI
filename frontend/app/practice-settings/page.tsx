"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Edit, MoreVertical, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  cancelInvitation,
  createInvitation,
  resendInvitation,
} from "@/store/slices/invitations-slice";
import {
  addTeam,
  deleteTeam,
  fetchPractice,
  updatePractice,
  updateTeam,
  updateTeamMembers,
} from "@/store/slices/practice-slice";
import { deleteUser, updateUser } from "@/store/slices/users-slice";
import { Invitation } from "@/types/invitation";
import { PracticeUpdate, Team } from "@/types/practice";
import { User as UserType, UserRole } from "@/types/user";

const REGION_TO_TIMEZONE: Record<string, string> = {
  PST: "America/Los_Angeles",
  MST: "America/Denver",
  CST: "America/Chicago",
  EST: "America/New_York",
  Pacific: "America/Los_Angeles",
  Mountain: "America/Denver",
  Central: "America/Chicago",
  Eastern: "America/New_York",
  "America/Los_Angeles": "America/Los_Angeles",
  "America/Denver": "America/Denver",
  "America/Chicago": "America/Chicago",
  "America/New_York": "America/New_York",
};

interface TeamCardProps {
  team: Team;
  users: UserType[];
  onEdit: () => void;
  onDelete: () => void;
  onAddMember: (userId: string) => void;
  onRemoveMember: (userId: string) => void;
}

function TeamCard({
  team,
  users,
  onEdit,
  onDelete,
  onAddMember,
  onRemoveMember,
}: TeamCardProps) {
  const [addPopoverOpen, setAddPopoverOpen] = useState(false);
  const teamMembers = users.filter((u) => team.members.includes(u.id));
  const availableUsers = users.filter((u) => !team.members.includes(u.id));

  function handleAddMember(userId: string) {
    onAddMember(userId);
    setAddPopoverOpen(false);
  }

  return (
    <div
      className="rounded-lg border border-neutral-100"
      style={{ backgroundColor: "#FDFDFD" }}
    >
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14px] font-medium text-neutral-900">{team.title}</h3>
          {team.description && (
            <p className="mt-0.5 truncate text-[12px] text-neutral-500">{team.description}</p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <MoreVertical className="h-4 w-4 text-neutral-500" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto">
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="mr-2 h-4 w-4" />
              <span>Edit</span>
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="p-3">
        <div className="space-y-2">
          {teamMembers.map((member) => (
            <div
              key={member.id}
              className="group flex items-center justify-between rounded-md border border-neutral-100 bg-white px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-neutral-900">
                  {member.full_name}
                </p>
                <p className="truncate text-[11px] text-neutral-500">{member.email}</p>
              </div>
              <button
                type="button"
                aria-label={`Remove ${member.full_name} from this team`}
                onClick={() => onRemoveMember(member.id)}
                className="ml-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded opacity-100 transition-opacity hover:bg-neutral-100 touch-manipulation sm:opacity-0 sm:group-hover:opacity-100"
              >
                <X className="h-4 w-4 text-neutral-400" />
              </button>
            </div>
          ))}

          <Popover open={addPopoverOpen} onOpenChange={setAddPopoverOpen}>
            <PopoverTrigger asChild>
              <button className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-neutral-200 py-2 text-[13px] text-neutral-500 transition-colors hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-600">
                <Plus className="h-3.5 w-3.5" />
                Add Member
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <Command>
                <CommandInput placeholder="Search team members..." className="h-9" />
                <CommandList>
                  <CommandEmpty>No members found.</CommandEmpty>
                  <CommandGroup>
                    {availableUsers.map((user) => (
                      <CommandItem
                        key={user.id}
                        value={`${user.full_name} ${user.email}`}
                        onSelect={() => handleAddMember(user.id)}
                        className="cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-neutral-900">
                            {user.full_name}
                          </p>
                          <p className="truncate text-[11px] text-neutral-500">{user.email}</p>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}

function formatName(name: string): string {
  if (!name?.trim()) return name || "";
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export default function PracticeSettingsPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { practice, loading } = useAppSelector((state) => state.practice);
  const { user } = useAppSelector((state) => state.auth);
  const { users } = useAppSelector((state) => state.users);
  const { invitations } = useAppSelector((state) => state.invitations);

  const [activeTab, setActiveTab] = useState<"teams" | "members" | "general" | "info">("teams");
  const [practiceName, setPracticeName] = useState("");
  const [practiceRegion, setPracticeRegion] = useState("");
  const [priorityLow, setPriorityLow] = useState("");
  const [priorityMedium, setPriorityMedium] = useState("");
  const [priorityHigh, setPriorityHigh] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const [addTeamDialogOpen, setAddTeamDialogOpen] = useState(false);
  const [editTeamDialogOpen, setEditTeamDialogOpen] = useState(false);
  const [deleteTeamDialogOpen, setDeleteTeamDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [newTeamTitle, setNewTeamTitle] = useState("");
  const [newTeamDescription, setNewTeamDescription] = useState("");
  const [editTeamTitle, setEditTeamTitle] = useState("");
  const [editTeamDescription, setEditTeamDescription] = useState("");
  const [loadingAction, setLoadingAction] = useState(false);
  const [localTeams, setLocalTeams] = useState<Team[]>([]);

  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedInvitationId, setSelectedInvitationId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [deleteUserDialogOpen, setDeleteUserDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [cancelInviteDialogOpen, setCancelInviteDialogOpen] = useState(false);
  const [resendInviteDialogOpen, setResendInviteDialogOpen] = useState(false);
  const [inviteFormData, setInviteFormData] = useState<{ email: string; role: UserRole }>({
    email: "",
    role: UserRole.STAFF,
  });
  const [editFormData, setEditFormData] = useState<{
    full_name: string;
    role: UserRole;
    region: string | null;
  }>({ full_name: "", role: UserRole.STAFF, region: "" });
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [loadingUpdate, setLoadingUpdate] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [cancelingInvite, setCancelingInvite] = useState(false);
  const [resendingInvite, setResendingInvite] = useState(false);

  useEffect(() => {
    dispatch(fetchPractice());
  }, [dispatch]);

  useEffect(() => {
    if (practice) {
      setPracticeName(practice.practice_name);
      setPracticeRegion(practice.practice_region || "");
      setPriorityLow(practice.priority_config?.low || "Routine appointment scheduling, follow-up appointments, billing questions, medical records requests, general inquiries about services or insurance, telehealth questions, refill requests with no urgency, workers' comp / LOP intake.");
      setPriorityMedium(practice.priority_config?.medium || "Non-urgent symptom reports (e.g. mild pain flare, ongoing chronic pain question), medication questions without acute concerns, prior authorization status, appointment reschedules, pre-procedure prep questions, telehealth setup issues.");
      setPriorityHigh(practice.priority_config?.high || "Signs of infection at an injection or implant site (redness, warmth, drainage, fever), severe new weakness or numbness, loss of bladder or bowel control, severe headache after a spinal injection, post-procedure complications, calls from outside practices, hospitals, or pharmacies about a patient, severely escalated callers, or anything requiring same-day or immediate attention.");
    }
  }, [practice]);

  useEffect(() => {
    if (practice?.teams?.teams) {
      setLocalTeams(practice.teams.teams);
    }
  }, [practice?.teams?.teams]);

  const defaultLow = "Routine appointment scheduling, follow-up appointments, billing questions, medical records requests, general inquiries about services or insurance, telehealth questions, refill requests with no urgency, workers' comp / LOP intake.";
  const defaultMedium = "Non-urgent symptom reports (e.g. mild pain flare, ongoing chronic pain question), medication questions without acute concerns, prior authorization status, appointment reschedules, pre-procedure prep questions, telehealth setup issues.";
  const defaultHigh = "Signs of infection at an injection or implant site (redness, warmth, drainage, fever), severe new weakness or numbness, loss of bladder or bowel control, severe headache after a spinal injection, post-procedure complications, calls from outside practices, hospitals, or pharmacies about a patient, severely escalated callers, or anything requiring same-day or immediate attention.";

  const hasGeneralChanges = practice ? (
    practiceName !== practice.practice_name ||
    practiceRegion !== (practice.practice_region || "") ||
    priorityLow !== (practice.priority_config?.low || defaultLow) ||
    priorityMedium !== (practice.priority_config?.medium || defaultMedium) ||
    priorityHigh !== (practice.priority_config?.high || defaultHigh)
  ) : false;

  const teams = localTeams;
  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;
  const pendingInvitations = invitations.filter((inv) => !inv.accepted_at && !inv.canceled_at);

  async function handleAddMember(teamId: string, userId: string) {
    const team = teams.find((t) => t.id === teamId);
    if (!team) return;

    const previousTeams = [...localTeams];
    const newMembers = [...team.members, userId];

    setLocalTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, members: newMembers } : t))
    );

    try {
      await dispatch(updateTeamMembers({ teamId, data: { members: newMembers } })).unwrap();
    } catch (error) {
      setLocalTeams(previousTeams);
      toast.error((error as string) || "Failed to add team member");
    }
  }

  async function handleRemoveMember(teamId: string, userId: string) {
    const team = teams.find((t) => t.id === teamId);
    if (!team) return;

    const previousTeams = [...localTeams];
    const newMembers = team.members.filter((id) => id !== userId);

    setLocalTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, members: newMembers } : t))
    );

    try {
      await dispatch(updateTeamMembers({ teamId, data: { members: newMembers } })).unwrap();
    } catch (error) {
      setLocalTeams(previousTeams);
      toast.error((error as string) || "Failed to remove team member");
    }
  }

  async function handleUpdatePractice(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!practiceName.trim()) {
      toast.error("Practice name cannot be empty");
      return;
    }
    setIsUpdating(true);
    try {
      const data: PracticeUpdate = {
        practice_name: practiceName,
        practice_region: practiceRegion,
        priority_config: {
          low: priorityLow,
          medium: priorityMedium,
          high: priorityHigh,
        },
      };
      await dispatch(updatePractice(data)).unwrap();
      toast.success("Practice updated successfully");
    } catch (error) {
      toast.error((error as string) || "Failed to update practice");
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleAddTeam(): Promise<void> {
    if (!newTeamTitle.trim()) {
      toast.error("Team title cannot be empty");
      return;
    }
    setLoadingAction(true);
    try {
      await dispatch(addTeam({ title: newTeamTitle, description: newTeamDescription })).unwrap();
      toast.success("Team added successfully");
      setAddTeamDialogOpen(false);
      setNewTeamTitle("");
      setNewTeamDescription("");
    } catch (error) {
      toast.error((error as string) || "Failed to add team");
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleEditTeam(): Promise<void> {
    if (!selectedTeam || !editTeamTitle.trim()) {
      toast.error("Team title cannot be empty");
      return;
    }
    setLoadingAction(true);
    try {
      await dispatch(
        updateTeam({
          teamId: selectedTeam.id,
          data: { title: editTeamTitle, description: editTeamDescription },
        })
      ).unwrap();
      toast.success("Team updated successfully");
      setEditTeamDialogOpen(false);
      setSelectedTeam(null);
      setEditTeamTitle("");
      setEditTeamDescription("");
    } catch (error) {
      toast.error((error as string) || "Failed to update team");
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleDeleteTeam(): Promise<void> {
    if (!selectedTeam) return;
    setLoadingAction(true);
    try {
      await dispatch(deleteTeam(selectedTeam.id)).unwrap();
      toast.success("Team deleted successfully");
      setDeleteTeamDialogOpen(false);
      setSelectedTeam(null);
    } catch (error) {
      toast.error((error as string) || "Failed to delete team");
    } finally {
      setLoadingAction(false);
    }
  }

  function openEditDialog(team: Team): void {
    setSelectedTeam(team);
    setEditTeamTitle(team.title);
    setEditTeamDescription(team.description);
    setEditTeamDialogOpen(true);
  }

  function openDeleteDialog(team: Team): void {
    setSelectedTeam(team);
    setDeleteTeamDialogOpen(true);
  }

  async function handleInviteUser(): Promise<void> {
    setLoadingInvite(true);
    try {
      const result = await dispatch(createInvitation(inviteFormData)).unwrap();
      if (result.devLink) {
        toast.success("Invitation sent successfully", {
          description: "Development mode: copy the invitation link below",
          action: {
            label: copiedLink === result.devLink ? "Copied!" : "Copy Link",
            onClick: async () => {
              try {
                await navigator.clipboard.writeText(result.devLink!);
                setCopiedLink(result.devLink!);
                setTimeout(() => setCopiedLink(null), 2000);
              } catch {
                toast.error("Failed to copy link");
              }
            },
          },
        });
        toast.info(result.devLink, { duration: 10000 });
      } else {
        toast.success("Invitation sent successfully");
      }
    } catch (error: unknown) {
      toast.error((error as string) || "Failed to send invitation");
    } finally {
      setLoadingInvite(false);
      setInviteDialogOpen(false);
      setInviteFormData({ email: "", role: UserRole.STAFF });
    }
  }

  async function handleUpdateUser(): Promise<void> {
    if (!editingUser) return;
    setLoadingUpdate(true);
    try {
      const updateData: { full_name: string; role: UserRole; region?: string } = {
        full_name: editFormData.full_name,
        role: editFormData.role,
        ...(editFormData.region ? { region: editFormData.region } : {}),
      };
      await dispatch(updateUser({ userId: editingUser.id, data: updateData })).unwrap();
      toast.success("User updated successfully");
    } catch (error: unknown) {
      toast.error((error as string) || "Failed to update user");
    } finally {
      setLoadingUpdate(false);
      setEditingUser(null);
    }
  }

  async function handleDeleteUser(): Promise<void> {
    if (!selectedUserId) return;
    setLoadingDelete(true);
    try {
      await dispatch(deleteUser(selectedUserId)).unwrap();
      toast.success("User deleted successfully");
    } catch (error: unknown) {
      toast.error((error as string) || "Failed to delete user");
    } finally {
      setLoadingDelete(false);
      setDeleteUserDialogOpen(false);
      setSelectedUserId(null);
    }
  }

  async function handleCancelInvitation(): Promise<void> {
    if (!selectedInvitationId) return;
    setCancelingInvite(true);
    try {
      await dispatch(cancelInvitation(selectedInvitationId)).unwrap();
      toast.success("Invitation cancelled successfully");
    } catch (error: unknown) {
      toast.error((error as string) || "Failed to cancel invitation");
    } finally {
      setCancelingInvite(false);
      setCancelInviteDialogOpen(false);
      setSelectedInvitationId(null);
    }
  }

  async function handleResendInvitation(): Promise<void> {
    if (!selectedInvitationId) return;
    setResendingInvite(true);
    try {
      const result = await dispatch(resendInvitation(selectedInvitationId)).unwrap();
      if (result.devLink) {
        toast.success("Invitation resent successfully", {
          description: "Development mode: copy the invitation link below",
          action: {
            label: copiedLink === result.devLink ? "Copied!" : "Copy Link",
            onClick: async () => {
              try {
                await navigator.clipboard.writeText(result.devLink!);
                setCopiedLink(result.devLink!);
                setTimeout(() => setCopiedLink(null), 2000);
              } catch {
                toast.error("Failed to copy link");
              }
            },
          },
        });
        toast.info(result.devLink, { duration: 10000 });
      } else {
        toast.success("Invitation resent successfully");
      }
    } catch (error: unknown) {
      toast.error((error as string) || "Failed to resend invitation");
    } finally {
      setResendingInvite(false);
      setResendInviteDialogOpen(false);
      setSelectedInvitationId(null);
    }
  }

  function formatDateTime(utcDateString: string, userRegion?: string | null): string {
    try {
      const utcDate = new Date(utcDateString);
      const region = userRegion || user?.region || null;
      const timezone = region ? REGION_TO_TIMEZONE[region] || region : "America/Los_Angeles";
      const dateFormatter = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: timezone,
      });
      const timeFormatter = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: timezone,
      });
      const datePart = dateFormatter.format(utcDate);
      const timePart = timeFormatter.format(utcDate);
      return `${datePart} at ${timePart}`;
    } catch {
      return utcDateString;
    }
  }

  function formatDateShort(utcDateString: string, includeTime = false): string {
    try {
      const utcDate = new Date(utcDateString);
      const region = user?.region || null;
      const timezone = region ? REGION_TO_TIMEZONE[region] || region : "America/Los_Angeles";
      const now = new Date();
      const localFormatter = new Intl.DateTimeFormat("en-US", {
        year: "numeric", month: "numeric", day: "numeric", timeZone: timezone,
      });
      const timeFormatter = new Intl.DateTimeFormat("en-US", {
        hour: "numeric", minute: "2-digit", hour12: true, timeZone: timezone,
      });
      const todayStr = localFormatter.format(now);
      const dateStr = localFormatter.format(utcDate);
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = localFormatter.format(yesterday);

      const timePart = includeTime ? `, ${timeFormatter.format(utcDate)}` : "";

      if (dateStr === todayStr) return `Today${timePart}`;
      if (dateStr === yesterdayStr) return `Yesterday${timePart}`;

      const parts = localFormatter.formatToParts(utcDate);
      const m = parts.find((p) => p.type === "month")?.value || "";
      const d = parts.find((p) => p.type === "day")?.value || "";
      const y = (parts.find((p) => p.type === "year")?.value || "").slice(-2);
      return `${m}/${d}/${y}${timePart}`;
    } catch {
      return utcDateString;
    }
  }

  function formatLastActive(dateStr: string | null): string {
    if (!dateStr) return "Not recorded";
    return formatDateShort(dateStr, true);
  }

  function getRoleBadge(role: UserRole) {
    if (role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN) {
      return (
        <Badge className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50">Admin</Badge>
      );
    }
    return (
      <Badge className="border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-50">
        Staff
      </Badge>
    );
  }

  function getStatusBadge(invitation: Invitation) {
    if (invitation.accepted_at) {
      return (
        <Badge className="border-green-200 bg-green-50 text-green-700 hover:bg-green-50">
          Accepted
        </Badge>
      );
    }
    if (invitation.canceled_at) {
      return (
        <Badge className="border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-50">
          Canceled
        </Badge>
      );
    }
    return (
      <Badge className="border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-50">
        Pending
      </Badge>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (loading && !practice) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <>
      <header className="border-b border-neutral-100 bg-white">
        <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
          <div className="mb-4 sm:mb-6">
            <h1 className="text-[20px] sm:text-[24px] font-semibold tracking-tight text-neutral-900">
              Practice Settings
            </h1>
            <p className="mt-1 text-[13px] sm:text-[15px] text-neutral-500">
              Manage practice details, teams, and members.
            </p>
          </div>
        </div>

        <div className="px-4 sm:px-6 lg:px-10">
          <div className="flex gap-6 border-b border-neutral-100">
            <button
              onClick={() => setActiveTab("teams")}
              className={`relative pb-3 text-[14px] font-medium transition-colors whitespace-nowrap ${
                activeTab === "teams"
                  ? "text-neutral-900"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              Teams
              {activeTab === "teams" && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-neutral-900" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("members")}
              className={`relative pb-3 text-[14px] font-medium transition-colors whitespace-nowrap ${
                activeTab === "members"
                  ? "text-neutral-900"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              Members
              {activeTab === "members" && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-neutral-900" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("general")}
              className={`relative pb-3 text-[14px] font-medium transition-colors whitespace-nowrap ${
                activeTab === "general"
                  ? "text-neutral-900"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              General
              {activeTab === "general" && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-neutral-900" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("info")}
              className={`relative pb-3 text-[14px] font-medium transition-colors whitespace-nowrap ${
                activeTab === "info"
                  ? "text-neutral-900"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              Info
              {activeTab === "info" && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-neutral-900" />
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-10">
        {activeTab === "general" && (
          <div className="max-w-2xl">
            <form onSubmit={handleUpdatePractice} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="practice_name"
                    className="text-[13px] font-medium text-neutral-700"
                  >
                    Practice Name
                  </Label>
                  <Input
                    id="practice_name"
                    type="text"
                    value={practiceName}
                    onChange={(e) => setPracticeName(e.target.value)}
                    disabled={isUpdating}
                    className="h-9 border-neutral-200 bg-white text-[14px] text-neutral-900 placeholder:text-neutral-400"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="practice_region"
                    className="text-[13px] font-medium text-neutral-700"
                  >
                    Practice Region / Timezone
                  </Label>
                  <Select
                    value={practiceRegion}
                    onValueChange={setPracticeRegion}
                    disabled={isUpdating}
                  >
                    <SelectTrigger className="h-9 border-neutral-200 bg-white text-[14px] text-neutral-900">
                      <SelectValue placeholder="Select a region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/New_York">
                        Eastern Time (America/New_York)
                      </SelectItem>
                      <SelectItem value="America/Chicago">
                        Central Time (America/Chicago)
                      </SelectItem>
                      <SelectItem value="America/Denver">
                        Mountain Time (America/Denver)
                      </SelectItem>
                      <SelectItem value="America/Los_Angeles">
                        Pacific Time (America/Los_Angeles)
                      </SelectItem>
                      <SelectItem value="America/Anchorage">
                        Alaska Time (America/Anchorage)
                      </SelectItem>
                      <SelectItem value="Pacific/Honolulu">
                        Hawaii Time (Pacific/Honolulu)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="pt-4 border-t border-neutral-100">
                <h3 className="text-[14px] font-semibold text-neutral-900 mb-1">Priority Level Instructions</h3>
                <p className="text-[13px] text-neutral-500 mb-4">
                  Define what qualifies as each priority level when calls are categorized.
                  <span className="flex items-center gap-1.5 mt-2 text-[12px] text-neutral-400">
                    <span className="h-2 w-2 rounded-full bg-sky-400" />
                    Transferred calls are automatically marked with a blue indicator.
                  </span>
                </p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="priority_low" className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-700">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      Low Priority
                    </Label>
                    <Textarea
                      id="priority_low"
                      value={priorityLow}
                      onChange={(e) => setPriorityLow(e.target.value)}
                      disabled={isUpdating}
                      placeholder="Routine appointment scheduling, prescription refills, billing questions..."
                      className="min-h-[80px] border-neutral-200 bg-white text-[13px] text-neutral-900 placeholder:text-neutral-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority_medium" className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-700">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                      Medium Priority
                    </Label>
                    <Textarea
                      id="priority_medium"
                      value={priorityMedium}
                      onChange={(e) => setPriorityMedium(e.target.value)}
                      disabled={isUpdating}
                      placeholder="Non-urgent symptom reports, medication questions, appointment changes..."
                      className="min-h-[80px] border-neutral-200 bg-white text-[13px] text-neutral-900 placeholder:text-neutral-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority_high" className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-700">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                      High Priority
                    </Label>
                    <Textarea
                      id="priority_high"
                      value={priorityHigh}
                      onChange={(e) => setPriorityHigh(e.target.value)}
                      disabled={isUpdating}
                      placeholder="Transfer-triggering symptoms, ER/urgent care follow-ups, severely escalated callers..."
                      className="min-h-[80px] border-neutral-200 bg-white text-[13px] text-neutral-900 placeholder:text-neutral-400"
                    />
                  </div>
                </div>
              </div>
              <Button
                type="submit"
                disabled={isUpdating || !hasGeneralChanges}
                className="h-9 rounded-none bg-black px-5 text-[14px] font-medium text-white hover:bg-neutral-800 disabled:opacity-40"
              >
                {isUpdating ? <Spinner /> : "Save Changes"}
              </Button>
            </form>
          </div>
        )}

        {activeTab === "teams" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-[14px] text-neutral-500">
                Create teams to organize and filter calls on the dashboard.
              </p>
              <Button
                onClick={() => setAddTeamDialogOpen(true)}
                className="h-9 rounded-none bg-black px-5 text-[14px] hover:bg-neutral-800"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Team
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 xl:grid-cols-3 2xl:grid-cols-4">
              {teams.map((team) => (
                <TeamCard
                  key={team.id}
                  team={team}
                  users={users}
                  onEdit={() => openEditDialog(team)}
                  onDelete={() => openDeleteDialog(team)}
                  onAddMember={(userId) => handleAddMember(team.id, userId)}
                  onRemoveMember={(userId) => handleRemoveMember(team.id, userId)}
                />
              ))}
              {teams.length === 0 && (
                <div
                  className="col-span-full flex h-48 items-center justify-center rounded-lg border border-neutral-100"
                  style={{ backgroundColor: "#FDFDFD" }}
                >
                  <div className="text-center">
                    <p className="text-[14px] text-neutral-500">No teams configured</p>
                    <Button
                      variant="link"
                      onClick={() => setAddTeamDialogOpen(true)}
                      className="mt-2 text-[14px]"
                    >
                      Add your first team
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "members" && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <p className="text-[14px] text-neutral-500">
                {isAdmin
                  ? "Manage your team members and send invitations."
                  : "View your team members."}
              </p>
              {isAdmin && (
                <Button
                  onClick={() => setInviteDialogOpen(true)}
                  className="h-9 rounded-none bg-black px-5 text-[14px] hover:bg-neutral-800"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Invite User
                </Button>
              )}
            </div>

            {users.length > 0 && (
              <div className="mb-8">
                <h3 className="mb-3 text-sm font-medium text-neutral-700">Active Members</h3>
                <div
                  className="rounded-lg border border-neutral-100"
                  style={{ backgroundColor: "#FDFDFD" }}
                >
                  <div className="hidden sm:grid grid-cols-[2fr_1fr_1.5fr_40px] gap-3 border-b border-neutral-100 px-4 py-3 text-[13px] font-medium text-neutral-500">
                    <div>Name</div>
                    <div>Role</div>
                    <div>Last Active</div>
                    <div></div>
                  </div>

                  {[...users]
                    .sort((a, b) => {
                      const aTime = a.last_active_at ? new Date(a.last_active_at).getTime() : 0;
                      const bTime = b.last_active_at ? new Date(b.last_active_at).getTime() : 0;
                      return bTime - aTime;
                    })
                    .map((usr) => (
                      <div
                        key={usr.id}
                        className="group border-b border-neutral-50 px-4 py-3.5 transition-colors hover:bg-neutral-50 last:border-b-0"
                      >
                        <div className="hidden sm:grid grid-cols-[2fr_1fr_1.5fr_40px] gap-3 items-center">
                          <div className="flex flex-col gap-0.5">
                            <div className="text-[14px] font-medium text-neutral-900">
                              {formatName(usr.full_name)}
                            </div>
                            <div className="text-[12px] text-neutral-500">{usr.email}</div>
                          </div>
                          <div className="flex items-center text-[13px]">
                            {getRoleBadge(usr.role)}
                          </div>
                          <div className="flex items-center text-[13px] text-neutral-600">
                            {formatLastActive(usr.last_active_at)}
                          </div>
                          {isAdmin && (
                            <div className="flex items-center justify-end">
                              {usr.role !== UserRole.SUPER_ADMIN ? (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                      <MoreVertical className="h-4 w-4 text-neutral-500" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-40">
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setEditingUser(usr);
                                        setEditFormData({
                                          full_name: usr.full_name,
                                          role: usr.role,
                                          region: usr.region,
                                        });
                                      }}
                                    >
                                      <Edit className="mr-2 h-4 w-4" />
                                      <span>Edit</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      variant="destructive"
                                      onClick={() => {
                                        setSelectedUserId(usr.id);
                                        setDeleteUserDialogOpen(true);
                                      }}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      <span>Delete</span>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : (
                                <div className="h-8 w-8" />
                              )}
                            </div>
                          )}
                        </div>

                        <div className="group/member sm:hidden">
                          <div className="flex items-start justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="text-[14px] font-medium text-neutral-900">{formatName(usr.full_name)}</div>
                              <div className="text-[12px] text-neutral-500">{usr.email}</div>
                              <div className="mt-1 text-[11px] text-neutral-400">{formatLastActive(usr.last_active_at)}</div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 mt-1">
                              {getRoleBadge(usr.role)}
                              {isAdmin && (usr.role !== UserRole.SUPER_ADMIN ? (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover/member:opacity-100 transition-opacity">
                                      <MoreVertical className="h-4 w-4 text-neutral-500" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-40">
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setEditingUser(usr);
                                        setEditFormData({ full_name: usr.full_name, role: usr.role, region: usr.region });
                                      }}
                                    >
                                      <Edit className="mr-2 h-4 w-4" />
                                      <span>Edit</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      variant="destructive"
                                      onClick={() => { setSelectedUserId(usr.id); setDeleteUserDialogOpen(true); }}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      <span>Delete</span>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : (
                                <div className="h-8 w-8" />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {pendingInvitations.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-medium text-neutral-700">Pending Invitations</h3>
                <div
                  className="rounded-lg border border-neutral-100"
                  style={{ backgroundColor: "#FDFDFD" }}
                >
                  <div className="hidden sm:grid grid-cols-[2fr_0.8fr_1.2fr_1fr_40px] gap-3 border-b border-neutral-100 px-4 py-3 text-[13px] font-medium text-neutral-500">
                    <div>Email</div>
                    <div>Role</div>
                    <div>Expires</div>
                    <div>Status</div>
                    <div></div>
                  </div>

                  {pendingInvitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="group border-b border-neutral-50 px-4 py-3.5 transition-colors hover:bg-neutral-50 last:border-b-0"
                    >
                      <div className="hidden sm:grid grid-cols-[2fr_0.8fr_1.2fr_1fr_40px] gap-3 items-center">
                        <div className="text-[14px] font-medium text-neutral-900 truncate">{invitation.email}</div>
                        <div className="text-[13px]">{getRoleBadge(invitation.role)}</div>
                        <div className="text-[13px] text-neutral-500">
                          {new Date(invitation.expires_at) < new Date() ? "Expired" : "Expires"} {formatDateShort(invitation.expires_at, true).toLowerCase()}
                        </div>
                        <div className="text-[13px]">{getStatusBadge(invitation)}</div>
                        {isAdmin && (
                          <div className="flex items-center justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreVertical className="h-4 w-4 text-neutral-500" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem onClick={() => { setSelectedInvitationId(invitation.id); setResendInviteDialogOpen(true); }}>
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                  <span>Resend</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem variant="destructive" onClick={() => { setSelectedInvitationId(invitation.id); setCancelInviteDialogOpen(true); }}>
                                  <X className="mr-2 h-4 w-4" />
                                  <span>Cancel</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
                      </div>

                      <div className="group/invite sm:hidden">
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="text-[14px] font-medium text-neutral-900 truncate">{invitation.email}</div>
                            <div className="mt-1 text-[11px] text-neutral-400">
                              {new Date(invitation.expires_at) < new Date() ? "Expired" : "Expires"} {formatDateShort(invitation.expires_at, true).toLowerCase()}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 mt-1">
                            {getRoleBadge(invitation.role)}
                            {isAdmin && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover/invite:opacity-100 transition-opacity">
                                    <MoreVertical className="h-4 w-4 text-neutral-500" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                  <DropdownMenuItem onClick={() => { setSelectedInvitationId(invitation.id); setResendInviteDialogOpen(true); }}>
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    <span>Resend</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem variant="destructive" onClick={() => { setSelectedInvitationId(invitation.id); setCancelInviteDialogOpen(true); }}>
                                    <X className="mr-2 h-4 w-4" />
                                    <span>Cancel</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {users.length === 0 && pendingInvitations.length === 0 && (
              <div
                className="rounded-lg border border-neutral-100 p-12 text-center"
                style={{ backgroundColor: "#FDFDFD" }}
              >
                <p className="text-[14px] text-neutral-500">No team members found</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "info" && (
          <div className="max-w-2xl">
            <div className="space-y-6">
              <div
                className="rounded-lg border border-neutral-100 p-6"
                style={{ backgroundColor: "#FDFDFD" }}
              >
                <h3 className="text-[14px] font-medium text-neutral-900 mb-4">Phone Configuration</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-md border border-neutral-100 bg-white px-4 py-3">
                    <div>
                      <p className="text-[13px] font-medium text-neutral-700">Twilio Number</p>
                      <p className="text-[11px] text-neutral-500 mt-0.5">Inbound call number attached to this practice</p>
                    </div>
                    <p className="text-[14px] font-medium text-neutral-900">+1 (915) 621-2512</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={addTeamDialogOpen} onOpenChange={setAddTeamDialogOpen}>
        <DialogContent className="max-w-md border-neutral-200 bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-neutral-900">Add Team</DialogTitle>
            <DialogDescription className="text-[14px] text-neutral-500">
              Create a new team to categorize calls.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="team_title" className="text-[13px] font-medium text-neutral-700">
                Title
              </Label>
              <Input
                id="team_title"
                type="text"
                value={newTeamTitle}
                onChange={(e) => setNewTeamTitle(e.target.value)}
                placeholder="Dr. Raul Lopez"
                className="h-9 border-neutral-200 bg-white text-[14px] text-neutral-900 placeholder:text-neutral-400"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team_description" className="text-[13px] font-medium text-neutral-700">
                Description
              </Label>
              <Textarea
                id="team_description"
                value={newTeamDescription}
                onChange={(e) => setNewTeamDescription(e.target.value)}
                placeholder="Interventional pain management — injections, RFA, SCS"
                className="min-h-[80px] border-neutral-200 bg-white text-[14px] text-neutral-900 placeholder:text-neutral-400"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setAddTeamDialogOpen(false)}
              disabled={loadingAction}
              className="h-9 rounded-none border-neutral-200 text-[14px] font-medium text-neutral-900 hover:bg-neutral-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddTeam}
              disabled={!newTeamTitle.trim() || loadingAction}
              className="h-9 rounded-none bg-black px-5 text-[14px] font-medium text-white hover:bg-neutral-800"
            >
              {loadingAction ? <Spinner /> : "Add Team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editTeamDialogOpen} onOpenChange={setEditTeamDialogOpen}>
        <DialogContent className="max-w-md border-neutral-200 bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-neutral-900">Edit Team</DialogTitle>
            <DialogDescription className="text-[14px] text-neutral-500">
              Update the team details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_team_title" className="text-[13px] font-medium text-neutral-700">
                Title
              </Label>
              <Input
                id="edit_team_title"
                type="text"
                value={editTeamTitle}
                onChange={(e) => setEditTeamTitle(e.target.value)}
                className="h-9 border-neutral-200 bg-white text-[14px] text-neutral-900 placeholder:text-neutral-400"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_team_description" className="text-[13px] font-medium text-neutral-700">
                Description
              </Label>
              <Textarea
                id="edit_team_description"
                value={editTeamDescription}
                onChange={(e) => setEditTeamDescription(e.target.value)}
                className="min-h-[80px] border-neutral-200 bg-white text-[14px] text-neutral-900 placeholder:text-neutral-400"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setEditTeamDialogOpen(false)}
              disabled={loadingAction}
              className="h-9 rounded-none border-neutral-200 text-[14px] font-medium text-neutral-900 hover:bg-neutral-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditTeam}
              disabled={!editTeamTitle.trim() || loadingAction}
              className="h-9 rounded-none bg-black px-5 text-[14px] font-medium text-white hover:bg-neutral-800"
            >
              {loadingAction ? <Spinner /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTeamDialogOpen}
        onOpenChange={(open) => {
          if (!open && loadingAction) return;
          setDeleteTeamDialogOpen(open);
        }}
      >
        <AlertDialogContent className="max-w-sm border-neutral-200 bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-semibold text-neutral-900">
              Delete Team
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[14px] text-neutral-500">
              Are you sure you want to delete {selectedTeam?.title}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={loadingAction}
              className="h-9 rounded-none border-neutral-200 text-[14px] font-medium text-neutral-900 hover:bg-neutral-50"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              onClick={handleDeleteTeam}
              disabled={loadingAction}
              className="h-9 rounded-none bg-red-600 px-5 text-[14px] font-medium text-white hover:bg-red-700"
            >
              {loadingAction ? <Spinner /> : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="max-w-md border-neutral-200 bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-neutral-900">
              Invite User
            </DialogTitle>
            <DialogDescription className="text-[14px] text-neutral-500">
              Send an invitation to join your practice.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="invite_email"
                className="text-[13px] font-medium text-neutral-700"
              >
                Email
              </Label>
              <Input
                id="invite_email"
                type="email"
                value={inviteFormData.email}
                onChange={(e) =>
                  setInviteFormData({ ...inviteFormData, email: e.target.value })
                }
                placeholder="email@example.com"
                className="h-9 border-neutral-200 bg-white text-[14px] text-neutral-900 placeholder:text-neutral-400"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="invite_role"
                className="text-[13px] font-medium text-neutral-700"
              >
                Role
              </Label>
              <Select
                value={inviteFormData.role}
                onValueChange={(value) =>
                  setInviteFormData({ ...inviteFormData, role: value as UserRole })
                }
              >
                <SelectTrigger className="h-9 border-neutral-200 bg-white text-[14px] text-neutral-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UserRole.STAFF}>Staff</SelectItem>
                  <SelectItem value={UserRole.ADMIN}>Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setInviteDialogOpen(false)}
              disabled={loadingInvite}
              className="h-9 rounded-none border-neutral-200 text-[14px] font-medium text-neutral-900 hover:bg-neutral-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleInviteUser}
              disabled={!inviteFormData.email || loadingInvite}
              className="h-9 rounded-none bg-black px-5 text-[14px] font-medium text-white hover:bg-neutral-800"
            >
              {loadingInvite ? <Spinner /> : "Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editingUser !== null} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="max-w-md border-neutral-200 bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-neutral-900">
              Edit User
            </DialogTitle>
            <DialogDescription className="text-[14px] text-neutral-500">
              Update team member details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="edit_role"
                className="text-[13px] font-medium text-neutral-700"
              >
                Role
              </Label>
              <Select
                value={editFormData.role}
                onValueChange={(value) =>
                  setEditFormData({ ...editFormData, role: value as UserRole })
                }
              >
                <SelectTrigger className="h-9 border-neutral-200 bg-white text-[14px] text-neutral-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UserRole.STAFF}>Staff</SelectItem>
                  <SelectItem value={UserRole.ADMIN}>Admin</SelectItem>
                  <SelectItem value={UserRole.SUPER_ADMIN}>Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setEditingUser(null)}
              disabled={loadingUpdate}
              className="h-9 rounded-none border-neutral-200 text-[14px] font-medium text-neutral-900 hover:bg-neutral-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateUser}
              disabled={loadingUpdate}
              className="h-9 rounded-none bg-black px-5 text-[14px] font-medium text-white hover:bg-neutral-800"
            >
              {loadingUpdate ? <Spinner /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteUserDialogOpen}
        onOpenChange={(open) => {
          if (!open && loadingDelete) return;
          setDeleteUserDialogOpen(open);
        }}
      >
        <AlertDialogContent className="max-w-sm border-neutral-200 bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-semibold text-neutral-900">
              Delete User
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[14px] text-neutral-500">
              Are you sure you want to delete this user? This action cannot be undone.
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
              onClick={handleDeleteUser}
              disabled={loadingDelete}
              className="h-9 rounded-none bg-red-600 px-5 text-[14px] font-medium text-white hover:bg-red-700"
            >
              {loadingDelete ? <Spinner /> : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={cancelInviteDialogOpen}
        onOpenChange={(open) => {
          if (!open && cancelingInvite) return;
          setCancelInviteDialogOpen(open);
        }}
      >
        <AlertDialogContent className="max-w-sm border-neutral-200 bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-semibold text-neutral-900">
              Cancel Invitation
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[14px] text-neutral-500">
              Are you sure you want to cancel this invitation? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={cancelingInvite}
              className="h-9 rounded-none border-neutral-200 text-[14px] font-medium text-neutral-900 hover:bg-neutral-50"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              onClick={handleCancelInvitation}
              disabled={cancelingInvite}
              className="h-9 rounded-none bg-red-600 px-5 text-[14px] font-medium text-white hover:bg-red-700"
            >
              {cancelingInvite ? <Spinner /> : "Cancel Invitation"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={resendInviteDialogOpen}
        onOpenChange={(open) => {
          if (!open && resendingInvite) return;
          setResendInviteDialogOpen(open);
        }}
      >
        <AlertDialogContent className="max-w-sm border-neutral-200 bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-semibold text-neutral-900">
              Resend Invitation
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[14px] text-neutral-500">
              This will send a new invitation email. The old invitation link will no longer work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={resendingInvite}
              className="h-9 rounded-none border-neutral-200 text-[14px] font-medium text-neutral-900 hover:bg-neutral-50"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              onClick={handleResendInvitation}
              disabled={resendingInvite}
              className="h-9 rounded-none bg-black px-5 text-[14px] font-medium text-white hover:bg-neutral-800"
            >
              {resendingInvite ? <Spinner /> : "Resend"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
