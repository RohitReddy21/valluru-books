import Link from "next/link";
import type { SiteContent } from "@/lib/site-content";

type Props = {
  footer: SiteContent["footer"];
};

export function SiteFooter({ footer }: Props) {
  return (
    <footer className="quiet-divider bg-ink px-5 py-12">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.2fr_1fr_1fr]">
        <div className="flex flex-col gap-4">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/valluru-logo.png"
              alt="The Valluru"
               className="h-14 w-auto sm:h-16 lg:h-20"
              loading="lazy"
            />
          </Link>
          <p className="font-display text-2xl text-parchment">{footer.title}</p>
        </div>
        <nav className="grid gap-3">
          {footer.links.map((link) => (
            <Link
              className="font-label text-sm uppercase tracking-[0.22em] text-muted transition hover:text-gold"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="grid content-start gap-3 text-muted">
          <p>{footer.website}</p>
          <a className="transition hover:text-gold" href={`mailto:${footer.email}`}>
            {footer.email}
          </a>
        </div>
      </div>
      <p className="mx-auto mt-12 max-w-3xl text-center font-body text-base italic text-muted">
        {footer.bottomLine}
      </p>
    </footer>
  );
}
