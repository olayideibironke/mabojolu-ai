import "server-only";

import {
  access,
} from "node:fs/promises";
import {
  spawn,
} from "node:child_process";

import {
  inspectServerEnv,
} from "@/lib/env";

export type LocalMultimodalComponentId =
  | "python"
  | "ffmpeg"
  | "ffprobe"
  | "pypdf"
  | "whisper"
  | "comfyui";

export interface LocalMultimodalComponentStatus {
  id:
    LocalMultimodalComponentId;

  available:
    boolean;

  detail:
    string;
}

export interface LocalMultimodalRuntimeStatus {
  components:
    LocalMultimodalComponentStatus[];

  capabilities: {
    officeDocuments:
      boolean;

    pdfDocuments:
      boolean;

    audioTranscription:
      boolean;

    videoUnderstanding:
      boolean;

    imageGeneration:
      boolean;
  };
}

export type CommandProbe =
  (
    command:
      string,
    args:
      readonly string[],
  ) =>
    Promise<boolean>;

export type UrlProbe =
  (
    url:
      string,
  ) =>
    Promise<boolean>;

async function defaultCommandProbe(
  command:
    string,
  args:
    readonly string[],
): Promise<boolean> {
  return new Promise(
    (
      resolve,
    ) => {
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

            stdio:
              "ignore",
          },
        );

      const finish = (
        value:
          boolean,
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
          value,
        );
      };

      const timeout =
        setTimeout(
          () => {
            child.kill();
            finish(
              false,
            );
          },
          4_000,
        );

      child.once(
        "error",
        () =>
          finish(
            false,
          ),
      );

      child.once(
        "exit",
        (
          code,
        ) =>
          finish(
            code ===
              0,
          ),
      );
    },
  );
}

async function defaultUrlProbe(
  url:
    string,
): Promise<boolean> {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      3_000,
    );

  try {
    const response =
      await fetch(
        url,
        {
          cache:
            "no-store",

          signal:
            controller
              .signal,
        },
      );

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(
      timeout,
    );
  }
}

async function pathExists(
  value:
    string |
    undefined,
): Promise<boolean> {
  if (!value) {
    return false;
  }

  try {
    await access(
      value,
    );

    return true;
  } catch {
    return false;
  }
}

export async function inspectLocalMultimodalRuntime(
  options?: {
    commandProbe?:
      CommandProbe;

    urlProbe?:
      UrlProbe;
  },
): Promise<LocalMultimodalRuntimeStatus> {
  const envResult =
    inspectServerEnv();

  if (!envResult.ok) {
    return {
      components: [
        {
          id:
            "python",

          available:
            false,

          detail:
            "Server environment is invalid.",
        },
        {
          id:
            "ffmpeg",

          available:
            false,

          detail:
            "Server environment is invalid.",
        },
        {
          id:
            "ffprobe",

          available:
            false,

          detail:
            "Server environment is invalid.",
        },
        {
          id:
            "pypdf",

          available:
            false,

          detail:
            "Server environment is invalid.",
        },
        {
          id:
            "whisper",

          available:
            false,

          detail:
            "Server environment is invalid.",
        },
        {
          id:
            "comfyui",

          available:
            false,

          detail:
            "Server environment is invalid.",
        },
      ],

      capabilities: {
        officeDocuments:
          false,

        pdfDocuments:
          false,

        audioTranscription:
          false,

        videoUnderstanding:
          false,

        imageGeneration:
          false,
      },
    };
  }

  const env =
    envResult.env;

  const commandProbe =
    options
      ?.commandProbe ??
    defaultCommandProbe;

  const urlProbe =
    options
      ?.urlProbe ??
    defaultUrlProbe;

  const [
    python,
    ffmpeg,
    ffprobe,
    pypdf,
    whisperCli,
    whisperModelExists,
    comfyWorkflowExists,
    comfyui,
  ] =
    await Promise.all([
      commandProbe(
        env
          .MABOJOLU_PYTHON_PATH,
        [
          "--version",
        ],
      ),

      commandProbe(
        env
          .MABOJOLU_FFMPEG_PATH,
        [
          "-version",
        ],
      ),

      commandProbe(
        env
          .MABOJOLU_FFPROBE_PATH,
        [
          "-version",
        ],
      ),

      commandProbe(
        env
          .MABOJOLU_PYTHON_PATH,
        [
          "-c",
          "import pypdf",
        ],
      ),

      env
        .MABOJOLU_WHISPER_CLI_PATH
        ? commandProbe(
            env
              .MABOJOLU_WHISPER_CLI_PATH,
            [
              "--help",
            ],
          )
        : Promise.resolve(
            false,
          ),

      pathExists(
        env
          .MABOJOLU_WHISPER_MODEL_PATH,
      ),

      pathExists(
        env
          .MABOJOLU_COMFYUI_WORKFLOW_PATH,
      ),

      urlProbe(
        new URL(
          "/features",
          env
            .MABOJOLU_COMFYUI_BASE_URL,
        ).toString(),
      ),
    ]);

  const whisper =
    whisperCli &&
    whisperModelExists;

  const imageGeneration =
    comfyui &&
    comfyWorkflowExists;

  return {
    components: [
      {
        id:
          "python",

        available:
          python,

        detail:
          python
            ? "Python runtime is available."
            : "Python runtime was not found.",
      },
      {
        id:
          "ffmpeg",

        available:
          ffmpeg,

        detail:
          ffmpeg
            ? "FFmpeg is available."
            : "FFmpeg was not found.",
      },
      {
        id:
          "ffprobe",

        available:
          ffprobe,

        detail:
          ffprobe
            ? "FFprobe is available."
            : "FFprobe was not found.",
      },
      {
        id:
          "pypdf",

        available:
          pypdf,

        detail:
          pypdf
            ? "The free local pypdf package is available."
            : "PDF text extraction requires the free local Python package pypdf.",
      },
      {
        id:
          "whisper",

        available:
          whisper,

        detail:
          whisper
            ? "whisper.cpp CLI and local model are configured."
            : "whisper.cpp requires both MABOJOLU_WHISPER_CLI_PATH and MABOJOLU_WHISPER_MODEL_PATH.",
      },
      {
        id:
          "comfyui",

        available:
          imageGeneration,

        detail:
          imageGeneration
            ? "Local ComfyUI is reachable and an API workflow is configured."
            : "Image generation requires local ComfyUI plus MABOJOLU_COMFYUI_WORKFLOW_PATH.",
      },
    ],

    capabilities: {
      officeDocuments:
        python,

      // The Python worker can extract PDF text only when its optional PDF
      // backend is installed. Runtime processing performs that final check.
      pdfDocuments:
        python &&
        pypdf,

      audioTranscription:
        whisper &&
        ffmpeg,

      videoUnderstanding:
        whisper &&
        ffmpeg &&
        ffprobe,

      imageGeneration,
    },
  };
}
