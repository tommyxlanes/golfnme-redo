"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="p-2 rounded-xl bg-sand-100 dark:bg-dark-800 w-10 h-10" />
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-2 rounded-xl bg-sand-100 hover:bg-sand-200 dark:bg-dark-800 dark:hover:bg-dark-700 transition-colors"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? (
        <Sun className="w-5 h-5 text-gold-400" />
      ) : (
        <Moon className="w-5 h-5 text-fairway-600" />
      )}
    </button>
  );
}

export function ThemeToggleDropdown() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="p-2 rounded-xl bg-sand-100 dark:bg-dark-800 w-10 h-10" />
    );
  }

  const themes = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-xl bg-sand-100 hover:bg-sand-200 dark:bg-dark-800 dark:hover:bg-dark-700 transition-colors"
        aria-label="Toggle theme menu"
      >
        {theme === "dark" ? (
          <Moon className="w-5 h-5 text-gold-400" />
        ) : theme === "light" ? (
          <Sun className="w-5 h-5 text-fairway-600" />
        ) : (
          <Monitor className="w-5 h-5 text-sand-600 dark:text-sand-400" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-36 rounded-xl bg-white dark:bg-dark-800 shadow-card dark:shadow-card-dark border border-sand-200 dark:border-dark-700 overflow-hidden z-50">
            {themes.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => {
                  setTheme(value);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  theme === value
                    ? "bg-fairway-50 dark:bg-fairway-900/30 text-fairway-700 dark:text-fairway-400"
                    : "text-sand-700 dark:text-sand-300 hover:bg-sand-50 dark:hover:bg-dark-700"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
