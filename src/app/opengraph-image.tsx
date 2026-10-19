import { ImageResponse } from "next/og";

// Aperçu affiché quand un lien du site est partagé (WhatsApp, Facebook, LinkedIn…)
export const alt = "Sama Stock — la gestion de stock des boutiques, e-commerçants et entrepreneurs du Sénégal";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #0b6e4f 0%, #0a3d2d 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <svg width="76" height="76" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="9" fill="#0B6E4F" stroke="rgba(255,255,255,0.35)" strokeWidth="0.6" />
            <path
              d="M21.6 11.4c-.9-1.7-2.9-2.8-5.5-2.8-3.2 0-5.3 1.6-5.3 3.9 0 5.4 11 2.5 11 8 0 2.5-2.3 4.4-5.8 4.4-2.7 0-4.8-1.1-5.8-2.9"
              fill="none"
              stroke="#fff"
              strokeWidth="3.1"
              strokeLinecap="round"
            />
            <circle cx="24.6" cy="7.6" r="2.4" fill="#F59E0B" />
          </svg>
          <div style={{ display: "flex", fontSize: 52, fontWeight: 700, letterSpacing: -1.5 }}>
            Sama<span style={{ color: "#F59E0B", marginLeft: 14 }}>Stock</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 66, fontWeight: 700, lineHeight: 1.08, letterSpacing: -2, maxWidth: 980 }}>
            Votre stock, vos ventes et vos crédits enfin sous contrôle.
          </div>
          <div style={{ marginTop: 26, fontSize: 30, color: "rgba(255,255,255,0.8)" }}>
            Boutiques, e-commerçants et entrepreneurs du Sénégal
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              padding: "14px 28px",
              borderRadius: 999,
              background: "#F59E0B",
              color: "#1c1408",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            Essai gratuit 14 jours
          </div>
          <div style={{ fontSize: 26, color: "rgba(255,255,255,0.75)" }}>Wave · Orange Money · Espèces</div>
        </div>
      </div>
    ),
    size,
  );
}
