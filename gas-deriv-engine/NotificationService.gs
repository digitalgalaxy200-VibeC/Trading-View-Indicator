// ============================================================
// NotificationService.gs — Email Dispatcher
// AI Trend Assistant — Deriv Engine
// ============================================================

/**
 * Handles sending email notifications when an event is detected.
 */
class NotificationService {

  static sendAlert(event, aiAnalysis) {
    if (!CONFIG.NOTIFICATION_EMAIL) {
      console.warn("No NOTIFICATION_EMAIL configured in Config.gs. Skipping email.");
      return;
    }

    const eventTime = new Date(event.epoch * 1000).toUTCString();
    
    const subject = `[Deriv Alert] ${event.direction} ${event.event} on ${CONFIG.SYMBOL}`;
    
    const htmlBody = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
        <h2 style="color: ${event.direction === 'BULLISH' ? '#089981' : '#F23645'};">
          ${event.direction} ${event.event} Detected
        </h2>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px 0; font-weight: bold; width: 30%;">Symbol:</td>
            <td style="padding: 8px 0;">${CONFIG.SYMBOL}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px 0; font-weight: bold;">Timeframe:</td>
            <td style="padding: 8px 0;">${CONFIG.TIMEFRAME}s</td>
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
          Sent by AI Trend Assistant (Deriv Engine)<br>
          <a href="https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/edit" style="color: #0066cc;">Open Trading Journal</a>
        </p>
      </div>
    `;

    try {
      MailApp.sendEmail({
        to: CONFIG.NOTIFICATION_EMAIL,
        subject: subject,
        htmlBody: htmlBody
      });
      console.log(`Alert email sent for ${event.event}.`);
    } catch (e) {
      console.error(`Failed to send email: ${e.message}`);
    }
  }
}
