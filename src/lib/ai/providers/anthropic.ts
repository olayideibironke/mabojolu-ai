import "server-only";

import { createHash } from "node:crypto";

import Anthropic from "@anthropic-ai/sdk";
import type {
  ContentBlockParam,
  MessageParam,
} from "@anthropic-ai/sdk/resources/messages/messages";

import type { ChatSource } from "@/types/chat";

import { chatError } from "../errors";
import type {
  AiProvider,
  GenerationChunk,
  GenerationRequest,
  NormalizedMessage,
} from "../provider";

const WEB_SEARCH_MAX_USES = 3;
const SEARCH_TIME_ZONE = "America/New_York";

const TRACKING_QUERY_PARAMETERS = new Set([
  "campaign",
  "campaignid",
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "referrer",
  "source",
]);

const OFFICIAL_PRIMARY_HOST_SUFFIXES = [
  ".gov",
  ".mil",
  ".int",
  ".europa.eu",
  ".gc.ca",
  ".go.jp",
  ".gov.au",
  ".gov.uk",
];

const OFFICIAL_PRIMARY_HOSTS = new Set([
  "congress.gov",
  "courtlistener.com",
  "doi.org",
  "eur-lex.europa.eu",
  "federalregister.gov",
  "govinfo.gov",
  "officialgazette.gov.ph",
  "supremecourt.gov",
  "uscourts.gov",
]);

const RESEARCH_PRIMARY_HOSTS = new Set([
  "arxiv.org",
  "clinicaltrials.gov",
  "doi.org",
  "medrxiv.org",
  "ncbi.nlm.nih.gov",
  "openreview.net",
  "pubmed.ncbi.nlm.nih.gov",
  "researchsquare.com",
]);

const AGGREGATOR_HOST_SUFFIXES = [
  "buttondown.email",
  "medium.com",
  "msn.com",
  "newsbreak.com",
  "substack.com",
  "yahoo.com",
];

const NEWS_HOST_SUFFIXES = [
  "abcnews.go.com",
  "apnews.com",
  "arstechnica.com",
  "bbc.com",
  "bbc.co.uk",
  "bloomberg.com",
  "businessinsider.com",
  "cbsnews.com",
  "cnbc.com",
  "cnn.com",
  "engadget.com",
  "finance.yahoo.com",
  "forbes.com",
  "ft.com",
  "guardian.com",
  "medianama.com",
  "nbcnews.com",
  "newsweek.com",
  "nytimes.com",
  "politico.com",
  "reuters.com",
  "techcrunch.com",
  "theguardian.com",
  "theverge.com",
  "tftc.io",
  "time.com",
  "washingtonpost.com",
  "wired.com",
  "wsj.com",
];

interface RankedSource {
  source: ChatSource;
  discoveryIndex: number;
}

/**
 * Anthropic adapter.
 *
 * Claude remains Mabojolu's reasoning and conversational provider. Anthropic's
 * server-side web-search tool is available on every request, but Claude invokes
 * it only when the user's question requires current or externally verified
 * information.
 *
 * Raw private reasoning is never sent to the browser. Thinking events produce
 * only a generic progress label.
 */
export class AnthropicProvider implements AiProvider {
  readonly id = "anthropic";

  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;

  private client: Anthropic | null = null;

