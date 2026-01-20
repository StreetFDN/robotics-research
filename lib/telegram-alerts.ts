/**
 * Telegram Alerts Client
 *
 * Sends alerts to Telegram for:
 * - Score changes ±5% in 24h
 * - New government contracts >$10M
 * - Major funding rounds
 * - SDK releases from tracked orgs
 * - Sentiment shifts
 *
 * Environment variables:
 * - TELEGRAM_BOT_TOKEN: Bot token from @BotFather
 * - TELEGRAM_CHAT_ID: Chat ID to send messages to
 */

import { computeNarrativeIndex, interpretScore, getLatestScore, NarrativeScore } from './narrative-index';

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

interface TelegramAlert {
  type: 'score_change' | 'signal' | 'daily_briefing' | 'contract' | 'funding' | 'release';
  title: string;
  body: string;
  score?: number;
  confidence?: number;
}

/**
 * Check if Telegram is configured
 */
export function isTelegramConfigured(): boolean {
  return !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

/**
 * Send a message to Telegram
 */
export async function sendTelegramMessage(text: string, parseMode: 'HTML' | 'Markdown' = 'HTML'): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log('[Telegram] Not configured, skipping message');
    return false;
  }

  try {
    const response = await fetch(`${TELEGRAM_API_BASE}${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Telegram] Failed to send message:', error);
      return false;
    }

    console.log('[Telegram] Message sent successfully');
    return true;
  } catch (error) {
    console.error('[Telegram] Error sending message:', error);
    return false;
  }
}

/**
 * Send a structured alert
 */
export async function sendAlert(alert: TelegramAlert): Promise<boolean> {
  const emoji = getAlertEmoji(alert.type);

  let message = `${emoji} <b>${escapeHtml(alert.title)}</b>\n\n`;
  message += escapeHtml(alert.body);

  if (alert.score !== undefined) {
    const interpretation = interpretScore(alert.score);
    message += `\n\n📊 <b>Narrative Index:</b> ${alert.score}% ${interpretation.emoji} ${interpretation.label}`;
  }

  if (alert.confidence !== undefined) {
    message += `\n🎯 <b>Confidence:</b> ${Math.round(alert.confidence * 100)}%`;
  }

  return sendTelegramMessage(message);
}

/**
 * Send daily briefing with full quant formula breakdown
 */
export async function sendDailyBriefing(): Promise<boolean> {
  try {
    const score = await computeNarrativeIndex();
    const interpretation = interpretScore(score.overall);

    // Get previous day's score for comparison
    const previousScore = await getLatestScore();
    const change = previousScore ? score.overall - previousScore.overall : 0;
    const changeStr = change > 0 ? `▲ +${change.toFixed(1)}` : change < 0 ? `▼ ${change.toFixed(1)}` : '━ 0';

    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    let message = `📊 <b>ROBOTICS NARRATIVE INDEX</b>\n`;
    message += `${today}\n\n`;

    // Main score
    message += `<b>${score.overall}</b> ${interpretation.emoji} ${interpretation.label}\n`;
    message += `${changeStr} vs yesterday\n\n`;

    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Component breakdown with weights
    message += `<b>COMPONENT SCORES</b>\n\n`;

    message += `📈 <b>Index Alpha:</b> ${score.components.indexAlpha} (30%)\n`;
    message += `   Multi-timeframe α vs MSCI World\n\n`;

    message += `🔮 <b>Polymarket:</b> ${score.components.polymarket} (15%)\n`;
    message += `   Raw prediction market probability\n\n`;

    message += `🏛️ <b>Gov Contracts:</b> ${score.components.contracts} (15%)\n`;
    message += `   ln($volume) + count + sticky\n\n`;

    message += `👨‍💻 <b>GitHub:</b> ${score.components.github} (10%)\n`;
    message += `   ln(commits) + trend + breadth\n\n`;

    message += `📰 <b>News:</b> ${score.components.news} (10%)\n`;
    message += `   Sentiment analysis (est.)\n\n`;

    message += `💰 <b>Funding:</b> ${score.components.funding} (10%)\n`;
    message += `   ln($vol) + rounds + recency\n\n`;

    message += `🔧 <b>Technical:</b> ${score.components.technical} (10%)\n`;
    message += `   ln(releases) + major + breadth\n\n`;

    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Formula
    message += `<b>FORMULA</b>\n`;
    message += `RNI = Σ(component × weight)\n`;
    message += `    = ${score.components.indexAlpha}×0.30 + ${score.components.polymarket}×0.15\n`;
    message += `    + ${score.components.contracts}×0.15 + ${score.components.github}×0.10\n`;
    message += `    + ${score.components.news}×0.10 + ${score.components.funding}×0.10\n`;
    message += `    + ${score.components.technical}×0.10\n`;
    message += `    = <b>${score.overall}</b>\n\n`;

    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Top signals
    if (score.signals.length > 0) {
      message += `<b>KEY SIGNALS</b>\n`;
      for (let i = 0; i < Math.min(5, score.signals.length); i++) {
        const signal = score.signals[i];
        const typeEmoji = getSignalTypeEmoji(signal.type);
        message += `${typeEmoji} ${signal.title}\n`;
      }
      message += `\n`;
    }

    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `${interpretation.action}\n`;
    message += `Confidence: ${Math.round(score.confidence * 100)}%`;

    return sendTelegramMessage(message);
  } catch (error) {
    console.error('[Telegram] Error sending daily briefing:', error);
    return false;
  }
}

/**
 * Check for significant changes and alert
 */
export async function checkAndAlertSignificantChanges(): Promise<void> {
  try {
    const currentScore = await computeNarrativeIndex();
    const previousScore = await getLatestScore();

    if (!previousScore) {
      console.log('[Telegram] No previous score, skipping change check');
      return;
    }

    const change = currentScore.overall - previousScore.overall;

    // Alert on ±5% change
    if (Math.abs(change) >= 5) {
      const direction = change > 0 ? 'increased' : 'decreased';
      const emoji = change > 0 ? '📈' : '📉';

      await sendAlert({
        type: 'score_change',
        title: `Narrative Index ${direction} by ${Math.abs(change).toFixed(1)}%`,
        body: `The Robotics Narrative Index has ${direction} from ${previousScore.overall}% to ${currentScore.overall}% in the last check.\n\nTop driver: ${currentScore.signals[0]?.title || 'Multiple factors'}`,
        score: currentScore.overall,
        confidence: currentScore.confidence,
      });
    }

    // Alert on major signals
    for (const signal of currentScore.signals) {
      if (signal.impact >= 3) {
        await sendAlert({
          type: signal.type as TelegramAlert['type'],
          title: signal.title,
          body: signal.description,
          score: currentScore.overall,
        });
      }
    }
  } catch (error) {
    console.error('[Telegram] Error checking for significant changes:', error);
  }
}

/**
 * Send a contract alert
 */
export async function sendContractAlert(
  recipientName: string,
  amount: number,
  description: string
): Promise<boolean> {
  return sendAlert({
    type: 'contract',
    title: `New Contract: $${formatAmount(amount)}`,
    body: `${recipientName}\n\n${description.slice(0, 200)}`,
  });
}

/**
 * Send a funding alert
 */
export async function sendFundingAlert(
  companyName: string,
  amount: number,
  round: string
): Promise<boolean> {
  return sendAlert({
    type: 'funding',
    title: `${companyName} Raises $${formatAmount(amount)}`,
    body: `${round} funding round announced for ${companyName}.`,
  });
}

/**
 * Send a release alert
 */
export async function sendReleaseAlert(
  org: string,
  repo: string,
  version: string,
  notes: string
): Promise<boolean> {
  return sendAlert({
    type: 'release',
    title: `New Release: ${org}/${repo} ${version}`,
    body: notes.slice(0, 300),
  });
}

// Helper functions

function getAlertEmoji(type: TelegramAlert['type']): string {
  switch (type) {
    case 'score_change': return '📊';
    case 'signal': return '🔔';
    case 'daily_briefing': return '📰';
    case 'contract': return '🏛️';
    case 'funding': return '💰';
    case 'release': return '🚀';
    default: return '📌';
  }
}

function getSignalTypeEmoji(type: string): string {
  switch (type) {
    case 'github': return '📈';
    case 'contract': return '🏛️';
    case 'news': return '📰';
    case 'funding': return '💰';
    case 'technical': return '🔧';
    default: return '📌';
  }
}

function getTrendArrow(value: number, threshold: number): string {
  if (value >= threshold + 10) return '▲';
  if (value <= threshold - 10) return '▼';
  return '━';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatAmount(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(1)}B`;
  } else if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(0)}M`;
  } else if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(0)}K`;
  }
  return amount.toString();
}
