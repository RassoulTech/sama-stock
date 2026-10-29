import { ImageResponse } from "next/og";
import { iconLogo, shopColors } from "@/lib/domain/shop-brand";
import { initials } from "@/lib/format";
import { shopBySlug } from "@/server/queries/shop-login";

const SIZES = new Set([180, 192, 512]);

/**
 * Icône de l'application d'une boutique : son logo sur un carré blanc, posé sur sa couleur (les initiales à défaut
 * de logo), avec un contour fin. Le fond couvre toute l'icône : elle reste belle quand le téléphone l'arrondit.
 * `?masque=1` (Android découpe l'icône en rond) : carré un peu plus petit et plus arrondi, pour ne pas être coupé.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string; taille: string }> }) {
  const { slug, taille } = await params;
  const size = SIZES.has(Number(taille)) ? Number(taille) : 192;
  const shop = await shopBySlug(slug);
  if (!shop) return new Response(null, { status: 404 });

  const colors = shopColors(shop.brandColor);
  const logo = iconLogo(shop.logo);
  const maskable = new URL(request.url).searchParams.get("masque") === "1";
  const tile = Math.round(size * (maskable ? 0.72 : 0.82));

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: colors.sidebar }}>
        <div
          style={{
            width: tile,
            height: tile,
            borderRadius: Math.round(size * (maskable ? 0.2 : 0.17)),
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
            <span style={{ fontSize: Math.round(size * (maskable ? 0.26 : 0.3)), fontWeight: 700, color: colors.primary, letterSpacing: -1 }}>{initials(shop.name)}</span>
          )}
        </div>
      </div>
    ),
    {
      width: size,
      height: size,
      // Adresse versionnée (?v=…) : elle change avec le logo ou la couleur, on peut donc la garder longtemps
      headers: { "Cache-Control": new URL(request.url).searchParams.get("v") === shop.version ? "public, max-age=31536000, immutable" : "public, max-age=300" },
    },
  );
}
