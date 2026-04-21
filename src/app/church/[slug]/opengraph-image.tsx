import { ImageResponse } from "next/og";
import { getChurchPublicPageData, resolveChurchPrimaryImage } from "@/lib/church";
import { resolveCanonicalChurchSlug } from "@/lib/church-slugs";
import { cfImage } from "@/lib/media";
import { extractCity } from "@/lib/church-directory";
import { isValidPublicUrl, normalizeDisplayText } from "@/lib/content-quality";

export const alt = "Church on GospelChannel";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type ImageProps = { params: Promise<{ slug: string }> };

function pickName(name: string, official?: string | null): string {
  const o = normalizeDisplayText(official);
  return o && o.length >= 4 ? o : name;
}

export default async function ChurchOgImage({ params }: ImageProps) {
  const { slug } = await params;
  const canonical = resolveCanonicalChurchSlug(slug);
  const data = await getChurchPublicPageData(canonical);

  if (!data) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg,#1d0f0b 0%,#3b2016 50%,#7b4a34 100%)",
            color: "#fff",
            fontSize: 64,
            fontWeight: 800,
          }}
        >
          GospelChannel
        </div>
      ),
      size,
    );
  }

  const { church, videos, enrichment, mergedProfile } = data;
  const displayName = pickName(church.name, enrichment?.officialChurchName);
  const heroImageRaw = resolveChurchPrimaryImage({
    headerImage: church.headerImage,
    videos,
    coverImageUrl: (mergedProfile.coverImageUrl as string | undefined) || enrichment?.coverImageUrl,
  });
  const heroRawIsVideoThumb = heroImageRaw ? /(?:^|\.)(ytimg|youtube)\.com/i.test(heroImageRaw) : false;
  // Skip YouTube thumbs in OG — they often carry text overlays ("ROYAL RANGERS" etc)
  // that compete with the church name. Fall back to gradient-only look.
  const heroImage = heroImageRaw && !heroRawIsVideoThumb
    ? cfImage(heroImageRaw, { width: 1200, height: 630, fit: "cover", quality: 75 })
    : undefined;
  const logoUrlRaw = (mergedProfile.logoUrl as string | undefined) || enrichment?.logoImageUrl || church.logo;
  const logoUrl = isValidPublicUrl(logoUrlRaw) ? cfImage(logoUrlRaw!, { width: 160, height: 160, fit: "cover", quality: 80 }) : undefined;
  const city = normalizeDisplayText(mergedProfile.city as string | undefined) || extractCity(church.location);
  const country = (mergedProfile.country as string | undefined) || church.country;
  const locationLine = [city, country].filter(Boolean).join(", ");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          background: "linear-gradient(135deg,#1d0f0b 0%,#3b2016 60%,#7b4a34 100%)",
          color: "#fff",
        }}
      >
        {heroImage && (
           
          <img
            src={heroImage}
            alt=""
            width={1200}
            height={630}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center 30%",
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(20,10,6,0.96) 0%, rgba(20,10,6,0.78) 35%, rgba(20,10,6,0.30) 70%, rgba(20,10,6,0.10) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse at 0% 100%, rgba(123,74,52,0.55) 0%, transparent 60%)",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "48px 64px 0 64px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 0.5,
              color: "rgba(255,255,255,0.92)",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg,#e9b48f,#c2785a)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontWeight: 900,
                color: "#1d0f0b",
              }}
            >
              G
            </div>
            GospelChannel
          </div>
          {country && (
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 4,
                color: "rgba(255,255,255,0.65)",
              }}
            >
              {country}
            </div>
          )}
        </div>

        <div
          style={{
            position: "relative",
            marginTop: "auto",
            display: "flex",
            alignItems: "flex-end",
            gap: 28,
            padding: "0 64px 60px 64px",
          }}
        >
          {logoUrl && (
             
            <img
              src={logoUrl}
              alt=""
              width={120}
              height={120}
              style={{
                width: 120,
                height: 120,
                borderRadius: 60,
                objectFit: "cover",
                border: "3px solid rgba(255,255,255,0.85)",
                boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
                flexShrink: 0,
              }}
            />
          )}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: displayName.length > 38 ? 60 : displayName.length > 26 ? 76 : 92,
                fontWeight: 900,
                lineHeight: 1.02,
                letterSpacing: -1.5,
                color: "#fff",
                textShadow: "0 4px 24px rgba(0,0,0,0.45)",
                display: "flex",
              }}
            >
              {displayName}
            </div>
            {locationLine && (
              <div
                style={{
                  marginTop: 16,
                  fontSize: 32,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.88)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ width: 10, height: 10, borderRadius: 5, background: "#e9b48f", flexShrink: 0 }} />
                {locationLine}
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
