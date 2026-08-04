# Context management

How Mabojolu decides what the model sees on each request, and why.

Implementation: `src/lib/ai/context.ts`. Tested in `context.test.ts`.

---

## The problem

Every request resends the conversation, because the API is stateless. That creates
three pressures that pull against each other:

- **Correctness.** The model needs enough history to answer coherently.
- **Cost.** Input tokens are billed on every turn, so history is a recurring
  charge rather than a one-off.
- **Hard limits.** Exceeding the context window is a request failure, not a
  degradation.

## Priorities, in order

1. Never exceed what the model can accept.
2. Always keep the most recent turns, which carry the most signal.
3. Keep system instructions separate from user content.
4. Exclude turns that would mislead the model.

## The budget

```
available = min(configured budget, model context window - reserved)
reserved  = max output tokens + system prompt + 2,048 safety margin
```

The margin exists because token estimation is approximate. Under-estimating by a
few percent on a long conversation would otherwise turn into a provider-side
rejection, which the user experiences as a failure rather than a shorter memory.

`MABOJOLU_CONTEXT_TOKEN_BUDGET` defaults to 120,000. Raising it costs money on
every turn; lowering it shortens how far back the model can remember.

## Estimation

Roughly 3.5 characters per token, deliberately over-estimating.

This is not a real tokenizer. It is only used to decide how much history fits, and
a conservative estimate fails safe: too little history is a mild degradation,
while too much is a hard error. A real tokenizer would be more accurate but adds a
dependency and, for this purpose, would not change the outcome.

## Selection

Messages are walked **backwards** from the newest, adding each until the budget is
reached, then reversed into chronological order.

Backwards, because the newest turns are the ones the answer depends on. Walking
forwards would fill the budget with the oldest turns and drop the question being
asked.

Two guarantees:

- **The newest message is always included,** even if the budget is tiny.
- **A single message larger than the whole budget is an error,** not a
  truncation. Silently cutting a user's words in half and answering the fragment
  is worse than saying it will not fit.

## Exclusions

| Excluded | Why |
| --- | --- |
| `failed` | Holds an error, not an answer. Including it teaches the model that its own failure was a valid reply. |
| `pending` | An empty placeholder for a reply that has not started. |
| Empty content | Nothing to contribute. |

**`interrupted` messages are kept.** A stopped reply is partial but genuine, and
the user can see it on screen. Dropping it would make the model's context
disagree with the transcript in front of them.

## Dropped, not summarized

When history exceeds the budget, the oldest turns are dropped and the count is
reported as `droppedMessages`.

Summarization is deliberately not implemented. It requires an extra generation per
compaction, which costs money and latency, and a bad summary silently corrupts
every later turn in a way that is hard to notice. That needs its own evaluation
before shipping. Dropping with a documented rule and a reported count is honest
about what happened; a summarizer that quietly loses a detail is not.

The provider-side alternative, server-managed compaction, is available on current
Claude models and is the more likely path than building a summarizer here.

## What is not sent

- **No system role from the client.** The validation schema accepts only `user`
  and `assistant`, so a client cannot inject instructions. The system prompt comes
  from `src/prompts/system.ts` on the server.
- **No attachment contents.** Document processing is not implemented, so no
  extracted text enters the context. The assistant therefore cannot claim to have
  read an uploaded file.
- **No cross-conversation history.** Each conversation is built from its own
  messages only. There is no memory between conversations, which is stated in the
  product rather than implied.

## Prompt caching

Not yet configured. The system prompt is stable and sits at the front of every
request, which is exactly the shape prompt caching rewards, so this is a
worthwhile improvement.

It is left out for now because the cache minimum and pricing differ by model, and
adding breakpoints without measuring `cache_read_input_tokens` would be a guess
rather than an optimization. When added, the breakpoint belongs on the last system
block, since `tools` and `system` render before `messages`.
