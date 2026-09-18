"use client";

import { useState } from "react";
import { CoffeeTableUnavailableModal } from "./coffee-table-unavailable-modal";

export function AddToCartButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        className="inline-flex items-center justify-center gap-2 rounded-md border border-gold/35 bg-gold/5 px-5 py-3 font-label text-sm uppercase tracking-[0.18em] text-gold transition hover:border-gold hover:bg-gold/10"
        type="button"
        onClick={() => setIsModalOpen(true)}
      >
        Add to Cart
      </button>
      <CoffeeTableUnavailableModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