  constructor(options: {
    apiKey: string | undefined;
    timeoutMs: number;
  }) {
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  private getClient(): Anthropic {
    if (!this.apiKey) {
      throw chatError("provider_not_configured");
    }

    /*
     * Reuse the SDK client across requests so connection pooling remains
     * effective. Automatic retries are disabled because retrying after a
     * partially delivered stream could create a second billable generation or
     * another set of billable web searches.
     */
    this.client ??= new Anthropic({
      apiKey: this.apiKey,
      maxRetries: 0,
      timeout: this.timeoutMs,
    });

    return this.client;
  }

  async *stream(
    request: GenerationRequest,
  ): AsyncIterable<GenerationChunk> {
    const client = this.getClient();
    const requestStartedAt = new Date();

    const messages = request.messages.map(toAnthropicMessage);

    let stream: Awaited<
      ReturnType<typeof client.messages.stream>
    >;

    try {
      stream = client.messages.stream(
        {
          model: request.model.providerModelId,

          max_tokens: Math.min(
            request.maxOutputTokens,
            request.model.maxOutputTokens,
          ),

          system: [
            request.systemPrompt.trim(),
            buildWebSearchInstructions(requestStartedAt),
          ]
            .filter(Boolean)
            .join("\n\n"),

          messages,

          /*
           * Claude decides whether the current request needs live information.
           * The hard cap prevents one response from performing unlimited
           * searches against Westforge's Anthropic account.
           */
          tools: [
            {
              type: "web_search_20250305",
              name: "web_search",
              max_uses: WEB_SEARCH_MAX_USES,
            },
          ],
        },
        {
          signal: request.signal,

          ...(request.idempotencyKey
            ? {
                idempotencyKey: request.idempotencyKey,
              }
            : {}),
        },
      );
    } catch (cause) {
      throw translateError(cause);
    }

    let sawText = false;
    let announcedThinking = false;
    let announcedSearching = false;
    let nextSourceIndex = 0;

    /*
     * Citations are collected during streaming, then emitted in quality order
     * after the response text. This allows official and primary sources to
     * appear before news reports, newsletters, and aggregators in the source
     * cards without altering Claude's visible answer.
     */
    const sourcesById =
      new Map<string, RankedSource>();

    try {
      for await (const event of stream) {
        if (request.signal.aborted) {
          break;
        }

        if (event.type === "content_block_start") {
          /*
           * Indicate that reasoning is underway without exposing private
           * reasoning content.
           */
          if (
            event.content_block.type === "thinking" &&
            !announcedThinking
          ) {
            announcedThinking = true;

            yield {
              type: "progress",
              label: "Thinking",
            };
          }

          /*
           * A server tool begins with a server_tool_use block. We expose only a
           * friendly status, never Claude's internal query payload.
           */
          if (
            event.content_block.type === "server_tool_use" &&
            event.content_block.name === "web_search" &&
            !announcedSearching
          ) {
            announcedSearching = true;

            yield {
              type: "progress",
              label: "Searching the web",
            };
          }

          continue;
        }

        if (event.type !== "content_block_delta") {
          continue;
        }

        if (event.delta.type === "text_delta") {
          sawText = true;

          yield {
            type: "text",
            text: event.delta.text,
          };

          continue;
        }

        /*
         * Anthropic streams citation metadata separately from visible text.
         * Only public HTTPS web-search citations are retained by Mabojolu.
         */
        if (
          event.delta.type === "citations_delta" &&
          event.delta.citation.type === "web_search_result_location"
        ) {
          const source = toChatSource({
            url: event.delta.citation.url,
            title: event.delta.citation.title,
            citedText: event.delta.citation.cited_text,
          });

          if (
            source &&
            !sourcesById.has(source.id)
          ) {
            sourcesById.set(source.id, {
              source,
              discoveryIndex: nextSourceIndex,
            });

            nextSourceIndex += 1;
          }
        }
      }

      if (request.signal.aborted) {
        for (const source of getRankedSources(sourcesById)) {
          yield {
            type: "source",
            source,
          };
        }

        yield {
          type: "finish",
          finishReason: "aborted",
        };

        return;
      }

      const message = await stream.finalMessage();

      const usage = {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,

        ...(message.usage.cache_read_input_tokens
          ? {
              cacheReadTokens:
                message.usage.cache_read_input_tokens,
            }
          : {}),

        ...(message.usage.cache_creation_input_tokens
          ? {
              cacheWriteTokens:
                message.usage.cache_creation_input_tokens,
            }
          : {}),
      };

      /*
       * Refusals are successful API responses. When no visible text was
       * streamed, return a refusal outcome so the Mabojolu UI can explain it.
       */
      if (
        message.stop_reason === "refusal" &&
        !sawText
      ) {
        yield {
          type: "finish",
          finishReason: "refusal",
          usage,
        };

        return;
      }

      for (const source of getRankedSources(sourcesById)) {
        yield {
          type: "source",
          source,
        };
      }

      yield {
        type: "finish",

        finishReason:
          message.stop_reason === "max_tokens"
            ? "max_tokens"
            : "end_turn",

        usage,
      };
    } catch (cause) {
      if (request.signal.aborted) {
        for (const source of getRankedSources(sourcesById)) {
          yield {
            type: "source",
            source,
          };
        }

        yield {
          type: "finish",
          finishReason: "aborted",
        };

        return;
      }

      throw translateError(cause);
    }
  }
}

/**
 * Build request-specific search instructions containing an exact, trustworthy
 * request-start timestamp. The model must not misrepresent this as the time the
 * response completed.
 */
function buildWebSearchInstructions(
  requestStartedAt: Date,
): string {
  const easternTime = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: SEARCH_TIME_ZONE,
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    },
  ).format(requestStartedAt);

  const utcTime = requestStartedAt.toISOString();

  return `
You have access to live web search.

Current request-start time:
- Eastern Time: ${easternTime}
- Time zone: ${SEARCH_TIME_ZONE}
- UTC ISO timestamp: ${utcTime}

Use the timestamp above as the authoritative current date and time for this
request. When the user requests a search cutoff, latest briefing, current-state
report, or time-sensitive comparison, state the exact request-start time and
time zone. Describe it as the request-start cutoff, not the search-completion
time.

Use web search whenever the user's request depends on current, recent, changing,
local, commercial, legal, financial, political, medical, product, pricing,
availability, schedule, news, public-figure, organization, recommendation, or
other information that may have changed since your training data.

Also search whenever the user explicitly asks you to search, browse, verify,
look something up, find current information, compare current options, or provide
live catalog data.

Do not search for ordinary greetings, creative writing, rewriting, translation,
summaries of content already supplied by the user, basic calculations, or
stable knowledge that does not require current verification.

Source hierarchy:
1. Prefer the exact primary document that establishes the claim. Examples
   include official government pages, statutes, regulations, court opinions,
   court dockets, regulatory filings, company announcements, original research
   papers, technical documentation, standards, and original datasets.
2. Use reputable independent reporting to corroborate or explain a primary
   source.
3. Use commentary, newsletters, aggregators, and republished articles only when
   stronger direct sources are unavailable and clearly describe their limits.
4. When a secondary page links to or names an official source, search for and
   cite the official source directly rather than citing only the secondary page.
5. Do not describe a source as official, primary, governmental, judicial, or
   company-issued unless the citation actually opens that source.

Verification rules:
- Verify important claims using more than one genuinely independent source when
  practical.
- Do not count copied articles, syndicated duplicates, mirrored releases, or
  multiple pages repeating one wire report as independent confirmation.
- Ensure every important current factual claim is supported by a citation that
  directly contains the supporting information.
- Place citations beside the claims they support.
- Never attach an unrelated citation merely because it discusses the same broad
  topic.
- If the required evidence threshold is not met, report fewer results or say
  that the claim could not be verified. Never fill a requested number with weak
  or speculative items.

Date rules:
- Distinguish the date an event occurred from the date a page was published or
  updated.
- Never infer a precise publication date solely from search-result age labels
  such as "9 hours ago" or "1 day ago."
- If a publication date is unavailable, say it was not confirmed.
- Do not write "on or around" a date when the source provides an exact date.

Legal and regulatory precision:
- Distinguish allegations from proven facts.
- Distinguish a preliminary order from a final judgment.
- Distinguish an appeal, stay, vacatur, remand, dismissal, settlement, and final
  resolution.
- Do not broaden a narrow or fact-specific ruling into a general legal rule.
- When a court limits its holding to the present record, state that limitation.
- Avoid wording such as "cleared," "legalized," "won permanently," or "approved"
  unless the cited decision supports that exact conclusion.

Analytical precision:
- Clearly label confirmed facts, analysis, inference, forecasts, and unresolved
  questions.
- Attribute disputed claims to the parties or sources making them.
- State when credible sources disagree.
- Never invent a source, quotation, publication date, event date, price,
  availability status, court outcome, or citation.
- Never claim that you searched the web when no search was performed.
- Do not expose internal tool calls, encrypted metadata, or private reasoning.
`.trim();
}

