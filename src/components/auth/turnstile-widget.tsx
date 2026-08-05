"use client";

import Script from "next/script";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

interface TurnstileWidgetProps {
  onTokenChange: (
    token: string | null,
  ) => void;

  className?: string;
}

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      theme?: "auto" | "light" | "dark";
      size?: "normal" | "compact" | "flexible";
      appearance?:
        | "always"
        | "execute"
        | "interaction-only";
      callback: (
        token: string,
      ) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ): string;

  remove(
    widgetId: string,
  ): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function TurnstileWidget({
  onTokenChange,
  className,
}: TurnstileWidgetProps) {
  const containerRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const widgetIdRef =
    useRef<string | null>(
      null,
    );

  const [
    isScriptReady,
    setIsScriptReady,
  ] = useState(false);

  const siteKey =
    process.env
      .NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const renderWidget =
    useCallback(() => {
      if (
        !siteKey ||
        !isScriptReady ||
        !containerRef.current ||
        !window.turnstile ||
        widgetIdRef.current
      ) {
        return;
      }

      widgetIdRef.current =
        window.turnstile.render(
          containerRef.current,
          {
            sitekey:
              siteKey,

            theme:
              "auto",

            size:
              "flexible",

            appearance:
              "interaction-only",

            callback: (
              token,
            ) => {
              onTokenChange(
                token,
              );
            },

            "expired-callback":
              () => {
                onTokenChange(
                  null,
                );
              },

            "error-callback":
              () => {
                onTokenChange(
                  null,
                );
              },
          },
        );
    }, [
      isScriptReady,
      onTokenChange,
      siteKey,
    ]);

  useEffect(() => {
    renderWidget();
  }, [renderWidget]);

  useEffect(() => {
    return () => {
      const widgetId =
        widgetIdRef.current;

      if (
        widgetId &&
        window.turnstile
      ) {
        window.turnstile.remove(
          widgetId,
        );
      }

      widgetIdRef.current =
        null;

      onTokenChange(
        null,
      );
    };
  }, [onTokenChange]);

  if (!siteKey) {
    return (
      <p
        role="alert"
        className="text-sm text-danger"
      >
        Mabojolu security verification is not configured.
      </p>
    );
  }

  return (
    <>
      <Script
        id="cloudflare-turnstile"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() =>
          setIsScriptReady(
            true,
          )
        }
      />

      <div
        ref={containerRef}
        className={
          className
        }
        aria-label="Security verification"
      />
    </>
  );
}