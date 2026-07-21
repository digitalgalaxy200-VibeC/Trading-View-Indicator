"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeepSeekClient = void 0;
exports.generateSetupCommentary = generateSetupCommentary;
const env_1 = require("../config/env");
const tradingViewUrl_1 = require("../utils/tradingViewUrl");
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const SYSTEM_PROMPT = `You are an elite, veteran Smart Money Concepts (SMC) technical analyst with 5 decades of experience.
You are reviewing live algorithmic detections on a strict 15-Minute timeframe.

CRITICAL RULES:
1. NEVER define basic concepts like what a Break of Structure (BOS) is. The user is a professional.
2. Analyze the specific numbers provided (breakout price, pivot level). Speak to momentum, displacement, and structural continuation.
3. Be highly detailed and deeply analytical.
4. Explicitly mention that this confirmation occurred on the "15-Minute Timeframe".
5. ALWAYS include the provided TradingView chart links in your response so the user can click them.
6. NEVER recommend buying, selling, or entry points.
7. Keep the summary under 250 words.
8. End with: "The final trading decision belongs entirely to the user."`;
class DeepSeekClient {
    static async analyzeEvent(symbol, event) {
        // Kept for backward compat
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
        const alertList = alerts.map(a => `Market: ${a.ticker}\n` +
            `Chart Link: ${(0, tradingViewUrl_1.getTradingViewUrl)(a.ticker)}\n` +
            `Event: ${a.direction === 'BULLISH' ? 'Bullish' : 'Bearish'} ${a.event_type}\n` +
            `Breakout Price: ${a.price}\n` +
            `Prior Pivot Level Broken: ${a.pivot_level}\n` +
            `Trend Flow: ${a.trend_before} → ${a.trend_after}`).join('\n\n');
        const userPrompt = `Analyze the following confirmed structural breakouts on the 15-minute timeframe. Give me a deep technical breakdown:\n\n${alertList}`;
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
    static async scoreOpportunity(opp) {
        const typeLabel = opp.workflow_type === 'reversal' ? 'Trend Reversal' : 'Trend Continuation';
        const entry = opp.entry_price?.toFixed(2) || 'N/A';
        const sl = opp.stop_loss?.toFixed(2) || 'N/A';
        const tp = opp.take_profit?.toFixed(2) || 'N/A';
        const rr = opp.risk_reward || 'N/A';
        const userPrompt = [
            `Score this trading opportunity on the 15-minute timeframe:`,
            `Direction: ${opp.direction}`,
            `Type: ${typeLabel}`,
            `Entry (50% Fib): ${entry}`,
            `Stop Loss (0% Fib): ${sl}`,
            `Take Profit (100% Fib): ${tp}`,
            `Risk-to-Reward: 1:${rr}`,
            '',
            `Provide a score breakdown using this exact table format:`,
            `| Factor | Score |`,
            `|--------|-------|`,
            `| External Structure | X/20 |`,
            `| CHOCH / Trend Valid | X/15 |`,
            `| BOS Confirmation | X/20 |`,
            `| Fibonacci Retracement | X/25 |`,
            `| Market Quality | X/10 |`,
            `| Timeframe Integrity | X/10 |`,
            `| **Total** | **X/100** |`,
            '',
            `After the table, explain any deductions in 1-2 sentences.`,
            `End with: "The final trading decision belongs entirely to the user."`,
        ].join('\n');
        const body = {
            model: env_1.config.deepseekModel,
            temperature: 0.2,
            max_tokens: 500,
            messages: [
                { role: 'system', content: 'You are a professional SMC trade analyst. Score opportunities objectively. NEVER recommend buying or selling.' },
                { role: 'user', content: userPrompt },
            ],
        };
        try {
            const response = await fetch(DEEPSEEK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env_1.config.deepseekApiKey}` },
                body: JSON.stringify(body),
            });
            if (!response.ok)
                return 'Score unavailable.';
            const data = await response.json();
            return data.choices?.[0]?.message?.content?.trim() || 'Score unavailable.';
        }
        catch {
            return 'Score unavailable.';
        }
    }
}
exports.DeepSeekClient = DeepSeekClient;
// ── Commentary-only call — one sentence, no prices, no recommendations ──────
const COMMENTARY_SYSTEM_PROMPT = `
You add ONE short sentence of context to a trading alert. Rules:
- Output exactly one sentence, plain text, no markdown, no lists.
- Never state or restate any price, time, or the symbol name.
- Never say "buy", "sell", "enter", "take this trade", or give a recommendation of any kind.
- Only comment on: candle/displacement strength relative to recent bars, how many continuation legs deep this run is, or recent volatility.
- If you are not confident you have enough information to say something useful, output exactly: NO_COMMENT
`.trim();
async function generateSetupCommentary(event, fib, recentCandles, chainCount) {
    try {
        const userPrompt = JSON.stringify({
            direction: event.direction,
            chainCount,
            recentCandleRanges: recentCandles.slice(-10).map(c => +(c.high - c.low).toFixed(5)),
        });
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${env_1.config.deepseekApiKey}`,
            },
            body: JSON.stringify({
                model: env_1.config.deepseekModel,
                temperature: 0.3,
                max_tokens: 80,
                messages: [
                    { role: 'system', content: COMMENTARY_SYSTEM_PROMPT },
                    { role: 'user', content: userPrompt },
                ],
            }),
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok)
            return null;
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content?.trim();
        if (!text || text === 'NO_COMMENT')
            return null;
        return text;
    }
    catch {
        // timeout, network error, or any failure — never block the alert
        return null;
    }
}
