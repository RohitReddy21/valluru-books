import type { Metadata, Viewport } from "next";
import {
  Arimo,
  Crimson_Pro,
  EB_Garamond,
  Gelasio,
  Noto_Serif,
  Noto_Serif_Telugu,
  Playfair_Display
} from "next/font/google";
import Script from "next/script";
import { Suspense } from "react";
import "../globals.css";
import { getSiteContent } from "@/lib/content-store";
import { isSandbox } from "@/lib/site-env";
import { GaPageView } from "@/components/ga-page-view";
import { MetaPixel } from "@/components/meta-pixel";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { GlobalSubscribePopup } from "@/components/global-subscribe-popup";
import { ScrollToTop } from "@/components/scroll-to-top";

const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap"
});

/**
 * Two faces for the site, as the brand guidelines ask: Playfair Display for headings and
 * Crimson Pro for everything else, labels and buttons included. A third family, Cormorant
 * Garamond, used to set the uppercase labels; its thin strokes were faint at label sizes
 * and it cost a download on every page. The `label` role in tailwind.config now resolves
 * to this face.
 */
const crimson = Crimson_Pro({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap"
});

/**
 * What the booklets themselves are set in. Only the reader uses them, so they are not
 * preloaded: a reader who never opens a booklet should not pay for two more families,
 * and the Telugu face in particular is a large download.
 */
const notoSerif = Noto_Serif({
  subsets: ["latin"],
  variable: "--font-page",
  display: "swap",
  weight: ["400", "600"],
  preload: false
});

/**
 * The other faces the booklets are set in, so the reader can look like each one. EB
 * Garamond is booklet thirteen; Gelasio stands in for Georgia, which the Inward Mirror
 * series is set in and which is not free to serve; Arimo is the metric twin of the Arial
 * the last eight booklets use. Lazy for the same reason as the two above — a face is
 * fetched only when a booklet set in it is opened.
 */
const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-page-garamond",
  display: "swap",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  preload: false
});

const gelasio = Gelasio({
  subsets: ["latin"],
  variable: "--font-page-georgia",
  display: "swap",
  weight: ["400", "600"],
  style: ["normal", "italic"],
  preload: false
});

const arimo = Arimo({
  subsets: ["latin"],
  variable: "--font-page-sans",
  display: "swap",
  weight: ["400", "700"],
  style: ["normal", "italic"],
  preload: false
});

const notoSerifTelugu = Noto_Serif_Telugu({
  subsets: ["telugu"],
  variable: "--font-page-telugu",
  display: "swap",
  weight: ["400", "600"],
  preload: false
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.thevalluru.org"),
  title: "Booklets - The Inward Fire Series | The Valluru",
  description:
    "Booklets on dharma, grief, language, and surrender. For the seeker who still needs an inward anchor.",
  keywords: ["dharma", "grief", "nada", "bhakti", "sanskrit", "spirituality", "inner life"],
  authors: [{ name: "Sasidhar Valluru" }],
  creator: "Sasidhar Valluru",
  icons: {
    icon: "/valluru-logo.png",
    apple: "/valluru-logo.png"
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.thevalluru.org",
    siteName: "The Valluru",
    title: "Booklets - The Inward Fire Series | The Valluru",
    description:
      "Booklets on dharma, grief, language, and surrender. For the seeker who still needs an inward anchor.",
    images: [
      {
        url: "https://www.thevalluru.org/og/default.jpg",
        width: 1200,
        height: 630,
        alt: "Booklets - The Inward Fire Series | The Valluru"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Booklets - The Inward Fire Series | The Valluru",
    description:
      "Booklets on dharma, grief, language, and surrender. For the seeker who still needs an inward anchor.",
    images: ["https://www.thevalluru.org/og/default.jpg"]
  },
  // A review copy must not compete with the live site in search results.
  robots: isSandbox ? "noindex, nofollow" : "index, follow"
  // No canonical here: a layout-level one is inherited by every page that does not set its
  // own, which told search engines /series, /about and /movements were copies of the home page.
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const content = await getSiteContent();

  return (
    <html
      className={`${playfair.variable} ${crimson.variable} ${notoSerif.variable} ${notoSerifTelugu.variable} ${ebGaramond.variable} ${gelasio.variable} ${arimo.variable}`}
      lang="en"
    >
      <head>
        {isSandbox ? null : (
          <>
            <link href="https://www.googletagmanager.com" rel="preconnect" />
            <link href="https://connect.facebook.net" rel="preconnect" />
          </>
        )}

        {/* Organization Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "The Valluru",
              url: "https://www.thevalluru.org",
              logo: "https://www.thevalluru.org/valluru-logo.png",
              email: "sasi@theValluru.org",
              author: {
                "@type": "Person",
                name: "Sasidhar Valluru"
              }
            })
          }}
        />

        {/* WebSite Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Booklets - The Inward Fire Series | The Valluru",
              url: "https://www.thevalluru.org",
              author: {
                "@type": "Person",
                name: "Sasidhar Valluru"
              }
            })
          }}
        />

        {/* Google Site Verification */}
        {/*
          Search Console's verification token, set as NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION.
          This tag used to carry the GTM container id, which Search Console does not accept
          as a token, so it verified nothing.
        */}
        {isSandbox || !googleSiteVerification ? null : (
          <meta name="google-site-verification" content={googleSiteVerification} />
        )}
      </head>
      <body>
        {/* The live GA4 property and Meta Pixel stay off the sandbox. */}
        {isSandbox ? null : (
          <>
            <MetaPixel />
            <Suspense fallback={null}>
              <GaPageView />
            </Suspense>

            {/*
              GA4 is the only Google tag on the page. There is deliberately no Google Tag
              Manager snippet: the container (GTM-K6F4DJ54) was checked on 2026-09-26 and had
              no tags, rules or GA4/Ads configuration, so it loaded ~330 KB on every page to do
              nothing, and it was removed. If a container is ever wanted again, add its
              snippet back AND delete this tag if the container sends GA4, or every hit counts
              twice.
            */}
            <Script
              src="https://www.googletagmanager.com/gtag/js?id=G-HYV3VRYR06"
              strategy="afterInteractive"
            />
            <Script id="ga4-config" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-HYV3VRYR06', { page_path: window.location.pathname });`}
            </Script>
          </>
        )}

        <a
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:border focus:border-gold focus:bg-ink focus:px-4 focus:py-2 focus:font-label focus:text-sm focus:uppercase focus:tracking-[0.18em] focus:text-parchment"
          href="#main"
        >
          Skip to content
        </a>
        <SiteNav nav={content.nav} />
        {children}
        <SiteFooter footer={content.footer} />
        <GlobalSubscribePopup />
        <ScrollToTop />
      </body>
    </html>
  );
}
