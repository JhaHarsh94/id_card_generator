# Verification and known limits

Run `npm run check` for lint, 44 automated tests and the production build. The API integration tests apply the checked-in schema to an isolated in-memory PostgreSQL database, then execute the actual handlers. No live database is modified.

## Fixed in this review

- Member ID suggestions refresh after writes; the generator updates a saved card instead of creating duplicate records.
- Unsaved changes must be saved before the generator downloads, prints or shares the card.
- Member creation respects saved organisation settings and permits entering a unique member ID.
- Photo processing keeps text entered while an image is being decoded and prevents saving an unfinished upload.
- Client and server validation reject malformed JSON, invalid dates, date windows, IDs, settings and oversized images.
- Calendar dates and expiry status use the organisation's Asia/Kolkata calendar on both the server and browser.
- Verification distinguishes an unavailable service from a missing member and supports retry.
- Requests time out, invalid server responses are rejected, expired sessions redirect to sign-in, and failed network sign-out reports an error.
- Sign-out clears the cookie even if the database is unavailable. Temporary database failures return 503 instead of falsely reporting an expired session.
- Narrow-screen dashboard panels and header controls fit; the navigation drawer supports Escape, focus containment and background scroll locking.
- QR generation uses a full quiet zone and exports wait for the current QR code. Verification links use the configured site consistently.
- Combined PDF downloads paginate correctly. Share failures report an error rather than claiming a download succeeded.
- CSV values that could be interpreted as formulas are escaped. Partial bulk revocations retain failed selections and refresh successful changes.
- Unexpected render errors show a reload action instead of a blank screen.

## Browser coverage

`npm run test:browser` checks the development sample, actual PNG/PDF downloads, a ten-card PDF, print markup, long Hindi text, photo replacement and settings persistence. It requires `npm run dev` and isolated Chrome with remote debugging on port 9222.

`npm run dev:test-api` plus `npm run test:system` checks the complete API-backed interface and failure handling. Layout checks cover ten pages at 320, 390, 768 and 1440 pixels. See [DEPLOY.md](DEPLOY.md) for instructions.

## Limits

The browser checks use desktop Chrome with phone/tablet viewports. Physical iOS/Safari and Android devices, their native share sheets, real printers, live hosting and the production database have not been tested in this workspace. Complete the deployment smoke checks against the configured host before issuing real cards.
