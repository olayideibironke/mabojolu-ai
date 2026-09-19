import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { serverEnv } from "@/lib/env";

const ALGORITHM =
  "aes-256-gcm";

function encryptionKey():
  Buffer {
  const secret =
    serverEnv()
      .MABOJOLU_PLUGIN_ENCRYPTION_KEY;

  if (!secret) {
    throw new Error(
      "Plugin encryption is not configured.",
    );
  }

  return createHash(
    "sha256",
  )
    .update(
      secret,
      "utf8",
    )
    .digest();
}

export function encryptPluginSecret(
  plaintext:
    string,
):
  string {
  const iv =
    randomBytes(
      12,
    );

  const cipher =
    createCipheriv(
      ALGORITHM,
      encryptionKey(),
      iv,
    );

  const encrypted =
    Buffer.concat([
      cipher.update(
        plaintext,
        "utf8",
      ),
      cipher.final(),
    ]);

  const tag =
    cipher.getAuthTag();

  return [
    "v1",
    iv.toString(
      "base64url",
    ),
    tag.toString(
      "base64url",
    ),
    encrypted.toString(
      "base64url",
    ),
  ].join(
    ".",
  );
}

export function decryptPluginSecret(
  payload:
    string,
):
  string {
  const [
    version,
    ivValue,
    tagValue,
    encryptedValue,
  ] =
    payload.split(
      ".",
    );

  if (
    version !==
      "v1" ||
    !ivValue ||
    !tagValue ||
    !encryptedValue
  ) {
    throw new Error(
      "Stored plugin credential is invalid.",
    );
  }

  const decipher =
    createDecipheriv(
      ALGORITHM,
      encryptionKey(),
      Buffer.from(
        ivValue,
        "base64url",
      ),
    );

  decipher.setAuthTag(
    Buffer.from(
      tagValue,
      "base64url",
    ),
  );

  return Buffer.concat([
    decipher.update(
      Buffer.from(
        encryptedValue,
        "base64url",
      ),
    ),
    decipher.final(),
  ]).toString(
    "utf8",
  );
}
