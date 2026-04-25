import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Cormorant_Garamond, Nunito } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PostHogProvider } from "@/components/PostHogProvider";
import { getChurchStatsAsync } from "@/lib/content";

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
  return {
    metadataBase: new URL("https://gospelchannel.com"),
    title: {
      default: "Find the Right Church Before Your First Visit",
      template: "%s | GospelChannel",
    },
    description:
      `Compare worship style, tradition, language, and service details across ${churchCountLabel} churches in ${countryCount} countries before your first visit.`,
    keywords: [
      "gospel music",
      "worship songs",
      "gospel songs",
      "praise and worship music",
      "christian music streaming",
      "gospel music online",
      "best worship songs 2026",
      "gospel playlist",
      "church worship songs",
      "gospel music free",
    ],
    openGraph: {
      title: "Find the Right Church Before Your First Visit",
      description:
        `Compare worship style, tradition, language, and service details across ${churchCountLabel} churches in ${countryCount} countries before your first visit.`,
      type: "website",
      url: "https://gospelchannel.com",
      siteName: "GospelChannel",
      locale: "en_US",
      images: [{ url: "https://gospelchannel.com/hero-worship.jpg" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Find the Right Church Before Your First Visit",
      description: `Compare worship style, tradition, language, and service details across ${churchCountLabel} churches before your first visit.`,
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
  const scriptChurchCopy = "Gospel helps you find the right church before your first visit. Every church has a channel you can tune into through worship, service details, and community signals.";
  const scriptBrowseCopy = "Compare church channels by worship style, tradition, language, city, and service details before your first visit.";
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
        <Script
          id="site-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              {
                "@context": "https://schema.org",
                "@type": "Organization",
                "@id": "https://gospelchannel.com/#organization",
                name: "GospelChannel",
                url: "https://gospelchannel.com",
                description: scriptChurchCopy,
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
                publisher: { "@id": "https://gospelchannel.com/#organization" },
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
      </body>
    </html>
  );
}
