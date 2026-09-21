/**
 * Whether this deployment is a review copy rather than the live site.
 *
 * Set NEXT_PUBLIC_SANDBOX=1 on the sandbox project only. It keeps search engines out and
 * keeps the live GTM container, GA4 property and Meta Pixel from receiving the visits of
 * people testing the copy — a test sign-up would otherwise be counted as a real one.
 *
 * Unset is the live site, so a missing variable can never switch analytics off in
 * production.
 */
export const isSandbox = process.env.NEXT_PUBLIC_SANDBOX === "1";
