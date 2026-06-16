"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import type { SiteContent } from "@/lib/site-content";

type Props = {
  nav: SiteContent["nav"];
};

export function SiteNav({ nav }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-gold/10 bg-ink/86 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-5 sm:py-4">
        <Link
          href="/"
          className="shrink-0 flex items-center gap-2"
          onClick={() => setOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/valluru-logo.png"
            alt="The Valluru"
            className="h-14 w-auto sm:h-16 lg:h-20"
            loading="eager"
          />
        </Link>

        <nav className="hidden items-center gap-5 lg:gap-8 md:flex">
          {nav.links.map((link) => (
            <Link
              className="font-label text-sm uppercase tracking-[0.22em] text-muted transition hover:text-gold"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
          <Link
            className="rounded-md border border-gold/55 px-3 py-2 font-label text-xs uppercase tracking-[0.18em] text-parchment transition hover:border-gold hover:text-gold lg:px-4 lg:text-sm"
            href={nav.button.href}
          >
            {nav.button.label}
          </Link>
        </nav>

        <button
          aria-label={open ? "Close navigation" : "Open navigation"}
          className="inline-flex size-10 items-center justify-center rounded-md border border-gold/20 text-parchment md:hidden"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          {open ? <X size={19} /> : <Menu size={19} />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-gold/10 bg-ink px-5 pb-6 pt-2 md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-2">
            {nav.links.map((link) => (
              <Link
                className="border-b border-gold/10 py-3 font-label text-sm uppercase tracking-[0.22em] text-muted"
                href={link.href}
                key={link.href}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              className="mt-3 rounded-md border border-gold/55 px-4 py-3 text-center font-label text-sm uppercase tracking-[0.2em] text-parchment"
              href={nav.button.href}
              onClick={() => setOpen(false)}
            >
              {nav.button.label}
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
