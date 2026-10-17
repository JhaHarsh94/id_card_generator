import { json, requireMethod } from './_lib/respond.js';

/**
 * GET /api/health
 *
 * A build marker, not a database probe: it must answer instantly and without
 * a connection, so a cold Neon compute does not make the deployment look down.
 */
export default function handler(req, res) {
  if (requireMethod(req, res, ['GET'])) return;
  json(res, 200, { ok: true, service: 'id-card-system', time: new Date().toISOString() });
}
