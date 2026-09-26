/**
 * What /api/track-unlock may write to the admin's reader and unlock reports.
 *
 * The endpoint is open to anyone, so the request body is not evidence of who is reading.
 * It used to log whatever email and name it was handed, which let a script fill the
 * reports with invented readers. An identity is now recorded only when the server can vouch
 * for it: the address belongs to a subscriber, or the request carries the signed subscriber
 * cookie. Anyone else is logged as an anonymous read, keyed by IP.
 *
 * Nothing here touches the database or Express, so it can be tested directly.
 */

/** A reader who opens a booklet several times in a sitting is one unlock, not several. */
const UNLOCK_DEDUPE_MS = 30 * 60 * 1000;

const MAX_NAME_LENGTH = 120;

function cleanName(value) {
  return String(value || "").trim().slice(0, MAX_NAME_LENGTH);
}

/**
 * Who this call may be recorded as.
 *
 * @param bodyName name from the request body — only ever used for a vouched-for reader
 * @param existingSubscriber the subscriber row for the body's email, if there is one
 * @param cookieSubscriber the identity in the signed subscriber cookie, if there is one
 * @returns `{ email, name, verified }`; email and name are null for an anonymous read
 */
function resolveTrackedReader({ bodyName, existingSubscriber, cookieSubscriber }) {
  const email = existingSubscriber?.email || cookieSubscriber?.email || null;

  if (!email) {
    return { email: null, name: null, verified: false };
  }

  const name = cleanName(bodyName) || cleanName(existingSubscriber?.name) || cleanName(cookieSubscriber?.name) || null;

  return { email, name, verified: true };
}

/** The unlock row that already covers this reader and booklet, if any, within the window. */
function recentUnlockFilter({ bookletSlug, email, ip, now = new Date() }) {
  return {
    bookletSlug,
    ...(email ? { email } : { email: null, ip: ip || null }),
    unlockedAt: { $gte: new Date(now.getTime() - UNLOCK_DEDUPE_MS) }
  };
}

/** The booklet_readers row for this reader: a person when vouched for, otherwise a device. */
function readerKey({ bookletSlug, email, ip }) {
  return email ? { email, bookletSlug } : { bookletSlug, email: null, ip: ip || null };
}

module.exports = {
  UNLOCK_DEDUPE_MS,
  readerKey,
  recentUnlockFilter,
  resolveTrackedReader
};
