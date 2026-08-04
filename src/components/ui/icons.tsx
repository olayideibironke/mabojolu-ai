/**
 * Icon set.
 *
 * Inline SVGs rather than an icon dependency: the set is small, and this keeps
 * stroke weight consistent and adds no client JavaScript.
 *
 * Every icon is `aria-hidden`. Meaning is carried by the accessible name of the
 * control that contains it, so an icon is never the only label.
 */

type IconProps = {
  className?: string;
};

function Svg({
  className = "h-5 w-5",
  children,
  strokeWidth = 1.8,
}: IconProps & { children: React.ReactNode; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function NewChatIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5H6.75A2.75 2.75 0 0 0 4 7.75v9.5A2.75 2.75 0 0 0 6.75 20h9.5A2.75 2.75 0 0 0 19 17.25V12" />
      <path d="M14.5 4.5h5m-2.5-2.5v5M9 14.5l7.8-7.8" />
    </Svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

export function ArrowUpIcon(props: IconProps) {
  return (
    <Svg strokeWidth={2} {...props}>
      <path d="M12 19V5m0 0-6 6m6-6 6 6" />
    </Svg>
  );
}

/** Stop generation. A filled square reads as "stop" more clearly than an X. */
export function StopIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
    </svg>
  );
}

export function AttachmentIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m20.5 11.5-8.84 8.84a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 1 1 4.95 4.95l-9.2 9.19a2 2 0 0 1-2.82-2.83l8.49-8.48" />
    </Svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 15.25A3.25 3.25 0 1 0 12 8.75a3.25 3.25 0 0 0 0 6.5Z" />
      <path d="m19.4 15 .1.06a2 2 0 0 1-2 3.46l-.11-.06a2 2 0 0 0-3 1.73v.12a2 2 0 0 1-4 0v-.12a2 2 0 0 0-3-1.73l-.11.06a2 2 0 1 1-2-3.46L5.4 15a2 2 0 0 0 0-3.46l-.1-.06a2 2 0 1 1 2-3.46l.1.06a2 2 0 0 0 3-1.73v-.12a2 2 0 0 1 4 0v.12a2 2 0 0 0 3 1.73l.11-.06a2 2 0 0 1 2 3.46l-.11.06a2 2 0 0 0 0 3.46Z" />
    </Svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10.75 18.5a7.75 7.75 0 1 0 0-15.5 7.75 7.75 0 0 0 0 15.5ZM16.5 16.5 21 21" />
    </Svg>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 9V6.75A2.75 2.75 0 0 1 11.75 4h5.5A2.75 2.75 0 0 1 20 6.75v5.5A2.75 2.75 0 0 1 17.25 15H15" />
      <path d="M12.25 9h-5.5A2.75 2.75 0 0 0 4 11.75v5.5A2.75 2.75 0 0 0 6.75 20h5.5A2.75 2.75 0 0 0 15 17.25v-5.5A2.75 2.75 0 0 0 12.25 9Z" />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg strokeWidth={2} {...props}>
      <path d="m5 13 4.5 4.5L19 7" />
    </Svg>
  );
}

export function RegenerateIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 11.5A8 8 0 1 1 17.5 6" />
      <path d="M20.5 3v4h-4" />
    </Svg>
  );
}

export function EditIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M16.5 4.5a2.12 2.12 0 0 1 3 3L8 19l-4 1 1-4Z" />
      <path d="m14.5 6.5 3 3" />
    </Svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 7h15M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7" />
      <path d="M6.5 7l.8 11.1A2 2 0 0 0 9.3 20h5.4a2 2 0 0 0 2-1.9L17.5 7" />
      <path d="M10.5 11v5M13.5 11v5" />
    </Svg>
  );
}

export function ThumbUpIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 10.5v9H5a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z" />
      <path d="M7 10.5l3.6-6.4a1.6 1.6 0 0 1 3 .8V9.5h4.2a2 2 0 0 1 2 2.4l-1.1 5.6a2 2 0 0 1-2 1.6H7" />
    </Svg>
  );
}

export function ThumbDownIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 13.5v-9H5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1Z" />
      <path d="M7 13.5l3.6 6.4a1.6 1.6 0 0 0 3-.8V14.5h4.2a2 2 0 0 0 2-2.4l-1.1-5.6a2 2 0 0 0-2-1.6H7" />
    </Svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 9v4.5M12 16.5v.5" />
      <path d="M10.3 4.2 3 17.2A2 2 0 0 0 4.7 20h14.6a2 2 0 0 0 1.7-2.8l-7.3-13a2 2 0 0 0-3.4 0Z" />
    </Svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </Svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </Svg>
  );
}

export function MonitorIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M9 20h6m-3-3.5V20" />
    </Svg>
  );
}

export function SignOutIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15 8V6.75A2.75 2.75 0 0 0 12.25 4h-5.5A2.75 2.75 0 0 0 4 6.75v10.5A2.75 2.75 0 0 0 6.75 20h5.5A2.75 2.75 0 0 0 15 17.25V16" />
      <path d="M11 12h9m0 0-3-3m3 3-3 3" />
    </Svg>
  );
}
