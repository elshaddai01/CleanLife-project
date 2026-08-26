const { pool, withTenant } = require('../db/pool');
const { sendPushNotification } = require('../utils/pushService');

const TIER_RANK = { Premium: 1, Gold: 2, Silver: 3 };

async function notifyCollectorsForJob({ requestId, companyId, stageRank, corporate }) {
    try {
        const collectors = await withTenant(corporate ? companyId : null, async (client) => {
            const result = corporate
                ? await client.query(
                    `SELECT id, push_token
                     FROM collectors
                     WHERE collector_type = 'corporate'
                       AND company_id = $1
                       AND push_token IS NOT NULL`,
                    [companyId]
                )
                : await client.query(
                    `SELECT id, push_token
                     FROM collectors
                     WHERE collector_type = 'independent'
                       AND push_token IS NOT NULL
                       AND CASE subscription_tier
                           WHEN 'Premium' THEN 1
                           WHEN 'Gold' THEN 2
                           WHEN 'Silver' THEN 3
                           ELSE 3
                       END <= $1`,
                    [stageRank]
                );
            return result.rows;
        });

        const results = await Promise.allSettled(collectors.map((collector) => sendPushNotification(
            collector.push_token,
            'New pickup job available',
            'A pickup job matching your subscription is now available.',
            { pickup_request_id: requestId }
        )));
        const sent = results.filter((result) => result.status === 'fulfilled' && result.value.sent).length;
        console.log(`[notifications] request ${requestId}: ${sent}/${collectors.length} job notifications accepted by Expo`);
    } catch (error) {
        console.error(`[notifications] job notification failed for request ${requestId}:`, error.message);
    }
}

module.exports = { notifyCollectorsForJob, TIER_RANK };