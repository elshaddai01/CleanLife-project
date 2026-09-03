const { pool } = require('../db/pool');
const config = require('../config/env');

// [BIN-14] Flags any dumpster that's been 'full' for 48+ hours as escalated.
// PLACEHOLDER — no actual city/HYSACAM notification integration exists yet;
// this only sets escalated_at so it's queryable/auditable. Wiring a real
// notification (email, webhook, whatever HYSACAM's actual intake process
// turns out to be) is future work, not part of this feature set.
async function handleBinEscalation() {
    try {
        const result = await pool.query('SELECT * FROM escalate_stale_full_bins()');
        for (const row of result.rows) {
            console.log(`[bin-escalation] dumpster ${row.id} has been full for 48h+, flagged as escalated (PLACEHOLDER — no real notification sent)`);
        }
    } catch (err) {
        console.error('[bin-escalation] check failed:', err.message);
    }
}

// Same shape as dispatchWorker.js's startDispatchWorker: running-guard,
// unref'd interval timer, immediate first tick, closable.
function startBinEscalationWorker() {
    let running = false;
    const tick = async () => {
        if (running) return;
        running = true;
        try {
            await handleBinEscalation();
        } finally {
            running = false;
        }
    };

    const timer = setInterval(tick, config.binEscalationPollMs);
    timer.unref();
    void tick();
    return { close: () => clearInterval(timer) };
}

module.exports = { startBinEscalationWorker };
