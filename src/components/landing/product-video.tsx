"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useRef, useState, useSyncExternalStore } from "react";

const VIDEOS = {
  desktop: { src: "/videos/presentation.mp4", poster: "/videos/presentation.jpg" },
  mobile: { src: "/videos/presentation-mobile.mp4", poster: "/videos/presentation-mobile.jpg" },
};

function useMedia(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => null,
  );
}

/** Vidéo de présentation : se lance seule en sourdine, le son s'active d'un geste du visiteur. */
export function ProductVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const isDesktop = useMedia("(min-width: 640px)");
  const reduceMotion = useMedia("(prefers-reduced-motion: reduce)");
  const video = isDesktop === null ? null : VIDEOS[isDesktop ? "desktop" : "mobile"];

  function toggleSound() {
    const el = ref.current;
    if (!el) return;
    el.muted = !el.muted;
    if (!el.muted) void el.play();
    setMuted(el.muted);
  }

  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-5xl overflow-hidden rounded-2xl border bg-card shadow-[0_32px_80px_-32px_rgb(11_19_16/0.35)] sm:aspect-video">
      {video && (
        <video
          key={video.src}
          ref={ref}
          src={video.src}
          poster={video.poster}
          autoPlay={!reduceMotion}
          controls={Boolean(reduceMotion)}
          muted={muted}
          loop
          playsInline
          preload="metadata"
          aria-label="Présentation de Sama Stock en 35 secondes"
          className="size-full object-cover"
        />
      )}
      {video && !reduceMotion && (
        <button
          type="button"
          onClick={toggleSound}
          aria-pressed={!muted}
          className="absolute bottom-3 left-3 inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-[#0b1310]/75 px-4 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-[#0b1310]/90 focus-visible:ring-3 focus-visible:ring-saffron/50 focus-visible:outline-none sm:bottom-4 sm:left-4"
        >
          {muted ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          {muted ? "Activer le son" : "Couper le son"}
        </button>
      )}
    </div>
  );
}