/**
 * Convert Mabojolu's normalized message into Anthropic's typed content format.
 *
 * Images are placed before the accompanying text so Claude receives the visual
 * context and then the user's instruction. Mabojolu can analyze uploaded images
 * but does not generate new images.
 */
function toAnthropicMessage(
  message: NormalizedMessage,
): MessageParam {
  const content: ContentBlockParam[] = [];

  for (const image of message.images ?? []) {
    content.push({
      type: "image",

      source: {
        type: "base64",
        media_type: image.mimeType,
        data: image.base64Data,
      },
    });
  }

  /*
   * Preserve the text exactly as supplied by Mabojolu. When an image-only
   * request contains no text, add a minimal instruction so the API still
   * receives a useful user turn.
   */
  content.push({
    type: "text",

    text:
      message.content.length > 0
        ? message.content
        : "Please analyze the attached image.",
  });

  return {
    role: message.role,
    content,
  };
}

/**
 * Convert one Anthropic citation into browser-safe Mabojolu source metadata.
 */
function toChatSource(input: {
  url: string;
  title: string | null;
  citedText: string;
}): ChatSource | null {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(input.url);
  } catch {
    return null;
  }

  /*
   * Do not forward executable, local, authenticated, or insecure URLs into
   * clickable browser content.
   */
  if (parsedUrl.protocol !== "https:") {
    return null;
  }

  parsedUrl.username = "";
  parsedUrl.password = "";
  parsedUrl.hash = "";

  removeTrackingParameters(parsedUrl);

  const normalizedUrl = parsedUrl.toString();

  const title =
    input.title?.trim() ||
    parsedUrl.hostname.replace(/^www\./, "");

  const citedText = input.citedText.trim();

  return {
    id: createSourceId(normalizedUrl),
    title,
    url: normalizedUrl,

    ...(citedText
      ? {
          citedText,
        }
      : {}),
  };
}

