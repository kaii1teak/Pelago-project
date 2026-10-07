"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** Largest avatar the 50px "small" logo still looks right at. */
const SMALL_MAX = 40;

/**
 * Coin icon. CoinGecko serves each logo in several sizes; the markets feed
 * links the 250px one, but a table-row avatar (up to 40px) only needs the 50px
 * "small" variant (2.5KB vs 12KB). With 100 rows that's the difference between
 * 1.2MB and 250KB. Bigger avatars (the asset page header) keep the sharp one.
 *
 * Logos are image content, so they stay circular. Falls back to a letter avatar
 * when there's no image or it fails to load. Decorative (alt=""): the coin's
 * name is always rendered next to it.
 */
export function CoinLogo({
  src,
  name,
  size = 36,
  className,
}: {
  src: string | null | undefined;
  name: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = src ? (size <= SMALL_MAX ? src.replace("/large/", "/small/") : src) : null;

  if (!url || failed) {
    return (
      <span
        aria-hidden="true"
        style={{ width: size, height: size }}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full border border-primary bg-secondary font-semibold text-secondary",
          size >= 32 ? "text-body-md" : "text-body-sm",
          className,
        )}
      >
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <Image
      src={url}
      alt=""
      width={size}
      height={size}
      // Already a tiny CDN-optimized PNG: skip Next's image optimizer (and its monthly quota).
      unoptimized
      onError={() => setFailed(true)}
      className={cn("shrink-0 rounded-full", className)}
    />
  );
}
