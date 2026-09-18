/**
 * Request-path tracing, silent unless DEBUG_REQUESTS is set.
 *
 * These lines are useful when something is wrong locally and pure noise in production,
 * where they print several paragraphs per request and bury the errors that matter.
 * Startup configuration checks and real errors log unconditionally and do not use this.
 *
 * Read at call time rather than captured at import, so a test or a script can turn
 * tracing on after this module has already loaded.
 */
function debugLog(...args) {
  if (process.env.DEBUG_REQUESTS) {
    console.log(...args);
  }
}

module.exports = { debugLog };
