"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  profileBrowserDevice,
  type BrowserDeviceProfile,
} from "@/lib/ai/browser-device-profile";

export function useBrowserDeviceProfile():
  BrowserDeviceProfile |
  null {
  const [
    profile,
    setProfile,
  ] = useState<
    BrowserDeviceProfile |
    null
  >(
    null,
  );

  useEffect(
    () => {
      setProfile(
        profileBrowserDevice(),
      );
    },
    [],
  );

  return profile;
}
