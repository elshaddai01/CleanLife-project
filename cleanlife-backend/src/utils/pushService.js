// [NOTIF-02] Sends a real push notification via Expo's push API. Silently
// no-ops (logs, doesn't throw) if the recipient has no token registered —
// a missing token should never break the calling route's main action
// (e.g. claiming a job must still succeed even if the push fails).
async function sendPushNotification(pushToken, title, body, data = {}) {
    if (!pushToken || !pushToken.startsWith('ExponentPushToken')) {
        return { sent: false, reason: 'no valid push token' };
    }

    try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Accept-Encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                to: pushToken,
                title,
                body,
                data,
                sound: 'default',
            }),
        });
        const result = await response.json();
        if (result.data?.status === 'error') {
            console.error('Push notification error:', result.data.message);
            return { sent: false, reason: result.data.message };
        }
        return { sent: true };
    } catch (err) {
        console.error('Push notification send failed:', err.message);
        return { sent: false, reason: err.message };
    }
}

module.exports = { sendPushNotification };