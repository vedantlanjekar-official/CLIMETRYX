"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Decorative background video. Playback starts from script so users who prefer
 * reduced motion get the still poster, and a blocked or failed load leaves the
 * poster (also set as the hero background) in place.
 */
export function HeroVideo({ src, poster }: { src: string; poster: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (query.matches) {
        video.pause();
        return;
      }
      video.muted = true;
      video.play().catch(() => {
        // Autoplay blocked: the poster remains visible.
      });
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  if (failed) return null;

  return (
    <video
      ref={ref}
      className="fin05-hero__video absolute inset-0 h-full w-full object-cover"
      muted
      loop
      playsInline
      preload="metadata"
      poster={poster}
      aria-hidden="true"
      tabIndex={-1}
      disablePictureInPicture
      onError={() => setFailed(true)}
    >
      <source src={src} type="video/mp4" onError={() => setFailed(true)} />
    </video>
  );
}
