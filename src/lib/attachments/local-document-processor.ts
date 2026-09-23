import "server-only";

import {
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import {
  tmpdir,
} from "node:os";
import path from "node:path";
import {
  spawn,
} from "node:child_process";

import {
  inspectServerEnv,
} from "@/lib/env";

export interface LocalDocumentExtraction {
  ok:
    true;

  processor:
    string;

  text:
    string;

  metadata:
    Record<
      string,
      string |
      number |
      boolean |
      null |
      string[] |
      number[]
    >;

  warnings:
    string[];
}

export interface LocalDocumentExtractionFailure {
  ok:
    false;

  code:
    string;

  message:
    string;
}

export type LocalDocumentExtractionResult =
  | LocalDocumentExtraction
  | LocalDocumentExtractionFailure;

const MAX_WORKER_OUTPUT_BYTES =
  2 * 1024 * 1024;

const WORKER_TIMEOUT_MS =
  45_000;

function safeSuffix(
  filename:
    string,
): string {
  const extension =
    filename
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(
        /[^a-z0-9]/g,
        "",
      );

  return extension
    ? `.${extension}`
    : ".bin";
}

async function runWorker(
  pythonPath:
    string,
  scriptPath:
    string,
  inputPath:
    string,
  mimeType:
    string,
): Promise<LocalDocumentExtractionResult> {
  return new Promise(
    (
      resolve,
    ) => {
      let stdout =
        "";

      let stderr =
        "";

      let settled =
        false;

      const child =
        spawn(
          pythonPath,
          [
            scriptPath,
            "--input",
            inputPath,
            "--mime",
            mimeType,
          ],
          {
            windowsHide:
              true,

            stdio: [
              "ignore",
              "pipe",
              "pipe",
            ],
          },
        );

      const finish = (
        result:
          LocalDocumentExtractionResult,
      ) => {
        if (settled) {
          return;
        }

        settled =
          true;

        clearTimeout(
          timeout,
        );

        resolve(
          result,
        );
      };

      const timeout =
        setTimeout(
          () => {
            child.kill();

            finish({
              ok:
                false,

              code:
                "timeout",

              message:
                "Local document processing timed out.",
            });
          },
          WORKER_TIMEOUT_MS,
        );

      child.stdout.on(
        "data",
        (
          chunk:
            Buffer,
        ) => {
          if (
            Buffer.byteLength(
              stdout,
            ) +
              chunk.byteLength >
            MAX_WORKER_OUTPUT_BYTES
          ) {
            child.kill();

            finish({
              ok:
                false,

              code:
                "output_too_large",

              message:
                "Local document processor returned too much output.",
            });

            return;
          }

          stdout +=
            chunk.toString(
              "utf8",
            );
        },
      );

      child.stderr.on(
        "data",
        (
          chunk:
            Buffer,
        ) => {
          if (
            Buffer.byteLength(
              stderr,
            ) <
            32_768
          ) {
            stderr +=
              chunk.toString(
                "utf8",
              );
          }
        },
      );

      child.once(
        "error",
        (
          error,
        ) => {
          finish({
            ok:
              false,

            code:
              "worker_unavailable",

            message:
              `Local document processor could not start: ${error.message}`,
          });
        },
      );

      child.once(
        "exit",
        () => {
          if (settled) {
            return;
          }

          try {
            const parsed =
              JSON.parse(
                stdout,
              ) as
                Partial<
                  LocalDocumentExtraction
                > &
                Partial<
                  LocalDocumentExtractionFailure
                >;

            if (
              parsed.ok ===
                true &&
              typeof parsed.processor ===
                "string" &&
              typeof parsed.text ===
                "string" &&
              parsed.metadata &&
              typeof parsed.metadata ===
                "object" &&
              Array.isArray(
                parsed.warnings,
              )
            ) {
              finish({
                ok:
                  true,

                processor:
                  parsed.processor,

                text:
                  parsed.text,

                metadata:
                  parsed.metadata as
                    LocalDocumentExtraction[
                      "metadata"
                    ],

                warnings:
                  parsed.warnings.filter(
                    (
                      value,
                    ):
                      value is
                        string =>
                      typeof value ===
                      "string",
                  ),
              });

              return;
            }

            if (
              parsed.ok ===
                false &&
              typeof parsed.code ===
                "string" &&
              typeof parsed.message ===
                "string"
            ) {
              finish({
                ok:
                  false,

                code:
                  parsed.code,

                message:
                  parsed.message,
              });

              return;
            }

            finish({
              ok:
                false,

              code:
                "invalid_worker_output",

              message:
                "Local document processor returned invalid output.",
            });
          } catch {
            finish({
              ok:
                false,

              code:
                "invalid_worker_output",

              message:
                stderr.trim()
                  ? `Local document processor failed: ${stderr.trim().slice(0, 500)}`
                  : "Local document processor returned invalid output.",
            });
          }
        },
      );
    },
  );
}

export async function extractLocalDocument(
  input: {
    filename:
      string;

    mimeType:
      string;

    bytes:
      Uint8Array;
  },
): Promise<LocalDocumentExtractionResult> {
  const envResult =
    inspectServerEnv();

  if (!envResult.ok) {
    return {
      ok:
        false,

      code:
        "invalid_environment",

      message:
        "Mabojolu's server environment is invalid.",
    };
  }

  const workspace =
    await mkdtemp(
      path.join(
        tmpdir(),
        "mabojolu-doc-",
      ),
    );

  const inputPath =
    path.join(
      workspace,
      `input${safeSuffix(
        input.filename,
      )}`,
    );

  const scriptPath =
    path.join(
      process.cwd(),
      "scripts",
      "mabojolu_multimodal_worker.py",
    );

  try {
    await writeFile(
      inputPath,
      input.bytes,
    );

    return await runWorker(
      envResult
        .env
        .MABOJOLU_PYTHON_PATH,
      scriptPath,
      inputPath,
      input.mimeType,
    );
  } finally {
    await rm(
      workspace,
      {
        recursive:
          true,

        force:
          true,
      },
    );
  }
}
