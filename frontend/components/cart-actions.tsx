"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import type { Booklet } from "@/lib/site-content";
import { apiUrl } from "@/lib/api";

export type CartItem = {
  slug: string;
  title: string;
  quantity: number;
  price: number;
  currency: string;
};

const CART_KEY = "valluru_cart";

function readCart() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    return JSON.parse(window.localStorage.getItem(CART_KEY) || "[]") as CartItem[];
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  window.localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("valluru-cart-updated"));
}

export function AddToCartButton({ booklet }: { booklet: Booklet }) {
  const [added, setAdded] = useState(false);

  function addToCart() {
    const cart = readCart();
    const existing = cart.find((item) => item.slug === booklet.slug);
    const nextItem = {
      slug: booklet.slug,
      title: booklet.title,
      quantity: 1,
      price: Number(booklet.price || 0),
      currency: booklet.currency || "INR"
    };

    writeCart(
      existing
        ? cart.map((item) =>
            item.slug === booklet.slug
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        : [...cart, nextItem]
    );
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  return (
    <button
      className="inline-flex items-center justify-center gap-2 rounded-md border border-gold/35 px-5 py-3 font-label text-sm uppercase tracking-[0.18em] text-muted transition hover:border-gold hover:text-gold"
      onClick={addToCart}
      type="button"
    >
      <ShoppingCart size={16} />
      {added ? "Added" : "Add To Cart"}
    </button>
  );
}

export function CartLink() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    function updateCount() {
      setCount(readCart().reduce((sum, item) => sum + item.quantity, 0));
    }

    updateCount();
    window.addEventListener("valluru-cart-updated", updateCount);
    window.addEventListener("storage", updateCount);

    return () => {
      window.removeEventListener("valluru-cart-updated", updateCount);
      window.removeEventListener("storage", updateCount);
    };
  }, []);

  return (
    <a
      className="relative inline-flex size-10 items-center justify-center rounded-md border border-gold/20 text-parchment transition hover:border-gold hover:text-gold"
      href="/checkout"
      aria-label="Cart"
    >
      <ShoppingCart size={17} />
      {count > 0 ? (
        <span className="absolute -right-2 -top-2 inline-flex min-w-5 items-center justify-center rounded-full bg-gold px-1.5 py-0.5 text-xs font-semibold text-ink">
          {count}
        </span>
      ) : null}
    </a>
  );
}

export function CheckoutClient() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: ""
  });
  const [status, setStatus] = useState("Review your cart and checkout on WhatsApp.");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setItems(readCart());
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  );
  const currency = items[0]?.currency || "INR";

  function updateQuantity(slug: string, quantity: number) {
    const next = items
      .map((item) =>
        item.slug === slug ? { ...item, quantity: Math.max(1, quantity) } : item
      )
      .filter((item) => item.quantity > 0);

    setItems(next);
    writeCart(next);
  }

  function removeItem(slug: string) {
    const next = items.filter((item) => item.slug !== slug);

    setItems(next);
    writeCart(next);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (items.length === 0) {
      setStatus("Your cart is empty.");
      return;
    }

    setStatus("Creating order...");
    const response = await fetch(apiUrl("/api/orders"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer, items })
    });
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      whatsappUrl?: string;
    } | null;

    if (!response.ok || !payload?.whatsappUrl) {
      setStatus(payload?.error || "Checkout failed. Configure WhatsApp number in admin settings.");
      return;
    }

    writeCart([]);
    setItems([]);
    window.location.href = payload.whatsappUrl;
  }

  return (
    <main className="min-h-screen bg-ink px-5 pb-20 pt-28 text-parchment sm:pt-36">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section>
          <p className="font-label text-sm uppercase tracking-[0.24em] text-gold">
            Cart
          </p>
          <h1 className="responsive-page-title mt-4 font-display font-semibold">
            Checkout
          </h1>
          <div className="mt-8 grid gap-4">
            {items.length === 0 ? (
              <p className="text-lg text-muted">Your cart is empty.</p>
            ) : null}
            {items.map((item) => (
              <article
                className="rounded-md border border-gold/15 bg-surface/70 p-5"
                key={item.slug}
              >
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="font-display text-2xl text-parchment">
                      {item.title}
                    </h2>
                    <p className="mt-2 text-muted">
                      {item.currency} {item.price.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="inline-flex size-10 items-center justify-center rounded-md border border-gold/20 text-muted"
                      onClick={() => updateQuantity(item.slug, item.quantity - 1)}
                      type="button"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="min-w-8 text-center text-lg">{item.quantity}</span>
                    <button
                      className="inline-flex size-10 items-center justify-center rounded-md border border-gold/20 text-muted"
                      onClick={() => updateQuantity(item.slug, item.quantity + 1)}
                      type="button"
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      className="inline-flex size-10 items-center justify-center rounded-md border border-gold/20 text-muted"
                      onClick={() => removeItem(item.slug)}
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <form
          className="rounded-md border border-gold/15 bg-surface/70 p-5"
          onSubmit={submit}
        >
          <h2 className="font-display text-2xl text-parchment">Customer Details</h2>
          {(["name", "phone", "email", "address"] as const).map((field) => (
            <label
              className="mt-4 block font-label text-sm uppercase tracking-[0.18em] text-muted"
              key={field}
            >
              {field}
              <input
                className="mt-2 min-h-12 w-full rounded-md border border-gold/20 bg-ink px-4 py-3 text-lg normal-case tracking-normal text-parchment outline-none focus:border-gold/60"
                onChange={(event) =>
                  setCustomer((current) => ({
                    ...current,
                    [field]: event.target.value
                  }))
                }
                required
                type={field === "email" ? "email" : "text"}
                value={customer[field]}
              />
            </label>
          ))}
          <label className="mt-4 block font-label text-sm uppercase tracking-[0.18em] text-muted">
            Notes
            <textarea
              className="mt-2 min-h-28 w-full rounded-md border border-gold/20 bg-ink px-4 py-3 text-lg normal-case tracking-normal text-parchment outline-none focus:border-gold/60"
              onChange={(event) =>
                setCustomer((current) => ({ ...current, notes: event.target.value }))
              }
              value={customer.notes}
            />
          </label>
          <div className="mt-5 border-t border-gold/15 pt-5">
            <div className="flex justify-between text-lg">
              <span>Total</span>
              <strong>
                {currency} {total.toFixed(2)}
              </strong>
            </div>
            <button
              className="mt-5 w-full rounded-md border border-gold/60 px-5 py-3 font-label text-sm uppercase tracking-[0.18em] text-parchment transition hover:border-gold hover:text-gold disabled:opacity-60"
              disabled={items.length === 0}
              type="submit"
            >
              Checkout On WhatsApp
            </button>
            <p className="mt-3 text-base italic text-muted">{status}</p>
          </div>
        </form>
      </div>
    </main>
  );
}
