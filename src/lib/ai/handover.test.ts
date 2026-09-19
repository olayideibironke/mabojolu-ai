import {
  describe,
  expect,
  it,
} from "vitest";

import {
  buildHandoverPacket,
  estimateConversationTokens,
  handoverPressure,
} from "./handover";

import type {
  ChatMessage,
} from "@/types/chat";

function message(
  id:
    string,

  role:
    ChatMessage[
      "role"
    ],

  content:
    string,
):
  ChatMessage {
  return {
    id,
    role,
    content,
    status:
      "complete",
    createdAt:
      "2026-09-19T20:00:00.000Z",
  };
}

describe(
  "Mabojolu conversation continuity handover",
  () => {
    it(
      "estimates only usable conversation messages",
      () => {
        const messages = [
          message(
            "u1",
            "user",
            "abcd",
          ),
          {
            ...message(
              "a1",
              "assistant",
              "ignored",
            ),

            status:
              "failed" as const,
          },
        ];

        expect(
          estimateConversationTokens(
            messages,
          ),
        ).toBe(
          2,
        );
      },
    );

    it(
      "warns before a local model reaches its usable context ceiling",
      () => {
        const content =
          "x".repeat(
            30_000,
          );

        const pressure =
          handoverPressure({
            messages: [
              message(
                "u1",
                "user",
                content,
              ),
            ],

            modelId:
              "mabojolu-fast",
          });

        expect(
          pressure.level,
        ).toBe(
          "prepare",
        );

        expect(
          pressure.utilization,
        ).toBeGreaterThan(
          0.7,
        );
      },
    );

    it(
      "marks substantially fuller conversations urgent",
      () => {
        const content =
          "x".repeat(
            42_000,
          );

        expect(
          handoverPressure({
            messages: [
              message(
                "u1",
                "user",
                content,
              ),
            ],

            modelId:
              "mabojolu-fast",
          }).level,
        ).toBe(
          "urgent",
        );
      },
    );

    it(
      "builds a portable packet with original objective, latest direction, and recent context",
      () => {
        const packet =
          buildHandoverPacket({
            messages: [
              message(
                "u1",
                "user",
                "Build project alpha.",
              ),
              message(
                "a1",
                "assistant",
                "Project alpha foundation is ready.",
              ),
              message(
                "u2",
                "user",
                "Now add continuity handover.",
              ),
            ],

            conversationTitle:
              "Project Alpha",

            conversationId:
              "conversation-1",

            generatedAt:
              "2026-09-19T20:30:00.000Z",
          });

        expect(
          packet,
        ).toContain(
          "# MABOJOLU CONTINUITY HANDOVER",
        );

        expect(
          packet,
        ).toContain(
          "Build project alpha.",
        );

        expect(
          packet,
        ).toContain(
          "Now add continuity handover.",
        );

        expect(
          packet,
        ).toContain(
          "Project alpha foundation is ready.",
        );
      },
    );

    it(
      "keeps continuity packets compact when a turn is extremely long",
      () => {
        const packet =
          buildHandoverPacket({
            messages: [
              message(
                "u1",
                "user",
                "z".repeat(
                  20_000,
                ),
              ),
            ],
          });

        expect(
          packet.length,
        ).toBeLessThan(
          8_000,
        );
      },
    );
  },
);
