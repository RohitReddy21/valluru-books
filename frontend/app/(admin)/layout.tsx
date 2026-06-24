import { Cormorant_Garamond, Crimson_Pro, Playfair_Display } from "next/font/google";
import "../globals.css";
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

export default async function AdminLayout({
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
      <body>
        <SiteNav nav={content.nav} />
        {children}
        <SiteFooter footer={content.footer} />
      </body>
    </html>
  );
}
