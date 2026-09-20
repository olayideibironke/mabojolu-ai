"use client";

import {
  useSyncExternalStore,
} from "react";

import {
  profileBrowserDevice,
  type BrowserDeviceProfile,
} from "@/lib/ai/browser-device-profile";

let cachedProfile:
  BrowserDeviceProfile |
  null = null;

function subscribe():
  () => void {
  return () => {};
}

function getClientSnapshot():
  BrowserDeviceProfile {
  cachedProfile ??=
    profileBrowserDevice();

  return cachedProfile;
}

function getServerSnapshot():
  null {
  return null;
}

/**
 * Browser capability is an external environment snapshot rather than component
 * state. useSyncExternalStore keeps server rendering hydration-safe while
 * avoiding an effect-driven setState pass on the client.
 */
export function useBrowserDeviceProfile():
  BrowserDeviceProfile |
  null {
  return useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
}
