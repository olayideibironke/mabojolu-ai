import "server-only";

import {
  mkdtemp,
  readFile,
  readdir,
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

export interface LocalTranscriptSegment {
  startMs:
    number;

  endMs:
    number;

  text:
    string;
}

export interface LocalAudioAnalysis {
  ok:
    true;

  processor:
    string;

  transcript:
    string;

  language?:
    string;

  durationMs?:
    number;

  segments:
    LocalTranscriptSegment[];

  warnings:
    string[];
}

export interface LocalVideoFrame {
  name:
    string;

  mimeType:
    "image/jpeg";

  base64Data:
    string;
}

export interface LocalVideoAnalysis {
  ok:
    true;

  processor:
    string;

  transcript:
    string;

  language?:
    string;

  durationMs?:
    number;

  segments:
    LocalTranscriptSegment[];

  frames:
    LocalVideoFrame[];

  warnings:
    string[];
}

export interface LocalMediaFailure {
  ok:
    false;

  code:
    string;

  message:
    string;
}

export type LocalAudioAnalysisResult =
  | LocalAudioAnalysis
  | LocalMediaFailure;

export type LocalVideoAnalysisResult =
  | LocalVideoAnalysis
  | LocalMediaFailure;

interface CommandResult {
  ok:
    boolean;

  stdout:
    string;

  stderr:
    string;
}

const COMMAND_TIMEOUT_MS =
  120_000;

const MAX_COMMAND_OUTPUT_BYTES =
  2 * 1024 * 1024;

const MAX_VIDEO_FRAMES =
  6;

async function runCommand(
  command:
    string,
  args:
    readonly string[],
  timeoutMs =
    COMMAND_TIMEOUT_MS,
): Promise<CommandResult> {
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
          command,
          [
            ...args,
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
          CommandResult,
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

              stdout,

              stderr:
                stderr ||
                "Local media command timed out.",
            });
          },
          timeoutMs,
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
            ) <
            MAX_COMMAND_OUTPUT_BYTES
          ) {
            stdout +=
              chunk.toString(
                "utf8",
              );
          }
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
            MAX_COMMAND_OUTPUT_BYTES
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

            stdout,

            stderr:
              error.message,
          });
        },
      );

      child.once(
        "exit",
        (
          code,
        ) => {
          finish({
            ok:
              code ===
              0,

            stdout,

            stderr,
          });
        },
      );
    },
  );
}

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

async function normalizeAudio(
  ffmpegPath:
    string,
  inputPath:
    string,
  outputPath:
    string,
): Promise<CommandResult> {
  return runCommand(
    ffmpegPath,
    [
      "-y",
      "-i",
      inputPath,
      "-vn",
      "-ar",
      "16000",
      "-ac",
      "1",
      "-c:a",
      "pcm_s16le",
      outputPath,
    ],
  );
}

interface WhisperJson {
  result?: {
    language?:
      string;
  };

  transcription?: Array<{
    offsets?: {
      from?:
        number;

      to?:
        number;
    };

    text?:
      string;
  }>;
}

async function transcribeWave(
  whisperCliPath:
    string,
  whisperModelPath:
    string,
  wavPath:
    string,
  outputPrefix:
    string,
): Promise<
  LocalAudioAnalysisResult
