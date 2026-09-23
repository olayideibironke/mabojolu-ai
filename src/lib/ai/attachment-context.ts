import {
  isChatImageAttachment,
  isChatTextDocumentAttachment,
  type ChatImageAttachment,
  type ChatMessage,
  type ChatTextDocumentAttachment,
} from "@/types/chat";

const DOCUMENT_OPEN =
  "[Attached document:";
const DOCUMENT_CLOSE =
  "[/Attached document]";

export function imageAttachments(
  message:
    Pick<
      ChatMessage,
      "attachments"
    >,
): ChatImageAttachment[] {
  return (
    message.attachments ??
    []
  ).filter(
    isChatImageAttachment,
  );
}

export function textDocumentAttachments(
  message:
    Pick<
      ChatMessage,
      "attachments"
    >,
): ChatTextDocumentAttachment[] {
  return (
    message.attachments ??
    []
  ).filter(
    isChatTextDocumentAttachment,
  );
}

export function documentContextBlock(
  attachment:
    ChatTextDocumentAttachment,
): string {
  return [
    `${DOCUMENT_OPEN} ${attachment.name}; type=${attachment.mimeType}]`,
    attachment
      .textContent
      .trim(),
    DOCUMENT_CLOSE,
  ]
    .filter(
      (
        part,
      ) =>
        part.length >
        0,
    )
    .join(
      "\n",
    );
}

export function contentWithAttachmentContext(
  message:
    Pick<
      ChatMessage,
      | "content"
      | "attachments"
    >,
): string {
  const text =
    message.content.trim();

  const documents =
    textDocumentAttachments(
      message,
    );

  const blocks =
    documents.map(
      documentContextBlock,
    );

  if (
    blocks.length >
      0
  ) {
    return [
      text.length > 0
        ? text
        : "Use the extracted attachment evidence below to answer directly. Do not announce that you analyzed, processed, received, or were provided the attachment. Do not introduce yourself or mention your creator unless the user asks.",
      ...blocks,
    ]
      .filter(
        (
          part,
        ) =>
          part.length >
          0,
      )
      .join(
        "\n\n",
      );
  }

  if (
    text.length >
      0
  ) {
    return message.content;
  }

  if (
    imageAttachments(
      message,
    ).length >
      0
  ) {
    return "Answer directly from the attached image. Do not announce that you analyzed, processed, received, or were provided the image. Do not introduce yourself or mention your creator unless the user asks.";
  }

  return message.content;
}

export function attachmentContextCharacterCount(
  message:
    Pick<
      ChatMessage,
      "attachments"
    >,
): number {
  return textDocumentAttachments(
    message,
  ).reduce(
    (
      total,
      attachment,
    ) =>
      total +
      documentContextBlock(
        attachment,
      ).length,
    0,
  );
}
