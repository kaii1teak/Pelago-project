"use client";

import { useEffect } from "react";
import { attachBrowserEvents } from "@/lib/live/client";

/**
 * Lets the live feed see the tab and the network (a tab in the background closes the
 * socket, coming back reopens it, going online retries at once). The socket itself opens
 * and closes with whatever on screen shows a live price; this only wires the events.
 */
export function LiveProvider() {
  useEffect(() => attachBrowserEvents(), []);
  return null;
}
