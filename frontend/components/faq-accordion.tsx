"use client";

import { useState } from "react";

type FaqItem = {
  question: string;
  answer: string;
};

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="mt-8 space-y-6">
      {items.map((item, index) => (
        <div
          key={item.question}
          className="rounded-md border border-gold/15 bg-surface/50 overflow-hidden"
        >
          <button
            className="w-full text-left p-6 flex justify-between items-center transition-colors hover:bg-surface/75"
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
            type="button"
          >
            <h3 className="font-display text-2xl text-parchment">{item.question}</h3>
            <span className="text-gold transition-transform duration-300" style={{ transform: openIndex === index ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              ▼
            </span>
          </button>
          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${openIndex === index ? 'max-h-96' : 'max-h-0'}`}>
            <div className="px-6 pb-6">
              <p className="text-base leading-7 text-parchment/80">{item.answer}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