/**
 * Remove common campaign and referral parameters while retaining query
 * parameters that may be required to open the actual source document.
 */
function removeTrackingParameters(
  parsedUrl: URL,
): void {
  for (
    const parameterName of
    Array.from(parsedUrl.searchParams.keys())
  ) {
    const normalizedName =
      parameterName.toLowerCase();

    if (
      normalizedName.startsWith("utm_") ||
      TRACKING_QUERY_PARAMETERS.has(normalizedName)
    ) {
      parsedUrl.searchParams.delete(parameterName);
    }
  }

  parsedUrl.searchParams.sort();
}

/**
 * Return source cards in evidence-quality order while preserving discovery
 * order among sources with the same priority.
 */
function getRankedSources(
  sourcesById: Map<string, RankedSource>,
): ChatSource[] {
  return Array.from(sourcesById.values())
    .sort((left, right) => {
      const priorityDifference =
        getSourcePriority(left.source) -
        getSourcePriority(right.source);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return (
        left.discoveryIndex -
        right.discoveryIndex
      );
    })
    .map(({ source }) => source);
}

/**
 * Give official primary materials the strongest ranking, followed by direct
 * organizational material, reputable reporting, and aggregators.
 */
function getSourcePriority(
  source: ChatSource,
): number {
  const hostname =
    getNormalizedHostname(source.url);

  if (
    isOfficialPrimaryHostname(hostname) ||
    matchesHostnameSet(
      hostname,
      RESEARCH_PRIMARY_HOSTS,
    )
  ) {
    return 0;
  }

  if (
    looksLikePrimaryDocument(source) &&
    !matchesHostnameSuffix(
      hostname,
      NEWS_HOST_SUFFIXES,
    ) &&
    !matchesHostnameSuffix(
      hostname,
      AGGREGATOR_HOST_SUFFIXES,
    )
  ) {
    return 1;
  }

  if (
    matchesHostnameSuffix(
      hostname,
      AGGREGATOR_HOST_SUFFIXES,
    )
  ) {
    return 4;
  }

  if (
    matchesHostnameSuffix(
      hostname,
      NEWS_HOST_SUFFIXES,
    )
  ) {
    return 3;
  }

  /*
   * Unknown organizational domains rank ahead of general news because they may
   * be direct company, university, nonprofit, standards, or project sources.
   * Claude's search instructions still determine whether the source is reliable
   * enough to cite.
   */
  return 2;
}

function isOfficialPrimaryHostname(
  hostname: string,
): boolean {
  return (
    matchesHostnameSet(
      hostname,
      OFFICIAL_PRIMARY_HOSTS,
    ) ||
    OFFICIAL_PRIMARY_HOST_SUFFIXES.some(
      (suffix) =>
        hostname.endsWith(suffix),
    )
  );
}

