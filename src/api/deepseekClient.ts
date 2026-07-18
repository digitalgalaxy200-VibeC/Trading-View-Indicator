import { config } from '../config/env';
import { BreakoutEvent } from '../types';

export class DeepSeekClient {
  public static async analyzeEvent(event: BreakoutEvent): Promise<string> {
    if (!config.deepseekApiKey) {
      console.warn('DEEPSEEK_API_KEY missing. Skipping AI analysis.');
      return 'AI analysis skipped due to missing API key.';
    }

    const systemPrompt = 
      'You are a professional Smart Money Concepts (SMC) market structure analyst.\n' +
      'You explain market structure events clearly and factually.\n' +
      'You NEVER recommend buying or selling.\n' +
      'You NEVER give trading signals or entry points.\n' +
      'You NEVER predict future price direction.\n' +
      'You ONLY explain what the detected market structure event means.\n' +
      'Keep your response under 150 words.\n' +
      'Always end your response with exactly this sentence: ' +
      '"The final trading decision belongs entirely to the user."';

    const userPrompt = 
      `A ${event.direction} ${event.event} has been detected.\n\n` +
      `Symbol:           ${config.symbol}\n` +
      `Timeframe:        ${config.timeframe} seconds\n` +
      `Price at signal:  ${event.price}\n` +
      `Trend before:     ${event.trendBefore}\n` +
      `Trend after:      ${event.trendAfter}\n` +
      `Broken Pivot:     ${event.pivotLevel}\n\n` +
      'Please explain what this market structure event means. ' +
      'The trader will manually review the chart before making any decision.';

    const requestBody = {
      model: 'deepseek-chat',
      temperature: 0.3,
      max_tokens: 300,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    };

    try {
      console.log(`Requesting DeepSeek analysis for ${event.event}...`);
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
      console.error('DeepSeek API Error:', error.message);
      return `⚠️ AI analysis failed: ${error.message}`;
    }
  }
}
