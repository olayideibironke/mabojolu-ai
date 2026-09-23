# Mabojolu Universal Multimodal Foundation

## Purpose

Mabojolu should remain useful as an ordinary modern AI assistant while the
cognitive kernel continues toward stronger general intelligence.

Multimodal product capability and AGI evidence are separate questions.

Being able to read a PDF, transcribe audio, analyze video, or generate an image
does not by itself establish general intelligence. These capabilities provide
additional observation and action channels that the cognitive architecture can
reason over.

## Architecture

The multimodal path is local-first and provider-independent:

user file or generation request
-> bounded validation
-> modality classification
-> local specialist processor
-> versioned normalized evidence
-> Mabojolu reasoning context or generated artifact.

Large binary files are never embedded directly into ordinary chat JSON.

For persistent uploads, Mabojolu stores:

- the validated private original file;
- the existing attachment ownership/status row;
- a private versioned .analysis.json evidence sidecar after successful
  processing.

For a brand-new chat, the transient analysis endpoint processes the selected
file without requiring an existing conversation and returns only bounded
evidence to the composer.

## Supported input families

The secure upload allowlist includes:

- PDF;
- TXT and Markdown;
- CSV and JSON;
- inert source/text formats including Python, JavaScript, TypeScript, CSS,
  SCSS, SQL, XML, YAML, TOML, INI, and logs;
- PNG, JPEG, GIF, and WebP validation;
- DOCX;
- XLSX;
- PPTX;
- WAV;
- MP3;
- FLAC;
- OGG/OGA;
- M4A;
- MP4/M4V;
- WebM;
- MOV.

SVG remains blocked because it can contain active script.

Arbitrary ZIP/RAR/7z archives, executables, macro-enabled Office formats, and
legacy binary Office documents remain blocked. Supporting broad AI workflows
does not mean executing arbitrary uploaded content.

## Directly available without an extra specialist engine

Mabojolu already has direct local paths for:

- ordinary text reasoning;
- JPEG, PNG, and WebP vision input through the existing multimodal model path;
- TXT and Markdown;
- CSV;
- JSON;
- source-code and log analysis as inert UTF-8 text;
- live microphone dictation in supported browsers.

These capabilities still depend on the selected reasoning model being available.

## Structure-aware documents

DOCX, XLSX, and PPTX use:

scripts/mabojolu_multimodal_worker.py

The worker uses the Python standard library ZIP/XML stack.

It does not execute:

- macros;
- formulas;
- embedded scripts;
- embedded objects.

DOCX extraction preserves paragraph order.

XLSX extraction preserves sheet boundaries and bounded row/cell structure.

PPTX extraction preserves slide boundaries.

PDF extraction uses the free local Python package pypdf when that package is
installed.

## Audio understanding

Uploaded audio is handled locally when FFmpeg plus whisper.cpp are configured.

The pipeline is:

uploaded audio
-> FFmpeg
-> 16 kHz mono signed 16-bit PCM WAV
-> whisper.cpp
-> full JSON transcript
-> timestamped transcript evidence
-> Mabojolu reasoning context.

Required server configuration:

- MABOJOLU_FFMPEG_PATH;
- MABOJOLU_WHISPER_CLI_PATH;
- MABOJOLU_WHISPER_MODEL_PATH.

No paid transcription API is required.

## Video understanding

Uploaded video uses both visual and spoken evidence.

The pipeline is:

uploaded video
-> FFprobe duration metadata
-> bounded FFmpeg frame sampling
-> up to six local JPEG evidence frames
+
-> FFmpeg soundtrack normalization
-> whisper.cpp transcript
-> combined video evidence package
-> chat normalization
-> transcript plus up to four vision frames sent to the ordinary chat model.

Required server configuration:

- MABOJOLU_FFMPEG_PATH;
- MABOJOLU_FFPROBE_PATH;
- MABOJOLU_WHISPER_CLI_PATH;
- MABOJOLU_WHISPER_MODEL_PATH.

The default media upload ceiling is 100 MB. It remains configurable through:

MABOJOLU_MAX_MEDIA_ATTACHMENT_BYTES.

## Image generation

Image generation uses a separate local image engine rather than pretending that
a text reasoning model produces pixels.

The current local adapter targets ComfyUI.

Mabojolu only permits the configured ComfyUI endpoint on the loopback machine.

The adapter uses:

- POST /prompt;
- GET /history/{prompt_id};
- GET /view.

The composer exposes an image-generation button that uses the current prompt.
The generated image is previewed locally and can be added back into chat for
subsequent visual analysis.

Required configuration:

- MABOJOLU_COMFYUI_BASE_URL;
- MABOJOLU_COMFYUI_WORKFLOW_PATH.

The workflow must be an API-format ComfyUI workflow JSON.

Mabojolu recursively replaces these optional workflow string placeholders:

- {{PROMPT}};
- {{NEGATIVE_PROMPT}};
- {{SEED}}.

The workflow itself determines the locally installed checkpoint, sampler,
resolution, and other generation settings.

No model/checkpoint path is invented by Mabojolu.

## Runtime truth

The existence of an adapter does not mean the required local engine exists.

The authenticated endpoint:

GET /api/capabilities/multimodal

reports whether the current machine can actually reach or execute:

- Python;
- FFmpeg;
- FFprobe;
- whisper.cpp plus its configured local model;
- ComfyUI plus its configured workflow.

This distinction prevents Mabojolu from claiming a modality is available when
the machine cannot currently execute it.

## Evidence lifecycle

Persistent attachment status remains:

pending
-> uploaded
-> processing
-> ready

or:

pending/uploaded/processing
-> failed.

A file reaches ready only after a valid versioned evidence sidecar exists.

The assistant therefore cannot truthfully claim that a persistent file was
processed merely because its raw bytes were uploaded.

## Security boundaries

The multimodal layer preserves the following boundaries:

- strict MIME and extension allowlist;
- content signature checks where the format provides them;
- UTF-8 validation for inert text;
- bounded file sizes;
- bounded extracted text;
- bounded spreadsheet rows/cells;
- bounded video frame count;
- subprocess timeouts;
- capped subprocess output;
- temporary processing directories deleted in finally blocks;
- no automatic execution of uploaded code;
- no automatic macro execution;
- no arbitrary archive expansion;
- loopback-only ComfyUI;
- authenticated persistent and generation endpoints;
- private storage and sidecars;
- attachment ownership checks;
- original and analysis sidecar deletion together.

## Relationship to the cognitive kernel

Normalized multimodal evidence is an observation surface for Mabojolu G.

Future AGI experiments can consume the same evidence packages when testing:

- causal learning from images;
- event understanding across video time;
- spoken instruction following;
- cross-modal memory;
- active perception;
- uncertainty over conflicting modalities;
- experiment selection that chooses which modality to inspect;
- multimodal world-model revision.

Those experiments still require their own controlled evidence before any AGI
claim is strengthened.
