import type { Metadata } from "next";
import { Cormorant_Garamond, Crimson_Pro, Playfair_Display } from "next/font/google";
import "./globals.css";
import { getSiteContent } from "@/lib/content-store";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";

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

export const metadata: Metadata = {
  metadataBase: new URL("https://www.thevalluru.org"),
  title: "The Valluru — The Inward Fire Series",
  description:
    "Nine booklets on dharma, grief, language, and surrender. For the seeker who still needs an inward anchor.",
  keywords: ["dharma", "grief", "nada", "bhakti", "sanskrit", "spirituality", "inner life"],
  authors: [{ name: "Sasidhar Valluru" }],
  creator: "Sasidhar Valluru",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.thevalluru.org",
    siteName: "The Valluru",
    title: "The Valluru — The Inward Fire Series",
    description: "Nine booklets on dharma, grief, language, and surrender.",
    images: [
      {
        url: "https://www.thevalluru.org/og/default.jpg",
        width: 1200,
        height: 630,
        alt: "The Valluru — The Inward Fire Series"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "The Valluru — The Inward Fire Series",
    description: "Nine booklets on dharma, grief, language, and surrender.",
    images: ["https://www.thevalluru.org/og/default.jpg"]
  },
  robots: "index, follow",
  viewport: "width=device-width, initial-scale=1",
  alternates: {
    canonical: "https://www.thevalluru.org"
  }
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const content = await getSiteContent();

  return (
    <html
      className={`${playfair.variable} ${crimson.variable} ${cormorant.variable}`}
      lang="en"
    >
      <head>
        {/* Google Analytics */}
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-XXXXXXXXXX', {
                page_path: window.location.pathname,
              });
            `,
          }}
        />

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
              name: "The Valluru — The Inward Fire Series",
              url: "https://www.thevalluru.org",
              author: {
                "@type": "Person",
                name: "Sasidhar Valluru"
              }
            })
          }}
        />

        {/* Google Site Verification */}
        <meta name="google-site-verification" content="YOUR_VERIFICATION_CODE" />
      </head>
      <body>
        <SiteNav nav={content.nav} />
        {children}
        <SiteFooter footer={content.footer} />
      </body>
    </html>
  );
}
