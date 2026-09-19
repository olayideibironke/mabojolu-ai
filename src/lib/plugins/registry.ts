export type PluginProviderId =
  | "google-calendar"
  | "google-drive"
  | "google-gmail"
  | "microsoft"
  | "github";

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

  permissionNote?:
    string;
}

const GOOGLE_AUTHORIZATION_URL =
  "https://accounts.google.com/o/oauth2/v2/auth";

export const PLUGIN_PROVIDERS:
  readonly PluginProviderDefinition[] = [
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

      permissionNote:
        "Read-oriented Microsoft Graph access. Mabojolu does not request mailbox send or calendar write permissions.",
    },

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

      permissionNote:
        "Identity and repository discovery only. Mabojolu does not request repository write permissions.",
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
  return (
    value ===
      "google-calendar" ||
    value ===
      "google-drive" ||
    value ===
      "google-gmail" ||
    value ===
      "microsoft" ||
    value ===
      "github"
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
