import { ImageResponse } from "next/og";
import { iconLogo, shopColors } from "@/lib/domain/shop-brand";
import { initials } from "@/lib/format";
import { shopBySlug } from "@/server/queries/shop-login";

const SIZES = new Set([180, 192, 512]);

/**
 * Icône de l'application d'une boutique : son logo sur un carré blanc, posé sur sa couleur (les initiales à défaut
 * de logo). Le fond couvre toute l'icône : elle reste belle quand le téléphone l'arrondit.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; taille: string }> }) {
  const { slug, taille } = await params;
  const size = SIZES.has(Number(taille)) ? Number(taille) : 192;
  const shop = await shopBySlug(slug);
  if (!shop) return new Response(null, { status: 404 });

  const colors = shopColors(shop.brandColor);
  const logo = iconLogo(shop.logo);
  const tile = Math.round(size * 0.62);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: colors.sidebar }}>
        <div
          style={{
            width: tile,
            height: tile,
            borderRadius: Math.round(size * 0.14),
            background: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- image générée côté serveur
            <img src={logo} alt="" width={tile} height={tile} style={{ objectFit: "cover" }} />
          ) : (
            <span style={{ fontSize: Math.round(size * 0.24), fontWeight: 700, color: colors.primary, letterSpacing: -1 }}>{initials(shop.name)}</span>
          )}
        </div>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
