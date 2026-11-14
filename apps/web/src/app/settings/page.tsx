"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  User,
  Mail,
  AtSign,
  Flag,
  Bell,
  Moon,
  Sun,
  Monitor,
  Shield,
  Trash2,
  Save,
  Loader2,
  Check,
} from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formData, setFormData] = useState({
    name: session?.user?.name || "",
    email: session?.user?.email || "",
    username: session?.user?.username || "",
    handicap: session?.user?.handicap?.toString() || "",
  });

  const [preferences, setPreferences] = useState({
    notifications: true,
    emailUpdates: false,
  });

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setSaved(false);
  };

  const handleSave = async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          username: formData.username,
          handicap: formData.handicap ? parseFloat(formData.handicap) : null,
        }),
      });

      if (response.ok) {
        await update({
          name: formData.name,
          username: formData.username,
          handicap: formData.handicap ? parseFloat(formData.handicap) : null,
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // const themeOptions = [
  //   { value: "light", label: "Light", icon: Sun },
  //   { value: "dark", label: "Dark", icon: Moon },
  //   { value: "system", label: "System", icon: Monitor },
  // ];

  return (
    <div className="min-h-screen bg-sand-50 transition-colors">
      {/* Header */}
      <header className="bg-white border-b border-sand-200 transition-colors">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-sand-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-sand-600" />
            </button>
            <h1 className="text-xl font-bold text-sand-900">
              Settings
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Profile Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6"
        >
          <h2 className="text-lg font-semibold text-sand-900 mb-6 flex items-center gap-2">
            <User className="w-5 h-5 text-fairway-600" />
            Profile Information
          </h2>

          <div className="space-y-4">
            <div>
              <label className="input-label">Full Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-sand-400" />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="input pl-12"
                />
              </div>
            </div>

            <div>
              <label className="input-label">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-sand-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  disabled
                  className="input pl-12 bg-sand-50 cursor-not-allowed"
                />
              </div>
              <p className="text-xs text-sand-500 mt-1">
                Email cannot be changed
              </p>
            </div>

            <div>
              <label className="input-label">Username</label>
              <div className="relative">
                <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-sand-400" />
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="input pl-12"
                />
              </div>
            </div>

            <div>
              <label className="input-label">Handicap Index</label>
              <div className="relative">
                <Flag className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-sand-400" />
                <input
                  type="number"
                  name="handicap"
                  value={formData.handicap}
                  onChange={handleChange}
                  step="0.1"
                  min="0"
                  max="54"
                  placeholder="e.g., 12.4"
                  className="input pl-12"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-4">
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="btn btn-primary"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : saved ? (
                <>
                  <Check className="w-5 h-5" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </motion.section>

        {/* Preferences Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card p-6"
        >
          <h2 className="text-lg font-semibold text-sand-900 mb-6 flex items-center gap-2">
            <Bell className="w-5 h-5 text-fairway-600" />
            Preferences
          </h2>

          <div className="space-y-4">
            {/* Theme Selection */}
            <div className="p-4 bg-sand-50 rounded-xl">
              <div className="flex items-center gap-3 mb-4">
                <Moon className="w-5 h-5 text-sand-500" />
                <div>
                  <p className="font-medium text-sand-900">
                    Appearance
                  </p>
                  <p className="text-sm text-sand-500">
                    Choose your preferred theme
                  </p>
                </div>
              </div>
            </div>

            <label className="flex items-center justify-between p-4 bg-sand-50 rounded-xl cursor-pointer">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-sand-500" />
                <div>
                  <p className="font-medium text-sand-900">
                    Push Notifications
                  </p>
                  <p className="text-sm text-sand-500">
                    Get notified about game invites
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.notifications}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    notifications: e.target.checked,
                  })
                }
                className="w-5 h-5 rounded border-sand-300 text-fairway-600 focus:ring-fairway-500 bg-white"
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-sand-50 rounded-xl cursor-pointer">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-sand-500" />
                <div>
                  <p className="font-medium text-sand-900">
                    Email Updates
                  </p>
                  <p className="text-sm text-sand-500">
                    Receive weekly stats summary
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.emailUpdates}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    emailUpdates: e.target.checked,
                  })
                }
                className="w-5 h-5 rounded border-sand-300 text-fairway-600 focus:ring-fairway-500 bg-white"
              />
            </label>
          </div>
        </motion.section>

        {/* Privacy Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-6"
        >
          <h2 className="text-lg font-semibold text-sand-900 mb-6 flex items-center gap-2">
            <Shield className="w-5 h-5 text-fairway-600" />
            Privacy & Security
          </h2>

          <div className="space-y-4">
            <button className="w-full flex items-center justify-between p-4 bg-sand-50 rounded-xl hover:bg-sand-100 transition-colors text-left">
              <div>
                <p className="font-medium text-sand-900">
                  Change Password
                </p>
                <p className="text-sm text-sand-500">
                  Update your password
                </p>
              </div>
              <ArrowLeft className="w-5 h-5 text-sand-400 rotate-180" />
            </button>

            <button className="w-full flex items-center justify-between p-4 bg-sand-50 rounded-xl hover:bg-sand-100 transition-colors text-left">
              <div>
                <p className="font-medium text-sand-900">
                  Download My Data
                </p>
                <p className="text-sm text-sand-500">
                  Export all your golf data
                </p>
              </div>
              <ArrowLeft className="w-5 h-5 text-sand-400 rotate-180" />
            </button>
          </div>
        </motion.section>

        {/* Danger Zone */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card p-6 border border-red-200"
        >
          <h2 className="text-lg font-semibold text-red-600 mb-4 flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            Danger Zone
          </h2>

          <p className="text-sand-600 mb-4">
            Once you delete your account, there is no going back. Please be
            certain.
          </p>

          <button className="btn border-2 border-red-500 text-red-600 hover:bg-red-50">
            Delete Account
          </button>
        </motion.section>
      </main>
    </div>
  );
}
