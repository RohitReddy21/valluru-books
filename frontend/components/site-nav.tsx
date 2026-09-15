"use client";

import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Cta, SiteContent } from "@/lib/site-content";

type Props = {
  nav: SiteContent["nav"];
};

function subPages(link: Cta) {
  return Array.isArray(link.children) ? link.children.filter((child) => child?.href) : [];
}

/** A desktop nav entry whose label opens a menu of sub-pages instead of navigating. */
function NavGroup({ link, items }: { link: Cta; items: Cta[] }) {
  const [open, setOpen] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!groupRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      ref={groupRef}
    >
      <button
        aria-expanded={open}
        aria-haspopup="true"
        className="group flex flex-col leading-none"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span className="flex items-center gap-1.5 font-label text-sm uppercase tracking-[0.22em] text-muted transition group-hover:text-gold">
          {link.label}
          <ChevronDown
            className={`transition ${open ? "-rotate-180" : ""}`}
            size={13}
            strokeWidth={1.75}
          />
        </span>
        {link.subtitle ? (
          <span className="mt-1.5 font-body text-[11px] italic leading-tight tracking-normal text-muted/60 transition group-hover:text-gold/70">
            {link.subtitle}
          </span>
        ) : null}
      </button>

      {open ? (
        // The top padding bridges the gap under the label so the menu survives the mouse travel.
        <div className="absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3">
          <div className="min-w-[16rem] rounded-md border border-gold/15 bg-ink/95 p-2 shadow-2xl shadow-black/40 backdrop-blur-md">
            {items.map((item) => (
              <Link
                className="group/item block rounded-sm px-3 py-2.5 transition hover:bg-gold/5"
                href={item.href}
                key={item.href}
                onClick={() => setOpen(false)}
              >
                <span className="block font-label text-[13px] uppercase tracking-[0.18em] text-muted transition group-hover/item:text-gold">
                  {item.label}
                </span>
                {item.subtitle ? (
                  <span className="mt-1 block font-body text-[11px] italic leading-tight text-muted/60">
                    {item.subtitle}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** The same entry in the mobile sheet, where sub-pages expand in place. */
function MobileNavGroup({
  link,
  items,
  onNavigate
}: {
  link: Cta;
  items: Cta[];
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-gold/10">
      <button
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 py-3 text-left"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span>
          <span className="block font-label text-sm uppercase tracking-[0.22em] text-muted">
            {link.label}
          </span>
          {link.subtitle ? (
            <span className="mt-1 block font-body text-xs italic leading-tight text-muted/60">
              {link.subtitle}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={`shrink-0 text-muted transition ${open ? "-rotate-180" : ""}`}
          size={16}
          strokeWidth={1.75}
        />
      </button>
      {open ? (
        <div className="mb-3 ml-3 flex flex-col border-l border-gold/15 pl-4">
          {items.map((item) => (
            <Link className="py-2.5" href={item.href} key={item.href} onClick={onNavigate}>
              <span className="block font-label text-[13px] uppercase tracking-[0.18em] text-muted">
                {item.label}
              </span>
              {item.subtitle ? (
                <span className="mt-1 block font-body text-[11px] italic leading-tight text-muted/60">
                  {item.subtitle}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SiteNav({ nav }: Props) {
  const [open, setOpen] = useState(false);
  const links = Array.isArray(nav.links) ? nav.links : [];

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

        {/* Links carrying a subtitle render two lines, so the row aligns on the label. */}
        <nav className="hidden items-start gap-5 lg:gap-8 md:flex">
          {links.map((link) => {
            const items = subPages(link);

            if (items.length) {
              return <NavGroup items={items} key={link.label} link={link} />;
            }

            return (
              <Link
                className="group flex flex-col leading-none"
                href={link.href}
                key={link.href}
              >
                <span className="font-label text-sm uppercase tracking-[0.22em] text-muted transition group-hover:text-gold">
                  {link.label}
                </span>
                {link.subtitle ? (
                  <span className="mt-1.5 font-body text-[11px] italic leading-tight tracking-normal text-muted/60 transition group-hover:text-gold/70">
                    {link.subtitle}
                  </span>
                ) : null}
              </Link>
            );
          })}
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
            {links.map((link) => {
              const items = subPages(link);

              if (items.length) {
                return (
                  <MobileNavGroup
                    items={items}
                    key={link.label}
                    link={link}
                    onNavigate={() => setOpen(false)}
                  />
                );
              }

              return (
                <Link
                  className="border-b border-gold/10 py-3"
                  href={link.href}
                  key={link.href}
                  onClick={() => setOpen(false)}
                >
                  <span className="block font-label text-sm uppercase tracking-[0.22em] text-muted">
                    {link.label}
                  </span>
                  {link.subtitle ? (
                    <span className="mt-1 block font-body text-xs italic leading-tight text-muted/60">
                      {link.subtitle}
                    </span>
                  ) : null}
                </Link>
              );
            })}
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
