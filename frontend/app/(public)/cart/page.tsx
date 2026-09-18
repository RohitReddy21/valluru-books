import { PageShell, Section } from "@/components/ui";
import { getSiteContent } from "@/lib/content-store";

export default async function CartPage() {
  const content = await getSiteContent();
  
  return (
    <PageShell>
      <Section>
        <div className="max-w-3xl mx-auto">
          <p className="font-label text-sm uppercase tracking-[0.24em] text-gold">
            Cart
          </p>
          <h1 className="mt-4 responsive-page-title font-display font-semibold text-parchment">
            Your Cart
          </h1>
          <p className="mt-4 text-xl leading-tight text-muted">
            Your cart is currently empty. Add booklets from the series page!
          </p>
        </div>
      </Section>
    </PageShell>
  );
}
