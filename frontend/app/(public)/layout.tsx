import type { Metadata, Viewport } from "next";
import {
  Arimo,
  Cormorant_Garamond,
  Crimson_Pro,
  EB_Garamond,
  Gelasio,
  Noto_Serif,
  Noto_Serif_Telugu,
  Playfair_Display
} from "next/font/google";
import Script from "next/script";
import "../globals.css";
import { getSiteContent } from "@/lib/content-store";
import { MetaPixel } from "@/components/meta-pixel";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { GlobalSubscribePopup } from "@/components/global-subscribe-popup";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap"
});

const crimson = Crimson_Pro({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap"
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-label",
  display: "swap",
  weight: ["500", "600", "700"]
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
  robots: "index, follow",
  alternates: {
    canonical: "https://www.thevalluru.org"
  }
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
      className={`${playfair.variable} ${crimson.variable} ${cormorant.variable} ${notoSerif.variable} ${notoSerifTelugu.variable} ${ebGaramond.variable} ${gelasio.variable} ${arimo.variable}`}
      lang="en"
    >
      <head>
        <link href="https://www.googletagmanager.com" rel="preconnect" />
        <link href="https://connect.facebook.net" rel="preconnect" />

        {/* Organization Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "The Valluru",
              url: "https://www.thevalluru.org",
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
        <meta name="google-site-verification" content="GTM-K6F4DJ54" />
      </head>
      <body>
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-K6F4DJ54"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <MetaPixel />

        {/* Google Tag Manager */}
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-K6F4DJ54');`}
        </Script>

        {/*
          GA4 also runs through the GTM container above. If G-HYV3VRYR06 is configured
          there, this standalone tag double-counts and should be deleted — that check
          needs the container, not the code.
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

        <SiteNav nav={content.nav} />
        {children}
        <SiteFooter footer={content.footer} />
        <GlobalSubscribePopup />
      </body>
    </html>
  );
}
