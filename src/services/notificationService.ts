import { Resend } from 'resend';
import { config } from '../config/env';
import { BreakoutEvent } from '../types';

export class NotificationService {
  private static resend = new Resend(config.resendApiKey);

  public static async sendAlert(symbol: string, event: BreakoutEvent, aiAnalysis: string) {
    if (!config.resendApiKey || !config.emailFrom || !config.emailTo) {
      console.warn('Email configuration missing. Skipping email notification.');
      return;
    }

    const eventTime = new Date(event.epoch * 1000).toUTCString();
    const subject = `[Deriv Engine] ${event.direction} ${event.event} on ${symbol}`;
    
    const htmlBody = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
        <h2 style="color: ${event.direction === 'BULLISH' ? '#089981' : '#F23645'};">
          ${event.direction} ${event.event} Detected
        </h2>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px 0; font-weight: bold; width: 30%;">Symbol:</td>
            <td style="padding: 8px 0;">${symbol}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px 0; font-weight: bold;">Timeframe:</td>
            <td style="padding: 8px 0;">${config.timeframe}s</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px 0; font-weight: bold;">Price at Signal:</td>
            <td style="padding: 8px 0;">${event.price}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px 0; font-weight: bold;">Time (UTC):</td>
            <td style="padding: 8px 0;">${eventTime}</td>
          </tr>
        </table>
        
        <h3 style="color: #333; margin-bottom: 10px;">Market Context (AI Summary)</h3>
        <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #333; font-size: 14px; line-height: 1.5; white-space: pre-wrap;">
          ${aiAnalysis}
        </div>
        
        <p style="font-size: 12px; color: #888; margin-top: 30px; text-align: center;">
          Sent by Standalone Node.js Market Structure Engine
        </p>
      </div>
    `;

    try {
      console.log('Sending email via Resend...');
      const { data, error } = await this.resend.emails.send({
        from: config.emailFrom,
        to: [config.emailTo],
        subject: subject,
        html: htmlBody
      });

      if (error) {
        throw new Error(error.message);
      }

      console.log(`Alert email sent successfully. ID: ${data?.id}`);
    } catch (e: any) {
      console.error(`Failed to send email: ${e.message}`);
    }
  }
}
