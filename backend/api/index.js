/**
 * Serverless entry point. server.js exports the Express app and only binds a port when
 * run directly, so the same file serves both a long-running host (Render) and this one.
 *
 * Caveat: admin file uploads write to disk through multer, which does not survive a
 * read-only serverless filesystem. Uploading is expected to fail here; everything that
 * reads content, serves booklets or handles subscriptions works.
 */
module.exports = require("../server.js");
