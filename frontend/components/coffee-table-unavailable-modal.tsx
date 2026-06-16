"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

interface CoffeeTableUnavailableModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CoffeeTableUnavailableModal({
  isOpen,
  onClose,
}: CoffeeTableUnavailableModalProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 min-h-screen">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink/85 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md bg-surface border border-gold/30 rounded-lg shadow-[0_18px_55px_rgba(0,0,0,0.35)] overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gold/15 bg-ink/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center">
              <span className="text-gold text-xl">⚠️</span>
            </div>
            <h3 className="font-display text-xl font-semibold text-parchment">
              COFFEE-TABLE EDITION UNAVAILABLE
            </h3>
          </div>
          <button
            className="p-2 rounded-md text-muted hover:text-gold hover:bg-gold/5 transition"
            onClick={onClose}
            type="button"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-parchment/85 leading-relaxed">
            Only the separate Movement Three coffee-table volume is not available.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-gold/35 bg-gold/5 px-5 py-3 font-label text-sm uppercase tracking-[0.18em] text-gold transition hover:border-gold hover:bg-gold/10"
            type="button"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
