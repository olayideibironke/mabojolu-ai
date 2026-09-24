import { NextResponse } from "next/server";

import { chatError, logChatError, normalizeError } from "@/lib/ai/errors";
import { editFileBytes, type EditableMimeType } from "@/lib/attachments/file-editor";
import { getStorage } from "@/lib/attachments/storage";
import { getSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";
import { errorResponse } from "@/lib/ai/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EDITABLE_MIMES = new Set<string>([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

function modifiedName(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0
    ? `${filename.slice(0, dot)}-modified${filename.slice(dot)}`
    : `${filename}-modified`;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getSession();
    if (!session) return errorResponse(chatError("unauthorized"));

    let body: { attachmentId?: unknown; findText?: unknown; replaceText?: unknown };
    try {
      body = await request.json();
    } catch {
      return errorResponse(chatError("invalid_request", { message: "That file edit request could not be read." }));
    }

    if (
      typeof body.attachmentId !== "string" ||
      typeof body.findText !== "string" ||
      typeof body.replaceText !== "string" ||
      !body.attachmentId.trim() ||
      !body.findText
    ) {
      return errorResponse(chatError("invalid_request", {
        message: "An attachment id, text to replace, and replacement text are required.",
      }));
    }

    const database = getDatabase();
    const record = await database.getAttachment(body.attachmentId.trim(), session.userId);
    if (!record) return errorResponse(chatError("not_found"));

    if (!EDITABLE_MIMES.has(record.mimeType)) {
      return NextResponse.json(
        { error: { message: record.mimeType === "application/pdf"
          ? "Preservation-safe PDF editing is not connected yet. Mabojolu will not rebuild the PDF and pretend its original structure was preserved."
          : "That attachment format is not editable by the preservation-safe file editor yet." } },
        { status: 422 },
      );
    }

    const sourceBytes = await getStorage().get(record.storagePath);
    if (!sourceBytes) return errorResponse(chatError("not_found"));

    const edited = editFileBytes({
      mimeType: record.mimeType as EditableMimeType,
      bytes: sourceBytes,
      findText: body.findText,
      replaceText: body.replaceText,
    });

    if (!edited.ok) {
      return NextResponse.json({ error: { code: edited.code, message: edited.message } }, { status: 422 });
    }

    const name = modifiedName(record.filename);
    const base64 = Buffer.from(edited.bytes).toString("base64");

    return NextResponse.json({
      file: {
        name,
        mimeType: record.mimeType,
        sizeBytes: edited.bytes.byteLength,
        dataUrl: `data:${record.mimeType};base64,${base64}`,
      },
      edit: {
        replacements: edited.replacements,
        preservationMode: "original-container",
      },
    });
  } catch (cause) {
    const error = normalizeError(cause);
    logChatError(error, { route: "POST /api/files/edit" });
    return errorResponse(error);
  }
}
