"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const resend_1 = require("resend");
const env_1 = require("../config/env");
class NotificationService {
    static resend = new resend_1.Resend(env_1.config.resendApiKey);
    static async sendAlert(symbol, event, aiAnalysis) {
        if (!env_1.config.resendApiKey || !env_1.config.emailFrom || !env_1.config.emailTo) {
            console.warn(`[${symbol}] Email configuration missing. Skipping notification.`);
            return;
        }
        const isBullish = event.direction === 'BULLISH';
        const isCHoCH = event.event.includes('CHoCH');
        const structureStatus = event.trendBefore === event.trendAfter ? 'Continuation' : 'Reversal';
        const accentColor = isBullish ? '#089981' : '#F23645';
        const badgeColor = isCHoCH ? '#f59e0b' : (isBullish ? '#089981' : '#F23645');
        const directionArrow = isBullish ? '▲' : '▼';
        const timeframeLabel = env_1.config.timeframe === 900 ? '15 Minutes' :
            env_1.config.timeframe === 300 ? '5 Minutes' :
                env_1.config.timeframe === 60 ? '1 Minute' :
                    `${env_1.config.timeframe}s`;
        const signalTime = new Date(event.epoch * 1000).toUTCString();
        // TradingView deep link — opens the symbol on Deriv's TradingView chart
        const tvUrl = `https://www.tradingview.com/chart/?symbol=DERIV:${symbol}`;
        // Format AI sections into nice HTML blocks
        const formattedAI = aiAnalysis
            .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#1a1a2e;display:block;margin-top:14px;margin-bottom:4px;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;">$1</strong>')
            .replace(/\n/g, '<br>');
        const subject = `${isBullish ? '🟢' : '🔴'} [${symbol}] ${event.event} Detected — ${timeframeLabel}`;
        const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

        <!-- HEADER -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);padding:28px 32px;text-align:center;">
            <p style="margin:0 0 6px 0;font-size:11px;color:#8899bb;letter-spacing:0.15em;text-transform:uppercase;">Market Structure Intelligence</p>
            <h1 style="margin:0;font-size:22px;color:#ffffff;font-weight:700;letter-spacing:-0.01em;">Market Structure Alert</h1>
            <p style="margin:8px 0 0 0;font-size:13px;color:#8899bb;">${signalTime}</p>
          </td>
        </tr>

        <!-- EVENT BADGE -->
        <tr>
          <td style="padding:0 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:${badgeColor};border-radius:0 0 10px 10px;text-align:center;padding:12px 20px;">
                  <span style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:0.02em;">
                    ${directionArrow} ${event.event}
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- INSTRUMENT SUMMARY TABLE -->
        <tr>
          <td style="padding:28px 32px 0 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8eaf0;border-radius:10px;overflow:hidden;">
              <tr style="background:#f8f9fc;">
                <td style="padding:12px 16px;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #e8eaf0;width:45%;">Field</td>
                <td style="padding:12px 16px;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #e8eaf0;">Value</td>
              </tr>
              <tr style="border-bottom:1px solid #f0f1f5;">
                <td style="padding:12px 16px;font-size:13px;color:#374151;font-weight:600;">Instrument</td>
                <td style="padding:12px 16px;font-size:13px;color:#1a1a2e;font-weight:700;">${symbol}</td>
              </tr>
              <tr style="border-bottom:1px solid #f0f1f5;background:#fafbfc;">
                <td style="padding:12px 16px;font-size:13px;color:#374151;font-weight:600;">Timeframe</td>
                <td style="padding:12px 16px;font-size:13px;color:#1a1a2e;">${timeframeLabel}</td>
              </tr>
              <tr style="border-bottom:1px solid #f0f1f5;">
                <td style="padding:12px 16px;font-size:13px;color:#374151;font-weight:600;">Market Direction</td>
                <td style="padding:12px 16px;font-size:13px;font-weight:700;color:${accentColor};">${event.direction}</td>
              </tr>
              <tr style="border-bottom:1px solid #f0f1f5;background:#fafbfc;">
                <td style="padding:12px 16px;font-size:13px;color:#374151;font-weight:600;">Event Type</td>
                <td style="padding:12px 16px;font-size:13px;color:#1a1a2e;">${event.event}</td>
              </tr>
              <tr style="border-bottom:1px solid #f0f1f5;">
                <td style="padding:12px 16px;font-size:13px;color:#374151;font-weight:600;">Structure Status</td>
                <td style="padding:12px 16px;font-size:13px;color:#1a1a2e;">${structureStatus}</td>
              </tr>
              <tr style="border-bottom:1px solid #f0f1f5;background:#fafbfc;">
                <td style="padding:12px 16px;font-size:13px;color:#374151;font-weight:600;">Current Price</td>
                <td style="padding:12px 16px;font-size:14px;font-weight:800;color:${accentColor};">${event.price.toFixed(2)}</td>
              </tr>
              <tr style="border-bottom:1px solid #f0f1f5;">
                <td style="padding:12px 16px;font-size:13px;color:#374151;font-weight:600;">Break Price (Pivot)</td>
                <td style="padding:12px 16px;font-size:13px;color:#1a1a2e;">${event.pivotLevel.toFixed(2)}</td>
              </tr>
              <tr style="border-bottom:1px solid #f0f1f5;background:#fafbfc;">
                <td style="padding:12px 16px;font-size:13px;color:#374151;font-weight:600;">Previous Swing</td>
                <td style="padding:12px 16px;font-size:13px;color:#1a1a2e;">${event.previousSwingPrice.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding:12px 16px;font-size:13px;color:#374151;font-weight:600;">Distance from Pivot</td>
                <td style="padding:12px 16px;font-size:13px;color:#1a1a2e;">${event.distanceFromPivot.toFixed(2)} pts</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- TRADINGVIEW BUTTON -->
        <tr>
          <td style="padding:24px 32px 0 32px;text-align:center;">
            <a href="${tvUrl}" target="_blank"
               style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 32px;border-radius:8px;letter-spacing:0.02em;box-shadow:0 4px 12px rgba(37,99,235,0.3);">
              📈 &nbsp; Open TradingView Chart
            </a>
          </td>
        </tr>

        <!-- AI BRIEFING -->
        <tr>
          <td style="padding:28px 32px 0 32px;">
            <div style="background:#f8f9fc;border-left:4px solid ${accentColor};border-radius:0 8px 8px 0;padding:20px 20px;">
              <p style="margin:0 0 12px 0;font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">🤖 AI Market Briefing</p>
              <div style="font-size:14px;color:#374151;line-height:1.7;">
                ${formattedAI}
              </div>
            </div>
          </td>
        </tr>

        <!-- DISCLAIMER -->
        <tr>
          <td style="padding:24px 32px 32px 32px;">
            <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;line-height:1.6;">
              This alert is generated automatically by the Market Structure Intelligence Engine.<br>
              Always perform your own chart analysis before making any trading decision.<br>
              <strong>This is not financial advice.</strong>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`;
        try {
            console.log(`[${symbol}] Dispatching email alert via Resend...`);
            const { data, error } = await this.resend.emails.send({
                from: env_1.config.emailFrom,
                to: [env_1.config.emailTo],
                subject: subject,
                html: htmlBody
            });
            if (error) {
                throw new Error(error.message);
            }
            console.log(`[${symbol}] ✅ Alert email sent successfully. ID: ${data?.id}`);
        }
        catch (e) {
            console.error(`[${symbol}] Failed to send email: ${e.message}`);
        }
    }
}
exports.NotificationService = NotificationService;