> {
  const command =
    await runCommand(
      whisperCliPath,
      [
        "-m",
        whisperModelPath,
        "-f",
        wavPath,
        "-l",
        "auto",
        "-ojf",
        "-of",
        outputPrefix,
        "-np",
      ],
    );

  const outputJsonPath =
    `${outputPrefix}.json`;

  let raw:
    string;

  try {
    raw =
      await readFile(
        outputJsonPath,
        "utf8",
      );
  } catch {
    return {
      ok:
        false,

      code:
        "transcription_output_missing",

      message:
        command.stderr.trim()
          ? `Local transcription failed: ${command.stderr.trim().slice(0, 500)}`
          : "Local transcription did not produce a JSON result.",
    };
  }

  let parsed:
    WhisperJson;

  try {
    parsed =
      JSON.parse(
        raw,
      ) as
        WhisperJson;
  } catch {
    return {
      ok:
        false,

      code:
        "invalid_transcription_output",

      message:
        "Local transcription returned invalid JSON.",
    };
  }

  const segments =
    (
      parsed.transcription ??
      []
    )
      .map(
        (
          item,
        ):
          LocalTranscriptSegment => ({
          startMs:
            Number(
              item.offsets
                ?.from ??
              0,
            ),

          endMs:
            Number(
              item.offsets
                ?.to ??
              0,
            ),

          text:
            (
              item.text ??
              ""
            )
              .trim(),
        }),
      )
      .filter(
        (
          item,
        ) =>
          item.text.length >
          0,
      );

  const transcript =
    segments
      .map(
        (
          segment,
        ) =>
          segment.text,
      )
      .join(
        " ",
      )
      .trim();

  const durationMs =
    segments.length >
      0
      ? Math.max(
          ...segments.map(
            (
              segment,
            ) =>
              segment.endMs,
          ),
        )
      : undefined;

  return {
    ok:
      true,

    processor:
      "ffmpeg-whisper.cpp-v1",

    transcript,

    language:
      parsed.result
        ?.language,

    durationMs,

    segments,

    warnings:
      transcript
        ? []
        : [
            "No speech transcript was detected.",
          ],
  };
}

async function mediaDurationMs(
  ffprobePath:
    string,
  inputPath:
    string,
): Promise<number | undefined> {
  const result =
    await runCommand(
      ffprobePath,
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        inputPath,
      ],
      20_000,
    );

  if (!result.ok) {
    return undefined;
  }

  try {
    const parsed =
      JSON.parse(
        result.stdout,
      ) as {
        format?: {
          duration?:
            string;
        };
      };

    const seconds =
      Number(
        parsed.format
          ?.duration,
      );

    return Number.isFinite(
      seconds,
    )
      ? Math.max(
          0,
          Math.round(
            seconds *
            1_000,
          ),
        )
      : undefined;
  } catch {
    return undefined;
  }
}

async function extractVideoFrames(
  ffmpegPath:
    string,
  inputPath:
    string,
  workspace:
    string,
  durationMs:
    number |
    undefined,
): Promise<LocalVideoFrame[]> {
  const durationSeconds =
    durationMs &&
    durationMs >
      0
      ? durationMs /
        1_000
      : 60;

  const framesPerSecond =
    Math.min(
      1,
      MAX_VIDEO_FRAMES /
        Math.max(
          1,
          durationSeconds,
        ),
    );

  const outputPattern =
    path.join(
      workspace,
      "frame-%02d.jpg",
    );

  const result =
    await runCommand(
      ffmpegPath,
      [
        "-y",
        "-i",
        inputPath,
        "-an",
        "-vf",
        `fps=${framesPerSecond},scale=768:-2:force_original_aspect_ratio=decrease`,
        "-frames:v",
        String(
          MAX_VIDEO_FRAMES,
        ),
        "-q:v",
        "4",
        outputPattern,
      ],
    );

  if (!result.ok) {
    return [];
  }

  const names =
    (
      await readdir(
        workspace,
      )
    )
      .filter(
        (
          name,
        ) =>
          /^frame-\d+\.jpg$/i.test(
            name,
          ),
      )
      .sort();

  const frames:
    LocalVideoFrame[] =
      [];

  for (
    const name of
      names.slice(
        0,
        MAX_VIDEO_FRAMES,
      )
  ) {
    const data =
      await readFile(
        path.join(
          workspace,
          name,
        ),
      );

    frames.push({
      name,

      mimeType:
        "image/jpeg",

      base64Data:
        data.toString(
          "base64",
        ),
    });
  }

  return frames;
}

