import { Resend } from 'resend';
import { config } from '../config/env';
import { AlertWithDetails } from '../types';
import { getTradingViewUrl } from '../utils/tradingViewUrl';
import { formatTimestamp } from '../utils/timeUtils';

const resend = new Resend(config.resendApiKey);

function buildEmailHtml(alerts: AlertWithDetails[], aiSummary: string): string {
  const rows = alerts.map(a => `
    <tr style="border-bottom:1px solid #eee">
      <td style="padding:6px 10px">
        <a href="${getTradingViewUrl(a.ticker)}" style="color:#2962FF;text-decoration:none;font-weight:bold">${a.ticker}</a>
      </td>
      <td style="padding:6px 10px">${a.event_type}</td>
      <td style="padding:6px 10px;color:${a.direction === 'BULLISH' ? '#089981' : '#F23645'};font-weight:bold">${a.direction}</td>
      <td style="padding:6px 10px">${a.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      <td style="padding:6px 10px;font-size:12px;color:#888">${formatTimestamp(a.created_at).substring(11, 19)}</td>
    </tr>
  `).join('');

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:auto;border:1px solid #ddd;border-radius:8px;padding:20px">
      <h2 style="color:#333;margin-top:0">🔔 Market Structure Update</h2>
      <p style="color:#666;font-size:14px">${alerts.length} new confirmed event${alerts.length > 1 ? 's' : ''}</p>

      <table style="width:100%;border-collapse:collapse;margin:15px 0">
        <thead>
          <tr style="background:#f5f5f5;text-align:left">
            <th style="padding:8px 10px">Symbol</th>
            <th style="padding:8px 10px">Event</th>
            <th style="padding:8px 10px">Direction</th>
            <th style="padding:8px 10px">Price</th>
            <th style="padding:8px 10px">Time</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div style="background:#f9f9f9;border-left:4px solid #2962FF;padding:15px;margin:15px 0;font-size:14px;line-height:1.6;white-space:pre-wrap">
        ${aiSummary}
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
