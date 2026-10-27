"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";
import { SHOP_COOKIE, SHOP_COOKIE_MAX_AGE } from "@/lib/shop-app";

/**
 * Couleurs du téléphone (barre d'état, barre d'adresse) alignées sur l'application : couleur de la boutique en
 * mode clair, fond sombre en mode sombre, même quand le mode est choisi dans l'application et non par le téléphone.
 * Retient aussi la boutique sur cet appareil (licences) : après une déconnexion, on revient sur sa page.
 */
export function ShopAppSync({ light, dark, rememberSlug }: { light: string; dark: string; rememberSlug: string | null }) {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!resolvedTheme) return;
    const color = resolvedTheme === "dark" ? dark : light;
    const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    if (metas.length === 0) {
      const meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
      meta.content = color;
      return;
    }
    metas.forEach((m) => {
      m.content = color;
      m.removeAttribute("media");
    });
  }, [resolvedTheme, light, dark]);

  useEffect(() => {
    if (!rememberSlug) return;
    const current = document.cookie.split("; ").find((c) => c.startsWith(`${SHOP_COOKIE}=`))?.split("=")[1];
    if (current === rememberSlug) return;
    const secure = window.location.protocol === "https:" ? "; secure" : "";
    document.cookie = `${SHOP_COOKIE}=${rememberSlug}; path=/; max-age=${SHOP_COOKIE_MAX_AGE}; samesite=lax${secure}`;
  }, [rememberSlug]);

  return null;
}
