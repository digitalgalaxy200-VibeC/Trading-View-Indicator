import { Resend } from 'resend';
import { config } from '../config/env';
import { AlertWithDetails } from '../types';
import { getTradingViewUrl } from '../utils/tradingViewUrl';
import { formatTimestamp } from '../utils/timeUtils';

const resend = new Resend(config.resendApiKey);

function buildEmailHtml(alerts: AlertWithDetails[], aiSummary: string): string {
  const cards = alerts.map(a => `
    <div style="background:#111827;border:1px solid #1e2d45;border-radius:8px;padding:20px;margin-bottom:15px;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
      
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;border-bottom:1px solid #1e2d45;padding-bottom:10px;">
        <span style="font-size:20px;font-weight:800;color:#fff">${a.ticker}</span>
        <span style="font-size:13px;font-weight:700;color:${a.event_type === 'BOS' ? '#3b82f6' : '#f59e0b'};background:rgba(59,130,246,0.1);padding:4px 10px;border-radius:4px;">${a.event_type}</span>
      </div>

      <table style="width:100%;font-size:14px;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;color:#94a3b8;border-bottom:1px solid #1e2d45;">Direction</td>
          <td style="padding:8px 0;text-align:right;font-weight:bold;color:${a.direction === 'BULLISH' ? '#10b981' : '#ef4444'};border-bottom:1px solid #1e2d45;">${a.direction === 'BULLISH' ? '▲' : '▼'} ${a.direction}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#94a3b8;border-bottom:1px solid #1e2d45;">Breakout Price</td>
          <td style="padding:8px 0;text-align:right;font-weight:bold;color:#fff;border-bottom:1px solid #1e2d45;">${a.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#94a3b8;border-bottom:1px solid #1e2d45;">Pivot Level Broken</td>
          <td style="padding:8px 0;text-align:right;font-weight:bold;color:#fff;border-bottom:1px solid #1e2d45;">${a.pivot_level.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#94a3b8;">Detection Time</td>
          <td style="padding:8px 0;text-align:right;font-weight:bold;color:#fff;">${formatTimestamp(a.created_at).substring(11, 19)} UTC</td>
        </tr>
      </table>

      <div style="margin-top:20px;text-align:center;">
        <a href="${getTradingViewUrl(a.ticker)}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:bold;font-size:13px;">Open Chart on TradingView →</a>
      </div>
    </div>
  `).join('');

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:auto;background:#0a0e1a;padding:20px;border-radius:12px;">
      
      <div style="margin-bottom:20px;">
        <h2 style="color:#fff;margin:0 0 5px 0;">🔔 Confirmed Market Structure</h2>
        <p style="color:#94a3b8;font-size:14px;margin:0;">15-Minute Timeframe · ${alerts.length} event${alerts.length > 1 ? 's' : ''}</p>
      </div>

      <!-- ALERT DETAILS -->
      ${cards}

      <!-- AI SUMMARY -->
      <div style="background:linear-gradient(135deg, rgba(59,130,246,0.1), rgba(16,185,129,0.05));border:1px solid rgba(59,130,246,0.3);padding:20px;margin-top:20px;border-radius:10px;">
        <div style="font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#3b82f6;margin-bottom:15px;display:flex;align-items:center;">
          🧠 AI Executive Technical Read
        </div>
        <div style="font-size:14px;line-height:1.7;color:#e2e8f0;white-space:pre-wrap;">
          ${aiSummary}
        </div>
      </div>

      <p style="font-size:12px;color:#999;text-align:center;margin-top:25px">
        AI Trend Assistant | ${formatTimestamp(Date.now())} UTC<br>
        <a href="${config.dashboardUrl}" style="color:#2962FF">Open Dashboard</a> &nbsp;|&nbsp; For review only — not financial advice
      </p>
    </div>
  `;
}

export async function sendBatchEmail(alerts: AlertWithDetails[], aiSummary: string): Promise<{ success: boolean; resendId?: string }> {
  try {
    const html = buildEmailHtml(alerts, aiSummary);
    const subject = `🔔 Market Structure Update — ${alerts.length} event${alerts.length > 1 ? 's' : ''} — ${formatTimestamp(Date.now()).substring(0, 16)} UTC`;

    const result = await resend.emails.send({
      from: config.emailFrom,
      to: config.notificationEmail,
      subject,
      html,
    });

    if (result.error) {
      console.error('Resend API error:', result.error);
      return { success: false };
    }

    console.log(`Email sent: ${alerts.length} alerts — Resend ID: ${result.data?.id}`);
    return { success: true, resendId: result.data?.id as string };
  } catch (err: any) {
    console.error('Email dispatch error:', err.message);
    return { success: false };
  }
}
