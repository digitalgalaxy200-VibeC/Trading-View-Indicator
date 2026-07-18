"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeepSeekClient = void 0;
const env_1 = require("../config/env");
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const SYSTEM_PROMPT = `You are a professional Smart Money Concepts (SMC) market structure analyst.
You summarise multiple market events concisely for a trader who is at work and will manually review charts.

CRITICAL RULES:
- NEVER recommend buying, selling, or trading.
- NEVER give entry points, stop losses, or take profits.
- NEVER predict future price movements.
- Keep your summary under 200 words.
- End with: "The final trading decision belongs entirely to the user."`;
class DeepSeekClient {
    static async analyzeEvent(symbol, event) {
        // Kept for backward compat — single-event analysis is no longer the primary path
        const alerts = [{
                ticker: symbol,
                event_type: event.event.includes('CHOCH') ? 'CHOCH' : 'BOS',
                direction: event.direction,
                price: event.price,
                trend_before: event.trendBefore,
                trend_after: event.trendAfter,
                pivot_level: event.pivotLevel,
                candle_epoch: event.candleEpoch,
            }];
        return DeepSeekClient.summarizeBatch(alerts);
    }
    static async summarizeBatch(alerts) {
        const alertList = alerts.map(a => `${a.ticker} — ${a.direction === 'BULLISH' ? 'Bullish' : 'Bearish'} ${a.event_type} at ${a.price}\n` +
            `  Trend: ${a.trend_before} → ${a.trend_after}`).join('\n\n');
        const userPrompt = `The following market structure events were confirmed in the last batch window:\n\n${alertList}\n\n` +
            `Provide a concise market summary for a trader who will manually review the charts.`;
        const body = {
            model: env_1.config.deepseekModel,
            temperature: env_1.config.deepseekTemperature,
            max_tokens: env_1.config.deepseekMaxTokens,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userPrompt },
            ],
        };
        const response = await fetch(DEEPSEEK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${env_1.config.deepseekApiKey}`,
            },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const err = await response.text().catch(() => '');
            console.error(`DeepSeek API error (${response.status}): ${err.substring(0, 200)}`);
            return '⚠️ AI summary unavailable — please review charts manually.';
        }
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        return content || '⚠️ AI returned no content.';
    }
}
exports.DeepSeekClient = DeepSeekClient;
