const { pool } = require('../db/pool');
const config = require('../config/env');

const GEOFENCE_RADIUS_METERS = 100;

// [BIN-16] Checks distance against ONE specific dumpster (the request's
// assigned_dumpster_id, locked in at claim time — see migration 051) rather
// than searching for whichever dumpster happens to be nearest right now.
// A bin reported full AFTER this collector was assigned to it must not
// invalidate a disposal that's otherwise legitimate — status plays no part
// in this check at all, only "is this the bin they were assigned, and are
// they within range of it."
async function isWithinGeofenceOfDumpster(latitude, longitude, dumpsterId) {
    const result = await pool.query(
        `SELECT id,
                6371000 * 2 * asin(sqrt(
                    power(sin(radians(latitude - $1) / 2), 2) +
                    cos(radians($1)) * cos(radians(latitude)) *
                    power(sin(radians(longitude - $2) / 2), 2)
                )) AS distance_meters
         FROM dumpsters
         WHERE id = $3`,
        [latitude, longitude, dumpsterId]
    );
    const row = result.rows[0] || null;
    return row && Number(row.distance_meters) <= GEOFENCE_RADIUS_METERS ? row : null;
}

// [BIN-17] Bin-code fallback also constrained to the assigned bin now —
// letting a code for a DIFFERENT dumpster count as valid would let a
// collector bypass the claim-time lock entirely (dispose wherever, just
// type in any bin's code), defeating the point of locking one bin in per
// job. Same SRS-4.4 "no distance check once a valid code is given" idea,
// just scoped to "valid code for THIS job's bin" instead of "valid code
// for any bin in the system."
async function findAssignedDumpsterByBinCode(binCode, assignedDumpsterId) {
    const result = await pool.query(
        'SELECT id FROM dumpsters WHERE bin_code = $1 AND id = $2',
        [binCode, assignedDumpsterId]
    );
    return result.rows[0] || null;
}

// Returns { isVerified, verificationMethod, dumpsterId }
async function verifyDisposal({ exifLatitude, exifLongitude, binCode, assignedDumpsterId }) {
    // [DEV-BYPASS] When AUTO_VERIFY_GPS_PROOF is enabled (default true unless
    // explicitly set to 'false' in .env), skip the real geofence/bin-code
    // check entirely — for local testing without seeded dumpster data.
    // MUST be disabled before any real deployment.
    if (config.autoVerifyGpsProof) {
        return { isVerified: true, verificationMethod: 'gps', dumpsterId: assignedDumpsterId ?? null };
    }

    if (!assignedDumpsterId) {
        // No dumpster was ever locked in for this request (e.g. none existed
        // anywhere in the system at claim time) — nothing to verify against.
        return { isVerified: false, verificationMethod: binCode ? 'bin_code' : 'gps', dumpsterId: null };
    }

    if (binCode) {
        const dumpster = await findAssignedDumpsterByBinCode(binCode, assignedDumpsterId);
        if (dumpster) {
            return { isVerified: true, verificationMethod: 'bin_code', dumpsterId: dumpster.id };
        }
        return { isVerified: false, verificationMethod: 'bin_code', dumpsterId: null };
    }

    if (exifLatitude == null || exifLongitude == null) {
        return { isVerified: false, verificationMethod: 'gps', dumpsterId: null };
    }

    const dumpster = await isWithinGeofenceOfDumpster(exifLatitude, exifLongitude, assignedDumpsterId);
    if (dumpster) {
        return { isVerified: true, verificationMethod: 'gps', dumpsterId: dumpster.id };
    }
    return { isVerified: false, verificationMethod: 'gps', dumpsterId: null };
}

module.exports = { verifyDisposal, GEOFENCE_RADIUS_METERS };
