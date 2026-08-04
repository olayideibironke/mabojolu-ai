import "server-only";

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { createServiceRoleClient } from "@/lib/auth/supabase-server";
import { inspectServerEnv } from "@/lib/env";

/**
 * Attachment object storage.
 *
 * A port with two implementations, mirroring the persistence layer:
 *
 *   local     Files under .mabojolu-data/attachments. Lets the upload path be
 *             exercised end to end with no external service.
 *   supabase  A private bucket. Access only via short-lived signed URLs.
 *
 * Both refuse a path that escapes their root. The storage policies already scope
 * access by user prefix, but a traversal check here means a bug in the path builder
 * cannot reach outside the intended directory either.
 */

export interface StoragePort {
  readonly kind: "local" | "supabase";
  put(storagePath: string, bytes: Uint8Array, mimeType: string): Promise<void>;
  get(storagePath: string): Promise<Uint8Array | null>;
  remove(storagePath: string): Promise<void>;
  /**
   * A time-limited URL for reading the object.
   *
   * Short-lived by design: a long-lived or permanent URL is effectively public to
   * anyone who obtains it, which for user documents is unacceptable.
   */
  createSignedUrl(storagePath: string, expiresInSeconds: number): Promise<string | null>;
}

/**
 * Reject a path that could escape the storage root.
 *
 * Checked in the storage layer as well as during filename sanitization, because
 * this is the last point before a real filesystem write.
 */
function assertSafePath(storagePath: string): void {
  if (
    storagePath.includes("..") ||
    storagePath.startsWith("/") ||
    storagePath.startsWith("\\") ||
    storagePath.includes("\0") ||
    // A Windows drive letter would also escape the root.
    /^[a-zA-Z]:/.test(storagePath)
  ) {
    throw new Error("Unsafe storage path rejected.");
  }
}

class LocalStorage implements StoragePort {
  readonly kind = "local" as const;

  private readonly root: string;

  constructor(directory?: string) {
    this.root =
      directory ?? path.join(process.cwd(), ".mabojolu-data", "attachments");
  }

  private resolve(storagePath: string): string {
    assertSafePath(storagePath);

    const resolved = path.resolve(this.root, storagePath);

    // Belt and braces: confirm the resolved path really is inside the root, which
    // catches anything the string checks above missed.
    if (!resolved.startsWith(path.resolve(this.root))) {
      throw new Error("Unsafe storage path rejected.");
    }

    return resolved;
  }

  async put(storagePath: string, bytes: Uint8Array): Promise<void> {
    const target = this.resolve(storagePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }

  async get(storagePath: string): Promise<Uint8Array | null> {
    try {
      return new Uint8Array(await readFile(this.resolve(storagePath)));
    } catch {
      return null;
    }
  }

  async remove(storagePath: string): Promise<void> {
    try {
      await unlink(this.resolve(storagePath));
    } catch {
      // Already gone. Deletion is idempotent.
    }
  }

  async createSignedUrl(storagePath: string): Promise<string | null> {
    /*
     * Local development serves attachments through an authenticated API route
     * rather than a signed URL. There is no signing key to verify against, and
     * inventing a token that is not cryptographically checked would look like
     * security without providing any. The route performs the ownership check.
     */
    assertSafePath(storagePath);
    return `/api/attachments/content?path=${encodeURIComponent(storagePath)}`;
  }
}

class SupabaseStorage implements StoragePort {
  readonly kind = "supabase" as const;

  private readonly bucket = "attachments";

  private client() {
    const client = createServiceRoleClient();

    if (!client) {
      throw new Error("Supabase storage is not configured.");
    }

    return client;
  }

  async put(
    storagePath: string,
    bytes: Uint8Array,
    mimeType: string,
  ): Promise<void> {
    assertSafePath(storagePath);

    const { error } = await this.client()
      .storage.from(this.bucket)
      .upload(storagePath, bytes, {
        contentType: mimeType,
        // No overwrite: replacing bytes behind an already-validated attachment
        // would let content change after the checks passed.
        upsert: false,
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  async get(storagePath: string): Promise<Uint8Array | null> {
    assertSafePath(storagePath);

    const { data, error } = await this.client()
      .storage.from(this.bucket)
      .download(storagePath);

    if (error || !data) {
      return null;
    }

    return new Uint8Array(await data.arrayBuffer());
  }

  async remove(storagePath: string): Promise<void> {
    assertSafePath(storagePath);
    await this.client().storage.from(this.bucket).remove([storagePath]);
  }

  async createSignedUrl(
    storagePath: string,
    expiresInSeconds: number,
  ): Promise<string | null> {
    assertSafePath(storagePath);

    const { data, error } = await this.client()
      .storage.from(this.bucket)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error || !data) {
      return null;
    }

    return data.signedUrl;
  }
}

let cached: StoragePort | null = null;

export function getStorage(): StoragePort {
  if (cached) {
    return cached;
  }

  const envResult = inspectServerEnv();
  const persistence = envResult.ok ? envResult.env.PERSISTENCE : "local";

  cached = persistence === "supabase" ? new SupabaseStorage() : new LocalStorage();
  return cached;
}

/** Test-only: clear the memoized storage port. */
export function resetStorageCache(): void {
  cached = null;
}
