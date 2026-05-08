const axios = require('axios');

async function sendWebhook(url, platform, data) {
    if (!url) return;

    let payload = {};
    const platformLower = platform ? platform.toLowerCase() : 'slack'; // Default to slack style if unknown?

    try {
        if (platformLower.includes('slack')) {
            // Slack format
            payload = {
                text: data.text || data.message || `Title: ${data.title}\nDescription: ${data.description}`
            };
        } else if (platformLower.includes('discord')) {
            // Discord format
            payload = {
                content: data.text || data.message || `**${data.title}**\n${data.description}`
            };
        } else if (platformLower.includes('teams')) {
            // MS Teams Connector (Classic) format
            // Simple card
            payload = {
                "@type": "MessageCard",
                "@context": "http://schema.org/extensions",
                "themeColor": "0076D7",
                "summary": data.title,
                "sections": [{
                    "activityTitle": data.title,
                    "activitySubtitle": data.subtitle || "Taskboard Notification",
                    "markdown": true,
                    "text": data.description || data.text
                }]
            };
        } else {
            // Generic Fallback
            payload = {
                text: data.text || data.message,
                ...data
            };
        }

        await axios.post(url, payload);
        console.log(`Webhook sent to ${platform} (${url})`);
        return true;
    } catch (error) {
        console.error(`Failed to send webhook to ${platform}:`, error.message);
        return false;
    }
}

module.exports = { sendWebhook };
