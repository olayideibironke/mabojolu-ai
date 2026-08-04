"use client";

import { useTheme } from "@/components/layout/theme-provider";
import { MonitorIcon, MoonIcon, SunIcon } from "@/components/ui/icons";
import type { ThemePreference } from "@/lib/utilities/theme";

/**
 * Appearance control.
 *
 * A three-way radio group rather than a two-state switch, because "follow the
 * system" is a distinct preference from either fixed theme and a toggle cannot
 * express it. `radiogroup` semantics give arrow-key navigation for free.
 */

const OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  Icon: (props: { className?: string }) => React.ReactElement;
}> = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "system", label: "System", Icon: MonitorIcon },
];

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className="inline-flex items-center gap-0.5 rounded-xl border border-border-subtle bg-surface-sunken p-0.5"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const isSelected = preference === value;

        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={label}
            title={label}
            onClick={() => setPreference(value)}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
              isSelected
                ? "bg-surface-raised text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
