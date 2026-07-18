import { config } from '../config/env';
import { BreakoutEvent } from '../types';

export class DeepSeekClient {
  public static async analyzeEvent(symbol: string, event: BreakoutEvent): Promise<string> {
    if (!config.deepseekApiKey) {
      console.warn('DEEPSEEK_API_KEY missing. Skipping AI analysis.');
      return 'AI analysis skipped due to missing API key.';
    }

    const systemPrompt =
      'You are a professional Smart Money Concepts (SMC) market structure analyst.\n' +
      'You write structured, factual briefings for traders who make their own decisions.\n\n' +
      'STRICT RULES — you must follow these without exception:\n' +
      '- You NEVER recommend buying, selling, going long, or going short.\n' +
      '- You NEVER provide entry prices, stop-loss levels, or take-profit targets.\n' +
      '- You NEVER predict future price direction.\n' +
      '- You NEVER suggest position sizes or risk percentages.\n' +
      '- You ONLY describe and explain what has already happened in the market structure.\n\n' +
      'Your response MUST follow this exact 5-section structure:\n' +
      '**WHAT HAPPENED**\n(1-2 sentences describing the confirmed event)\n\n' +
      '**WHY IT MATTERS**\n(1-2 sentences on the structural significance of this event)\n\n' +
      '**MARKET CONTEXT**\n(1-2 sentences describing the market state before and after this event)\n\n' +
      '**STRUCTURAL CONFLUENCE**\n(1-2 sentences noting whether this is a continuation or a reversal of the prior trend)\n\n' +
      '**WHAT TO WATCH NEXT**\n(1-2 sentences on what structural levels or events traders should observe — informational only)\n\n' +
      'End every response with exactly this line:\n' +
      '"The final trading decision belongs entirely to the user."';

    const timeframeLabel = config.timeframe === 900 ? '15 Minutes' :
      config.timeframe === 300 ? '5 Minutes' :
      config.timeframe === 60 ? '1 Minute' :
      `${config.timeframe}s`;

    const structureStatus = event.trendBefore === event.trendAfter ? 'Continuation' : 'Reversal';

    const userPrompt =
      `A confirmed ${event.direction} ${event.event} has been detected. Produce a structured market briefing.\n\n` +
      `Symbol:                 ${symbol}\n` +
      `Timeframe:              ${timeframeLabel}\n` +
      `Event Type:             ${event.event}\n` +
      `Structure Status:       ${structureStatus} (${event.trendBefore} → ${event.trendAfter})\n` +
      `Price at Signal:        ${event.price}\n` +
      `Broken Pivot Level:     ${event.pivotLevel}\n` +
      `Previous Swing Price:   ${event.previousSwingPrice}\n` +
      `Distance from Pivot:    ${event.distanceFromPivot.toFixed(2)} points\n\n` +
      'Produce the 5-section briefing now. Follow the format exactly.';

    const requestBody = {
      model: 'deepseek-chat',
      temperature: 0.3,
      max_tokens: 500,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    };

    try {
      console.log(`[${symbol}] Requesting DeepSeek analysis for ${event.event}...`);
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.deepseekApiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status} - ${errText}`);
      }

      const json = await response.json();
      if (json.choices && json.choices.length > 0) {
        return json.choices[0].message.content.trim();
      }
      
      return 'AI returned empty response.';
    } catch (error: any) {
      console.error(`[${symbol}] DeepSeek API Error:`, error.message);
      return `⚠️ AI analysis failed: ${error.message}`;
    }
  }
}
