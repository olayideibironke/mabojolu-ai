export type PluginProviderId =
  | "google-calendar"
  | "google-drive"
  | "google-gmail"
  | "microsoft"
  | "github"
  | "vercel"
  | "supabase"
  | "cloudflare"
  | "resend";

export type PluginAccessTier =
  | "free"
  | "paid";

export type PluginCategory =
  | "developer"
  | "productivity";

export type PluginConnectionMode =
  | "oauth"
  | "setup-required";

export interface PluginProviderDefinition {
  id:
    PluginProviderId;

  name:
    string;

  description:
    string;

  capabilities:
    readonly string[];

  authorizationUrl:
    string;

  scopes:
    readonly string[];

  accessTier:
    PluginAccessTier;

  category:
    PluginCategory;

  connectionMode:
    PluginConnectionMode;

  permissionNote?:
    string;
}

const GOOGLE_AUTHORIZATION_URL =
  "https://accounts.google.com/o/oauth2/v2/auth";

export const PLUGIN_PROVIDERS:
  readonly PluginProviderDefinition[] = [
    {
      id:
        "github",

      name:
        "GitHub",

      description:
        "Connect your GitHub identity and repositories to your Mabojolu workspace.",

      capabilities: [
        "Profile",
        "Repositories",
      ],

      authorizationUrl:
        "https://github.com/login/oauth/authorize",

      scopes: [
        "read:user",
        "user:email",
      ],

      accessTier:
        "free",

      category:
        "developer",

      connectionMode:
        "oauth",

      permissionNote:
        "Identity and repository discovery only. Mabojolu does not request repository write permissions.",
    },

    {
      id:
        "vercel",

      name:
        "Vercel",

      description:
        "Bring Vercel project, deployment, and domain context into Mabojolu.",

      capabilities: [
        "Projects",
        "Deployments",
        "Domains",
      ],

      authorizationUrl:
        "https://vercel.com/oauth/authorize",

      scopes: [
        "openid",
        "email",
        "profile",
        "offline_access",
      ],

      accessTier:
        "free",

      category:
        "developer",

      connectionMode:
        "setup-required",

      permissionNote:
        "Planned as read-oriented access. Mabojolu will not request deployment or environment-variable writes for basic workspace context.",
    },

    {
      id:
        "supabase",

      name:
        "Supabase",

      description:
        "Connect Supabase projects so Mabojolu can reason about project metadata and operational context.",

      capabilities: [
        "Projects",
        "Project metadata",
        "Advisors",
      ],

      authorizationUrl:
        "https://api.supabase.com/v1/oauth/authorize",

      scopes: [],

      accessTier:
        "free",

      category:
        "developer",

      connectionMode:
        "setup-required",

      permissionNote:
        "Supabase Management API permissions are configured on the OAuth application. Mabojolu will use the minimum read-oriented permissions needed for each workflow.",
    },

    {
      id:
        "cloudflare",

      name:
        "Cloudflare",

      description:
        "Connect Cloudflare account context for zones, DNS, and Workers visibility.",

      capabilities: [
        "Zones",
        "DNS",
        "Workers",
      ],

      authorizationUrl:
        "https://dash.cloudflare.com/oauth2/auth",

      scopes: [],

      accessTier:
        "free",

      category:
        "developer",

      connectionMode:
        "setup-required",

      permissionNote:
        "Planned read-oriented OAuth access. Write permissions will remain opt-in for future workflows that explicitly need them.",
    },

    {
      id:
        "resend",

      name:
        "Resend",

      description:
        "Connect Resend for email delivery, domain, and message activity context.",

      capabilities: [
        "Domains",
        "Email activity",
        "Delivery status",
      ],

      authorizationUrl:
        "https://api.resend.com/oauth/authorize",

      scopes: [
        "full_access",
      ],

      accessTier:
        "free",

      category:
        "developer",

      connectionMode:
        "setup-required",

      permissionNote:
        "Resend currently requires broad OAuth access for read APIs beyond send-only workflows. Mabojolu will not enable this connector until the consent flow and access boundaries are finalized.",
    },

    {
      id:
        "google-calendar",

      name:
        "Google Calendar",

      description:
        "Read upcoming Google Calendar events inside your Mabojolu workspace.",

      capabilities: [
        "Upcoming events",
        "Meeting times",
      ],

      authorizationUrl:
        GOOGLE_AUTHORIZATION_URL,

      scopes: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/calendar.events.readonly",
      ],

      accessTier:
        "paid",

      category:
        "productivity",

      connectionMode:
        "oauth",

      permissionNote:
        "Read-only event access. This connector does not request permission to edit or delete calendar events.",
    },

    {
      id:
        "google-drive",

      name:
        "Google Drive",

      description:
        "Work with Google Drive files that you explicitly share with Mabojolu.",

      capabilities: [
        "Selected files",
        "File metadata",
      ],

      authorizationUrl:
        GOOGLE_AUTHORIZATION_URL,

      scopes: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/drive.file",
      ],

      accessTier:
        "paid",

      category:
        "productivity",

      connectionMode:
        "oauth",

      permissionNote:
        "Per-file access only. Mabojolu does not request permission to read your entire Drive.",
    },

    {
      id:
        "google-gmail",

      name:
        "Gmail",

      description:
        "Read recent Gmail messages when you explicitly ask Mabojolu to use your inbox.",

      capabilities: [
        "Recent messages",
        "Message metadata",
      ],

      authorizationUrl:
        GOOGLE_AUTHORIZATION_URL,

      scopes: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/gmail.readonly",
      ],

      accessTier:
        "paid",

      category:
        "productivity",

      connectionMode:
        "oauth",

      permissionNote:
        "Gmail read access is a Google restricted scope and requires Google's public-app verification before broad production rollout.",
    },

    {
      id:
        "microsoft",

      name:
        "Microsoft 365",

      description:
        "Connect Outlook, OneDrive, and Microsoft Calendar to your Mabojolu workspace.",

      capabilities: [
        "Outlook",
        "OneDrive",
        "Calendar",
      ],

      authorizationUrl:
        "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",

      scopes: [
        "openid",
        "profile",
        "email",
        "offline_access",
        "User.Read",
        "Mail.Read",
        "Files.Read.All",
        "Calendars.Read",
      ],

      accessTier:
        "paid",

      category:
        "productivity",

      connectionMode:
        "oauth",

      permissionNote:
        "Read-oriented Microsoft Graph access. Mabojolu does not request mailbox send or calendar write permissions.",
    },
  ] as const;

export function isGooglePluginProvider(
  value:
    PluginProviderId,
):
  boolean {
  return (
    value ===
      "google-calendar" ||
    value ===
      "google-drive" ||
    value ===
      "google-gmail"
  );
}

export function isPluginProviderId(
  value:
    string,
):
  value is PluginProviderId {
  return PLUGIN_PROVIDERS.some(
    (
      provider,
    ) =>
      provider.id ===
      value,
  );
}

export function getPluginProvider(
  id:
    PluginProviderId,
):
  PluginProviderDefinition {
  const provider =
    PLUGIN_PROVIDERS.find(
      (
        candidate,
      ) =>
        candidate.id ===
        id,
    );

  if (!provider) {
    throw new Error(
      `Unknown plugin provider: ${id}`,
    );
  }

  return provider;
}