export async function analyzeLocalAudio(
  input: {
    filename:
      string;

    bytes:
      Uint8Array;
  },
): Promise<LocalAudioAnalysisResult> {
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

  const env =
    envResult.env;

  if (
    !env
      .MABOJOLU_WHISPER_CLI_PATH ||
    !env
      .MABOJOLU_WHISPER_MODEL_PATH
  ) {
    return {
      ok:
        false,

      code:
        "whisper_not_configured",

      message:
        "Local audio analysis requires MABOJOLU_WHISPER_CLI_PATH and MABOJOLU_WHISPER_MODEL_PATH.",
    };
  }

  const workspace =
    await mkdtemp(
      path.join(
        tmpdir(),
        "mabojolu-audio-",
      ),
    );

  try {
    const inputPath =
      path.join(
        workspace,
        `input${safeSuffix(
          input.filename,
        )}`,
      );

    const wavPath =
      path.join(
        workspace,
        "normalized.wav",
      );

    await writeFile(
      inputPath,
      input.bytes,
    );

    const normalized =
      await normalizeAudio(
        env
          .MABOJOLU_FFMPEG_PATH,
        inputPath,
        wavPath,
      );

    if (!normalized.ok) {
      return {
        ok:
          false,

        code:
          "ffmpeg_audio_conversion_failed",

        message:
          normalized.stderr.trim()
            ? `FFmpeg could not decode the audio: ${normalized.stderr.trim().slice(0, 500)}`
            : "FFmpeg could not decode the audio.",
      };
    }

    return await transcribeWave(
      env
        .MABOJOLU_WHISPER_CLI_PATH,
      env
        .MABOJOLU_WHISPER_MODEL_PATH,
      wavPath,
      path.join(
        workspace,
        "transcript",
      ),
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

export async function analyzeLocalVideo(
  input: {
    filename:
      string;

    bytes:
      Uint8Array;
  },
): Promise<LocalVideoAnalysisResult> {
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

  const env =
    envResult.env;

  if (
    !env
      .MABOJOLU_WHISPER_CLI_PATH ||
    !env
      .MABOJOLU_WHISPER_MODEL_PATH
  ) {
    return {
      ok:
        false,

      code:
        "whisper_not_configured",

      message:
        "Local video analysis requires whisper.cpp for the soundtrack transcript.",
    };
  }

  const workspace =
    await mkdtemp(
      path.join(
        tmpdir(),
        "mabojolu-video-",
      ),
    );

  try {
    const inputPath =
      path.join(
        workspace,
        `input${safeSuffix(
          input.filename,
        )}`,
      );

    const wavPath =
      path.join(
        workspace,
        "audio.wav",
      );

    await writeFile(
      inputPath,
      input.bytes,
    );

    const durationMs =
      await mediaDurationMs(
        env
          .MABOJOLU_FFPROBE_PATH,
        inputPath,
      );

    const [
      frames,
      normalized,
    ] =
      await Promise.all([
        extractVideoFrames(
          env
            .MABOJOLU_FFMPEG_PATH,
          inputPath,
          workspace,
          durationMs,
        ),

        normalizeAudio(
          env
            .MABOJOLU_FFMPEG_PATH,
          inputPath,
          wavPath,
        ),
      ]);

    let transcript:
      LocalAudioAnalysisResult;

    if (
      normalized.ok
    ) {
      transcript =
        await transcribeWave(
          env
            .MABOJOLU_WHISPER_CLI_PATH,
          env
            .MABOJOLU_WHISPER_MODEL_PATH,
          wavPath,
          path.join(
            workspace,
            "transcript",
          ),
        );
    } else {
      transcript = {
        ok:
          true,

        processor:
          "ffmpeg-whisper.cpp-v1",

        transcript:
          "",

        durationMs,

        segments:
          [],

        warnings: [
          "No decodable soundtrack was found.",
        ],
      };
    }

    if (
      !transcript.ok
    ) {
      return transcript;
    }

    if (
      frames.length ===
        0 &&
      transcript
        .transcript
        .length ===
        0
    ) {
      return {
        ok:
          false,

        code:
          "video_no_analyzable_content",

        message:
          "The video produced neither readable frames nor a speech transcript.",
      };
    }

    return {
      ok:
        true,

      processor:
        "ffmpeg-whisper.cpp-video-v1",

      transcript:
        transcript
          .transcript,

      language:
        transcript
          .language,

      durationMs:
        durationMs ??
        transcript
          .durationMs,

      segments:
        transcript
          .segments,

      frames,

      warnings: [
        ...transcript
          .warnings,

        ...(frames.length ===
          0
          ? [
              "No video frames could be extracted.",
            ]
          : []),
      ],
    };
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
