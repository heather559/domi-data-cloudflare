/**
 * Minimal Slack notifier.
 *
 * CHOICE: Incoming Webhook, not the chat.postMessage Web API. Reasoning:
 *   - A webhook URL is a single opaque secret (SLACK_WEBHOOK_URL) that posts
 *     to one pre-configured channel -- no bot token, no OAuth scopes, no
 *     channel-ID lookup, and nothing else to configure in the Slack app
 *     beyond turning "Incoming Webhooks" on and adding one to a channel.
 *   - chat.postMessage requires a bot token PLUS knowing/resolving the
 *     target channel ID, and the bot must be invited to that channel --
 *     more moving parts for a single fire-and-forget notification with no
 *     need to read responses, react, or post to varying channels.
 *   - Both are "just a fetch call" as required, but the webhook is strictly
 *     less to wire up for this one-way, one-channel use case.
 *
 * ENV VAR: SLACK_WEBHOOK_URL (a full https://hooks.slack.com/services/... URL).
 * This needs to be created in Slack (Apps -> Incoming Webhooks -> Add New
 * Webhook to Workspace, pick the channel) and set on the Railway service --
 * flagged in the final report so it can be created before deploy.
 */

export interface SlackNotifyResult {
  ok: boolean;
  status?: number;
  error?: string;
}

export async function sendSlackMessage(text: string): Promise<SlackNotifyResult> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    return { ok: false, error: 'SLACK_WEBHOOK_URL is not set' };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return { ok: false, status: response.status, error: body || response.statusText };
    }

    return { ok: true, status: response.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
