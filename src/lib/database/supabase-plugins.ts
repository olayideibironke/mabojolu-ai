import "server-only";

import { createServiceRoleClient } from "@/lib/auth/supabase-server";

import { SupabaseDatabaseAdapter } from "./supabase-adapter";
import type {
  PluginConnection,
  PluginProviderId,
  UpsertPluginConnectionInput,
} from "./types";

declare module "./supabase-adapter" {
  interface SupabaseDatabaseAdapter {
    getPluginConnection(
      userId: string,
      provider: PluginProviderId,
    ): Promise<PluginConnection | null>;

    listPluginConnections(
      userId: string,
    ): Promise<PluginConnection[]>;

    upsertPluginConnection(
      input: UpsertPluginConnectionInput,
    ): Promise<PluginConnection>;

    deletePluginConnection(
      userId: string,
      provider: PluginProviderId,
    ): Promise<boolean>;
  }
}

interface PluginConnectionRow {
  user_id: string;
  provider: PluginProviderId;
  account_label: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
  expires_at: string | null;
  scopes: string[] | null;
  created_at: string;
  updated_at: string;
}

const COLUMNS =
  "user_id, provider, account_label, access_token_encrypted, refresh_token_encrypted, expires_at, scopes, created_at, updated_at";

function serviceClient() {
  const client =
    createServiceRoleClient();

  if (!client) {
    throw new Error(
      "Supabase service role is not configured.",
    );
  }

  return client;
}

function toConnection(
  row: PluginConnectionRow,
): PluginConnection {
  return {
    userId:
      row.user_id,
    provider:
      row.provider,
    accountLabel:
      row.account_label,
    accessTokenEncrypted:
      row.access_token_encrypted,
    refreshTokenEncrypted:
      row.refresh_token_encrypted,
    expiresAt:
      row.expires_at,
    scopes: [
      ...(row.scopes ?? []),
    ],
    createdAt:
      row.created_at,
    updatedAt:
      row.updated_at,
  };
}

SupabaseDatabaseAdapter.prototype.getPluginConnection =
  async function getPluginConnection(
    userId: string,
    provider: PluginProviderId,
  ): Promise<PluginConnection | null> {
    const {
      data,
      error,
    } =
      await serviceClient()
        .from(
          "plugin_connections",
        )
        .select(
          COLUMNS,
        )
        .eq(
          "user_id",
          userId,
        )
        .eq(
          "provider",
          provider,
        )
        .maybeSingle();

    if (error) {
      throw new Error(
        `Could not read plugin connection: ${error.message}`,
      );
    }

    return data
      ? toConnection(
          data as PluginConnectionRow,
        )
      : null;
  };

SupabaseDatabaseAdapter.prototype.listPluginConnections =
  async function listPluginConnections(
    userId: string,
  ): Promise<PluginConnection[]> {
    const {
      data,
      error,
    } =
      await serviceClient()
        .from(
          "plugin_connections",
        )
        .select(
          COLUMNS,
        )
        .eq(
          "user_id",
          userId,
        );

    if (error) {
      throw new Error(
        `Could not list plugin connections: ${error.message}`,
      );
    }

    return (
      data ?? []
    ).map(
      (row) =>
        toConnection(
          row as PluginConnectionRow,
        ),
    );
  };

SupabaseDatabaseAdapter.prototype.upsertPluginConnection =
  async function upsertPluginConnection(
    input: UpsertPluginConnectionInput,
  ): Promise<PluginConnection> {
    const {
      data,
      error,
    } =
      await serviceClient()
        .from(
          "plugin_connections",
        )
        .upsert(
          {
            user_id:
              input.userId,
            provider:
              input.provider,
            account_label:
              input.accountLabel,
            access_token_encrypted:
              input.accessTokenEncrypted,
            refresh_token_encrypted:
              input.refreshTokenEncrypted ??
              null,
            expires_at:
              input.expiresAt ??
              null,
            scopes: [
              ...input.scopes,
            ],
            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict:
              "user_id,provider",
          },
        )
        .select(
          COLUMNS,
        )
        .single();

    if (
      error ||
      !data
    ) {
      throw new Error(
        `Could not save plugin connection: ${
          error?.message ??
          "unknown error"
        }`,
      );
    }

    return toConnection(
      data as PluginConnectionRow,
    );
  };

SupabaseDatabaseAdapter.prototype.deletePluginConnection =
  async function deletePluginConnection(
    userId: string,
    provider: PluginProviderId,
  ): Promise<boolean> {
    const {
      error,
    } =
      await serviceClient()
        .from(
          "plugin_connections",
        )
        .delete()
        .eq(
          "user_id",
          userId,
        )
        .eq(
          "provider",
          provider,
        );

    if (error) {
      throw new Error(
        `Could not delete plugin connection: ${error.message}`,
      );
    }

    return true;
  };
