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
  const siteDescription = `GospelChannel is the global church guide for comparing worship style, tradition, location, language, and service times across ${churchCountLabel} churches in ${countryCount} countries.`;
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
      "church directory",
      "first church visit",
      "church service times",
      "worship style churches",
    ],
    openGraph: {
      title: "GospelChannel — The Church Guide",
      description: siteDescription,
      type: "website",
      url: "https://gospelchannel.com",
      siteName: "GospelChannel",
      locale: "en_US",
      images: [{ url: "https://gospelchannel.com/hero-worship.jpg" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "GospelChannel — The Church Guide",
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
  const scriptChurchCopy = "GospelChannel is The Church Guide, helping people find the right church before a first visit by comparing worship style, tradition, location, language, service times, music, and community life.";
  const scriptBrowseCopy = "The global church guide for exploring churches by worship style, tradition, language, city, service times, music, and visitor information.";
  const knowsAbout = [
    "church discovery",
    "church search",
    "worship style",
    "church tradition",
    "denomination",
    "language",
    "service details",
    "first church visit",
    "church directory",
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
                slogan: "The Church Guide",
                description: scriptChurchCopy,
                knowsAbout,
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
                    name: "Church choice guides",
                    url: "https://gospelchannel.com/guides/church-choice-answers",
                    description: "Guides that help people explore worship style, tradition, location, language, and service times.",
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
                    name: "Audience church-search routes",
                    url: "https://gospelchannel.com/for",
                    description: "Audience-specific church-choice routes for expats, students, young adults, families, new believers, and deconstructing seekers.",
                  },
                  {
                    "@type": "CollectionPage",
                    name: "Church directory",
                    url: "https://gospelchannel.com/church",
                    description: "Church pages with service times, worship music, location, language, tradition, and visitor information.",
                  },
                  {
                    "@type": "CollectionPage",
                    name: "Churches with service times",
                    url: "https://gospelchannel.com/church/churches-with-service-times",
                    description: "Churches with published service times for people planning a Sunday visit.",
                  },
                  {
                    "@type": "CollectionPage",
                    name: "Churches with worship music",
                    url: "https://gospelchannel.com/church/churches-with-worship-music",
                    description: "Churches with worship music for people exploring their worship style.",
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
