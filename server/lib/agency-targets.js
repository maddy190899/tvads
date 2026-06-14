'use strict';

// #73: the single query behind GET /api/agency/playlists. Returns ONLY this token's
// designated playlists, in its bound workspace. The WHERE clause IS the confinement and is
// the thing to bite-test:
//   t.token_id = ?      -> this token's targets, never another token's
//   (JOIN api_token_targets) -> only allowlisted playlists, never one outside the allowlist
//   p.workspace_id = ?  -> only the bound workspace, never cross-workspace
// db is passed in (not module-required) so the confinement is unit-testable in isolation.
function listDesignatedPlaylists(db, tokenId, workspaceId) {
  return db.prepare(`
    SELECT p.id, p.name, p.status
    FROM api_token_targets t
    JOIN playlists p ON p.id = t.playlist_id
    WHERE t.token_id = ? AND p.workspace_id = ?
    ORDER BY p.name
  `).all(tokenId, workspaceId);
}

// #73: resolve which zone an agency item-add lands in, enforcing the zone grants. The grant
// is the boundary; a body-supplied zone can pick WITHIN it but never escape it.
//   - No zone grants for (token, playlist) -> whole-playlist/full-screen (zone_id NULL); a
//     body zone_id is ignored (placement isn't agency-driven when nothing's granted).
//   - Zone grants exist -> the item MUST land in a GRANTED zone:
//       requested zone that IS granted -> use it (agency picks among its grants);
//       requested zone NOT granted     -> { ok:false, reason:'forbidden' } (403);
//       no request, exactly one grant  -> auto-place into it;
//       no request, multiple grants    -> { ok:false, reason:'ambiguous' } (must pick).
function resolveGrantedZone(db, tokenId, playlistId, requestedZoneId) {
  const grants = db.prepare('SELECT zone_id FROM api_token_target_zones WHERE token_id = ? AND playlist_id = ?')
    .all(tokenId, playlistId).map(r => r.zone_id);
  if (!grants.length) return { ok: true, zoneId: null };
  if (requestedZoneId) {
    return grants.includes(requestedZoneId)
      ? { ok: true, zoneId: requestedZoneId }
      : { ok: false, reason: 'forbidden' };
  }
  if (grants.length === 1) return { ok: true, zoneId: grants[0] };
  return { ok: false, reason: 'ambiguous' };
}

module.exports = { listDesignatedPlaylists, resolveGrantedZone };
