import { cookies } from "next/headers";

import { RECOVERY_SESSION_COOKIE } from "@/lib/auth/recovery";
import { createServerSupabaseClient } from "@/lib/auth/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ResetPasswordBody {
  password?: unknown;
}

/**
 * Complete a password-reset flow using the verified server-side auth session.
 */
export async function POST(
  request: Request,
): Promise<Response> {
  let body: ResetPasswordBody;

  try {
    body =
      await request.json() as
        ResetPasswordBody;
  } catch {
    return Response.json(
      {
        ok: false,
      },
      {
        status: 400,
      },
    );
  }

  const password =
    typeof body.password ===
      "string"
      ? body.password
      : "";

  if (
    password.length <
      8 ||
    password.length >
      1024
  ) {
    return Response.json(
      {
        ok: false,
      },
      {
        status: 400,
      },
    );
  }

  const cookieStore =
    await cookies();

  if (
    cookieStore.get(
      RECOVERY_SESSION_COOKIE,
    )?.value !==
      "1"
  ) {
    return Response.json(
      {
        ok: false,
      },
      {
        status: 401,
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  }

  const client =
    await createServerSupabaseClient();

  if (!client) {
    return Response.json(
      {
        ok: false,
      },
      {
        status: 503,
      },
    );
  }

  const {
    data,
    error: userError,
  } =
    await client.auth.getUser();

  if (
    userError ||
    !data.user
  ) {
    return Response.json(
      {
        ok: false,
      },
      {
        status: 401,
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  }

  const {
    error: updateError,
  } =
    await client.auth.updateUser({
      password,
    });

  if (updateError) {
    console.error(
      "[mabojolu] password reset failed",
      {
        message:
          updateError.message,
      },
    );

    return Response.json(
      {
        ok: false,
      },
      {
        status: 400,
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  }

  const {
    error: signOutError,
  } =
    await client.auth.signOut({
      scope: "local",
    });

  if (signOutError) {
    console.warn(
      "[mabojolu] recovery session cleanup failed",
      {
        message:
          signOutError.message,
      },
    );
  }

  cookieStore.set(
    RECOVERY_SESSION_COOKIE,
    "",
    {
      httpOnly: true,
      secure:
        process.env.NODE_ENV ===
        "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    },
  );

  return Response.json(
    {
      ok: true,
    },
    {
      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}
