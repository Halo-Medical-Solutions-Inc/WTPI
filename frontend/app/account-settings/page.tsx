"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PasswordInput from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useAppSelector, useAppDispatch } from "@/store";
import { updateOwnSettings, changePassword } from "@/store/slices/users-slice";
import { updateCurrentUser } from "@/store/slices/auth-slice";

const MIN_PASSWORD_LENGTH = 8;

export default function AccountSettingsPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const [activeTab, setActiveTab] = useState("my-info");
  const [personalInfo, setPersonalInfo] = useState({
    full_name: user?.full_name || "",
    region: user?.region || "",
  });
  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push("/login");
    }
  }, [user, router]);

  useEffect(() => {
    if (user) {
      setPersonalInfo({
        full_name: user.full_name || "",
        region: user.region || "",
      });
    }
  }, [user]);

  if (!user) return null;

  async function handleUpdateInfo(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setLoadingInfo(true);

    try {
      const updateData: { full_name?: string; region?: string } = {};
      if (personalInfo.full_name && personalInfo.full_name.trim()) {
        updateData.full_name = personalInfo.full_name.trim();
      }
      if (personalInfo.region && personalInfo.region.trim()) {
        updateData.region = personalInfo.region.trim();
      }

      if (Object.keys(updateData).length === 0) {
        toast.error("Please provide at least one field to update");
        setLoadingInfo(false);
        return;
      }

      const updatedUser = await dispatch(
        updateOwnSettings(updateData)
      ).unwrap();
      dispatch(updateCurrentUser(updatedUser));
      toast.success("Settings updated successfully");
    } catch (error: unknown) {
      const errorMessage = error as string;
      toast.error(
        typeof errorMessage === "string"
          ? errorMessage
          : "Failed to update settings"
      );
    } finally {
      setLoadingInfo(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent): Promise<void> {
    e.preventDefault();

    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error("New passwords do not match");
      return;
    }

    if (passwordData.new_password.length < MIN_PASSWORD_LENGTH) {
      toast.error(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
      );
      return;
    }

    setLoadingPassword(true);

    try {
      await dispatch(
        changePassword({
          current_password: passwordData.current_password,
          new_password: passwordData.new_password,
        })
      ).unwrap();
      toast.success("Password changed successfully");
      setPasswordData({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
    } catch (error: unknown) {
      const errorMessage = error as string;
      toast.error(
        typeof errorMessage === "string"
          ? errorMessage
          : "Failed to change password"
      );
    } finally {
      setLoadingPassword(false);
    }
  }

  const tabs = [
    { id: "my-info", label: "My Info" },
    { id: "change-password", label: "Change Password" },
  ];

  return (
    <>
      <header className="border-b border-neutral-100 bg-white">
        <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
          <div className="mb-4 sm:mb-6">
            <h1 className="text-[20px] sm:text-[24px] font-semibold tracking-tight text-neutral-900">
              Account Settings
            </h1>
            <p className="mt-1 text-[13px] sm:text-[15px] text-neutral-500">
              Manage your personal information and password.
            </p>
          </div>
        </div>

        <div className="px-4 sm:px-6 lg:px-10">
          <div className="flex gap-6 border-b border-neutral-100">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative pb-3 text-[14px] font-medium transition-colors ${
                  activeTab === tab.id
                    ? "text-neutral-900"
                    : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-neutral-900" />
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-10">
        <div className="max-w-2xl">
          {activeTab === "my-info" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-[13px] font-medium text-neutral-700"
                >
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={user.email}
                  disabled
                  className="h-9 border-neutral-200 bg-white text-[14px] text-neutral-900"
                />
                <p className="text-[12px] text-neutral-500">
                  Email cannot be changed
                </p>
              </div>

              <form onSubmit={handleUpdateInfo} className="space-y-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="full_name"
                    className="text-[13px] font-medium text-neutral-700"
                  >
                    Full Name
                  </Label>
                  <Input
                    id="full_name"
                    type="text"
                    value={personalInfo.full_name}
                    onChange={(e) =>
                      setPersonalInfo({
                        ...personalInfo,
                        full_name: e.target.value,
                      })
                    }
                    className="h-9 border-neutral-200 bg-white text-[14px] text-neutral-900 placeholder:text-neutral-400"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="region"
                    className="text-[13px] font-medium text-neutral-700"
                  >
                    Region
                  </Label>
                  <Select
                    value={personalInfo.region}
                    onValueChange={(value) =>
                      setPersonalInfo({ ...personalInfo, region: value })
                    }
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

                <div className="space-y-2">
                  <Label className="text-[13px] font-medium text-neutral-700">
                    Role
                  </Label>
                  <Input
                    value={user.role}
                    disabled
                    className="h-9 border-neutral-200 bg-white text-[14px] text-neutral-900"
                  />
                  <p className="text-[12px] text-neutral-500">
                    Role can only be changed by administrators
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={loadingInfo}
                  className="h-9 rounded-none bg-black px-5 text-[14px] font-medium text-white hover:bg-neutral-800"
                >
                  {loadingInfo ? <Spinner /> : "Save Changes"}
                </Button>
              </form>
            </div>
          )}

          {activeTab === "change-password" && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="current_password"
                  className="text-[13px] font-medium text-neutral-700"
                >
                  Current Password
                </Label>
                <PasswordInput
                  id="current_password"
                  value={passwordData.current_password}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      current_password: e.target.value,
                    })
                  }
                  className="h-9 border-neutral-200 bg-white text-[14px] text-neutral-900 placeholder:text-neutral-400"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="new_password"
                  className="text-[13px] font-medium text-neutral-700"
                >
                  New Password
                </Label>
                <PasswordInput
                  id="new_password"
                  value={passwordData.new_password}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      new_password: e.target.value,
                    })
                  }
                  className="h-9 border-neutral-200 bg-white text-[14px] text-neutral-900 placeholder:text-neutral-400"
                  required
                />
                <p className="text-[12px] text-neutral-500">
                  Password must be at least 8 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="confirm_password"
                  className="text-[13px] font-medium text-neutral-700"
                >
                  Confirm New Password
                </Label>
                <PasswordInput
                  id="confirm_password"
                  value={passwordData.confirm_password}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      confirm_password: e.target.value,
                    })
                  }
                  className="h-9 border-neutral-200 bg-white text-[14px] text-neutral-900 placeholder:text-neutral-400"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={loadingPassword}
                className="h-9 rounded-none bg-black px-5 text-[14px] font-medium text-white hover:bg-neutral-800"
              >
                {loadingPassword ? <Spinner /> : "Change Password"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
