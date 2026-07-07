import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Nunito } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PostHogProvider } from "@/components/PostHogProvider";
import { getChurchStatsAsync } from "@/lib/content";
import { serializeJsonLd } from "@/lib/json-ld";

const sans = Nunito({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["600", "700"],
  style: ["normal", "italic"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export async function generateMetadata(): Promise<Metadata> {
  const { churchCountLabel, countryCount } = await getChurchStatsAsync();
  const siteDescription = `Find the right church with guides that answer the decision and profiles that prove the fit across ${churchCountLabel} churches in ${countryCount} countries.`;
  return {
    metadataBase: new URL("https://gospelchannel.com"),
    title: {
      default: "Find the Right Church Before Your First Visit",
      template: "%s | GospelChannel",
    },
    description: siteDescription,
    keywords: [
      "gospel music",
      "worship songs",
      "gospel songs",
      "praise and worship music",
      "find a church",
      "church near me",
      "church decision engine",
      "first church visit",
      "church service times",
      "worship style churches",
    ],
    openGraph: {
      title: "Find the Right Church Before Your First Visit",
      description: siteDescription,
      type: "website",
      url: "https://gospelchannel.com",
      siteName: "GospelChannel",
      locale: "en_US",
      images: [{ url: "https://gospelchannel.com/hero-worship.jpg" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Find the Right Church Before Your First Visit",
      description: siteDescription,
      images: ["https://gospelchannel.com/hero-worship.jpg"],
    },
    alternates: {
      canonical: "/",
      languages: {
        en: "https://gospelchannel.com/",
        "x-default": "https://gospelchannel.com/",
      },
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const scriptChurchCopy = "GospelChannel helps people find the right church before a first visit: guides answer the decision, and church profiles prove the fit through worship, service details, location, language, and community signals.";
  const scriptBrowseCopy = "Use GospelChannel as a church decision engine: start with a guide or comparison, then verify the answer in the church profile database by worship style, tradition, language, city, service details, music, and visitor cues.";
  const knowsAbout = [
    "church discovery",
    "church decision engine",
    "worship style",
    "church tradition",
    "denomination",
    "language",
    "service details",
    "first church visit",
    "public church profile database",
  ];
  return (
    <html lang="en">
      <body className={`${sans.variable} ${serif.variable} min-h-screen overflow-x-hidden bg-linen text-espresso antialiased`}>
        {/* Enable after AdSense approval.
        <Script
          id="adsense-script"
          strategy="afterInteractive"
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-xxxxxxxx"
          crossOrigin="anonymous"
        />
        */}
        <script
          id="site-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd([
              {
                "@context": "https://schema.org",
                "@type": "Organization",
                "@id": "https://gospelchannel.com/#organization",
                name: "GospelChannel",
                legalName: "AC0 AI, S.L.U.",
                taxID: "B26808741",
                url: "https://gospelchannel.com",
                description: scriptChurchCopy,
                knowsAbout,
                isAccessibleForFree: true,
                address: {
                  "@type": "PostalAddress",
                  streetAddress: "Maestranza 25, planta 1",
                  postalCode: "29016",
                  addressLocality: "Málaga",
                  addressCountry: "ES",
                },
                logo: {
                  "@type": "ImageObject",
                  url: "https://gospelchannel.com/icon.svg",
                  contentUrl: "https://gospelchannel.com/icon.svg",
                },
              },
              {
                "@context": "https://schema.org",
                "@type": "WebSite",
                "@id": "https://gospelchannel.com/#website",
                name: "GospelChannel",
                url: "https://gospelchannel.com",
                description: scriptBrowseCopy,
                inLanguage: "en",
                about: knowsAbout,
                isAccessibleForFree: true,
                publisher: { "@id": "https://gospelchannel.com/#organization" },
                hasPart: [
                  {
                    "@type": "Article",
                    name: "Church choice answer map",
                    url: "https://gospelchannel.com/guides/church-choice-answers",
                    description: "Direct church-choice answers that route each question to a guide answer and matching profile proof route.",
                  },
                  {
                    "@type": "CollectionPage",
                    name: "Church decision guides",
                    url: "https://gospelchannel.com/guides",
                    description: "Answer-first guides for church choice, first visits, worship style, prayer, faith questions, and denomination fit.",
                  },
                  {
                    "@type": "CollectionPage",
                    name: "Church comparison guides",
                    url: "https://gospelchannel.com/compare",
                    description: "Plain-language comparisons that help people choose between worship styles, traditions, and church-size tradeoffs.",
                  },
                  {
                    "@type": "CollectionPage",
                    name: "Church profile proof database",
                    url: "https://gospelchannel.com/church",
                    description: "Public church profiles that prove guide answers with service times, worship music, location, language, tradition, and visitor cues.",
                  },
                  {
                    "@type": "CollectionPage",
                    name: "Visit-ready church proof route",
                    url: "https://gospelchannel.com/church/churches-with-service-times",
                    description: "Profiles with service-time evidence for people ready to plan a real Sunday visit.",
                  },
                  {
                    "@type": "CollectionPage",
                    name: "Worship music proof route",
                    url: "https://gospelchannel.com/church/churches-with-worship-music",
                    description: "Profiles with worship music evidence for checking sound before visiting.",
                  },
                ],
                potentialAction: {
                  "@type": "SearchAction",
                  target: {
                    "@type": "EntryPoint",
                    urlTemplate: "https://gospelchannel.com/church?q={search_term_string}",
                  },
                  "query-input": "required name=search_term_string",
                },
              },
            ]),
          }}
        />
        <PostHogProvider>
            <SiteHeader />
            <main>{children}</main>
            <SiteFooter />
        </PostHogProvider>
        <script
          defer
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon='{"token":"6384a6735e994cde80434067f145f018"}'
        />
      </body>
    </html>
  );
}