function looksLikePrimaryDocument(
  source: ChatSource,
): boolean {
  const searchableText =
    `${source.title} ${source.url}`.toLowerCase();

  const primaryDocumentTerms = [
    "announcement",
    "annual-report",
    "api-reference",
    "documentation",
    "filing",
    "judgment",
    "official",
    "opinion",
    "order",
    "press-release",
    "regulation",
    "report",
    "research",
    "statement",
    "technical-report",
    "whitepaper",
  ];

  return primaryDocumentTerms.some(
    (term) => searchableText.includes(term),
  );
}

function matchesHostnameSet(
  hostname: string,
  hostnames: Set<string>,
): boolean {
  for (const candidate of hostnames) {
    if (
      hostname === candidate ||
      hostname.endsWith(`.${candidate}`)
    ) {
      return true;
    }
  }

  return false;
}

function matchesHostnameSuffix(
  hostname: string,
  suffixes: readonly string[],
): boolean {
  return suffixes.some(
    (suffix) =>
      hostname === suffix ||
      hostname.endsWith(`.${suffix}`),
  );
}

function getNormalizedHostname(
  url: string,
): string {
  try {
    return new URL(url)
      .hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Build a stable non-secret identifier so repeated citations to the same page
 * collapse into one visible source.
 */
function createSourceId(url: string): string {
  return `source-${createHash("sha256")
    .update(url)
    .digest("hex")
    .slice(0, 16)}`;
}

/**
 * Map Anthropic SDK exceptions onto Mabojolu's provider-independent errors.
 *
 * Provider error messages and credentials are never returned directly to the
 * browser.
 */
function translateError(
  cause: unknown,
): ReturnType<typeof chatError> {
  if (cause instanceof Anthropic.APIUserAbortError) {
    return chatError("aborted", {
      cause,
    });
  }

  if (cause instanceof Anthropic.AuthenticationError) {
    return chatError("provider_not_configured", {
      message:
        "The AI provider credential was rejected. Check the configured API key.",

      cause,
    });
  }

  if (cause instanceof Anthropic.PermissionDeniedError) {
    return chatError("provider_not_configured", {
      message:
        "The configured credential does not have access to the selected model or live web search.",

      cause,
    });
  }

  if (cause instanceof Anthropic.RateLimitError) {
    const header = cause.headers?.get?.("retry-after");

    const parsed = header
      ? Number.parseInt(header, 10)
      : Number.NaN;

    return chatError("rate_limited", {
      message:
        "The AI service is busy right now. Please wait a moment and try again.",

      retryAfterSeconds: Number.isFinite(parsed)
        ? parsed
        : undefined,

      cause,
    });
  }

  if (cause instanceof Anthropic.BadRequestError) {
    if (isWebSearchConfigurationError(cause)) {
      return chatError("provider_unavailable", {
        message:
          "Live web access is temporarily unavailable. Please try again later.",

        cause,
      });
    }

    return chatError("context_too_large", {
      cause,
    });
  }

  if (cause instanceof Anthropic.NotFoundError) {
    return chatError("provider_unavailable", {
      message:
        "The selected model is not available. Please choose another model.",

      cause,
    });
  }

  if (cause instanceof Anthropic.APIConnectionTimeoutError) {
    return chatError("provider_timeout", {
      cause,
    });
  }

  if (cause instanceof Anthropic.APIConnectionError) {
    return chatError("provider_unavailable", {
      cause,
    });
  }

  if (cause instanceof Anthropic.APIError) {
    return chatError("provider_unavailable", {
      cause,
    });
  }

  return chatError("internal_error", {
    cause,
  });
}

/**
 * Distinguish a disabled or unsupported web-search configuration from an
 * ordinary oversized-context request, since both arrive as HTTP 400 errors.
 */
function isWebSearchConfigurationError(
  cause: InstanceType<typeof Anthropic.BadRequestError>,
): boolean {
  const message = cause.message.toLowerCase();

  return (
    message.includes("web search") ||
    message.includes("web_search") ||
    message.includes("server tool") ||
    message.includes("tool type")
  );
}