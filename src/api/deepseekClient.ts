import { config } from '../config/env';
import { AlertWithDetails } from '../types';
import { getTradingViewUrl } from '../utils/tradingViewUrl';

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

export class DeepSeekClient {
  static async analyzeEvent(symbol: string, event: any): Promise<string> {
    // Kept for backward compat
    const alerts: AlertWithDetails[] = [{
      ticker: symbol,
      event_type: event.event.includes('CHOCH') ? 'CHOCH' : 'BOS',
      direction: event.direction,
      price: event.price,
      trend_before: event.trendBefore,
      trend_after: event.trendAfter,
      pivot_level: event.pivotLevel,
      candle_epoch: event.candleEpoch,
    } as AlertWithDetails];
    return DeepSeekClient.summarizeBatch(alerts);
  }

  static async summarizeBatch(alerts: AlertWithDetails[]): Promise<string> {
    const alertList = alerts.map(a =>
      `Market: ${a.ticker}\n` +
      `Chart Link: ${getTradingViewUrl(a.ticker)}\n` +
      `Event: ${a.direction === 'BULLISH' ? 'Bullish' : 'Bearish'} ${a.event_type}\n` +
      `Breakout Price: ${a.price}\n` +
      `Prior Pivot Level Broken: ${a.pivot_level}\n` +
      `Trend Flow: ${a.trend_before} → ${a.trend_after}`
    ).join('\n\n');

    const userPrompt =
      `Analyze the following confirmed structural breakouts on the 15-minute timeframe. Give me a deep technical breakdown:\n\n${alertList}`;

    const body = {
      model: config.deepseekModel,
      temperature: config.deepseekTemperature,
      max_tokens: config.deepseekMaxTokens,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    };

    const response = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.deepseekApiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => '');
      console.error(`DeepSeek API error (${response.status}): ${err.substring(0, 200)}`);
      return '⚠️ AI summary unavailable — please review charts manually.';
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content?.trim();
    return content || '⚠️ AI returned no content.';
  }
}
