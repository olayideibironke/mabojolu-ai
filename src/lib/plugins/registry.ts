export type PluginProviderId =
  | "google"
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
}

export const PLUGIN_PROVIDERS:
  readonly PluginProviderDefinition[] = [
    {
      id:
        "google",

      name:
        "Google Workspace",

      description:
        "Connect Gmail, Google Drive, and Google Calendar to your Mabojolu workspace.",

      capabilities: [
        "Gmail",
        "Google Drive",
        "Google Calendar",
      ],

      authorizationUrl:
        "https://accounts.google.com/o/oauth2/v2/auth",

      scopes: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/calendar.readonly",
      ],
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
    },
  ] as const;

export function isPluginProviderId(
  value:
    string,
):
  value is PluginProviderId {
  return (
    value ===
      "google" ||
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
