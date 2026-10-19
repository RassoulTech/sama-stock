/** Décrit un appareil en clair à partir de son « user agent » (ex. « Chrome · Android »). */
export function describeDevice(ua: string | null | undefined): { browser: string; os: string; mobile: boolean } {
  if (!ua) return { browser: "Inconnu", os: "Inconnu", mobile: false };

  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /SamsungBrowser/.test(ua)
        ? "Samsung Internet"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Chrome\/|CriOS\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : "Autre navigateur";

  const os = /iPhone|iPad|iPod/.test(ua)
    ? "iPhone / iPad"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(ua)
          ? "Mac"
          : /Linux/.test(ua)
            ? "Linux"
            : "Autre système";

  return { browser, os, mobile: /Mobile|Android|iPhone|iPad/.test(ua) };
}
