import { Resend } from 'resend';
import { config } from '../config/env';
import { AlertWithDetails } from '../types';
import { getTradingViewUrl } from '../utils/tradingViewUrl';
import { formatTimestamp } from '../utils/timeUtils';

const resend = new Resend(config.resendApiKey);

// ── SYSTEM 1: Engine Alert Email ──
function buildEngineEmailHtml(alerts: AlertWithDetails[], aiSummary: string): string {
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
      
      <div style="margin-bottom:20px; border-bottom: 2px solid #1e2d45; padding-bottom: 15px;">
        <div style="font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#94a3b8;margin-bottom:8px;">
          Source: Market Structure Engine
        </div>
        <h2 style="color:#fff;margin:0 0 5px 0;">🔔 Objective System Event</h2>
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
    const html = buildEngineEmailHtml(alerts, aiSummary);
    
    // Engine Email Subject
    let subject = `Engine Alert: ${alerts.length} event${alerts.length > 1 ? 's' : ''} Detected`;
    if (alerts.length === 1) {
      const a = alerts[0];
      const dirStr = a.direction === 'BULLISH' ? 'Bullish' : 'Bearish';
      subject = `Engine Alert: ${dirStr} ${a.event_type} Detected on ${a.ticker}`;
    }

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

// ── SYSTEM 2: AI Watch Email ──
export interface WatchTaskContext {
  ticker: string;
  condition: string;
  status: string;
  reason: string;
}

export async function sendWatchEmail(task: WatchTaskContext): Promise<{ success: boolean; resendId?: string }> {
  try {
    const subject = `AI Watch Triggered: ${task.ticker} — Condition Met`;
    
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:auto;background:#0a0e1a;padding:20px;border-radius:12px;">
        
        <div style="margin-bottom:20px; border-bottom: 2px solid #8b5cf6; padding-bottom: 15px;">
          <div style="font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#8b5cf6;margin-bottom:8px;">
            Source: AI Trading Assistant
          </div>
          <h2 style="color:#fff;margin:0 0 5px 0;">🧠 Personal Watch Triggered</h2>
        </div>

        <div style="background:#111827;border:1px solid #1e2d45;border-radius:8px;padding:20px;margin-bottom:15px;color:#e2e8f0;">
          <div style="font-size:20px;font-weight:800;color:#fff;margin-bottom:15px;">${task.ticker}</div>
          
          <div style="margin-bottom:15px;">
            <div style="font-size:12px;color:#94a3b8;margin-bottom:4px;text-transform:uppercase;">Your Condition</div>
            <div style="font-size:15px;color:#fff;font-weight:500;">"${task.condition}"</div>
          </div>

          <div style="margin-bottom:15px;">
            <div style="font-size:12px;color:#94a3b8;margin-bottom:4px;text-transform:uppercase;">AI Analysis</div>
            <div style="font-size:15px;color:#10b981;font-weight:500;">${task.reason}</div>
          </div>

          <div style="margin-top:20px;text-align:center;">
            <a href="${getTradingViewUrl(task.ticker)}" style="display:inline-block;background:#8b5cf6;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:bold;font-size:13px;">Open Chart on TradingView →</a>
          </div>
        </div>

        <p style="font-size:12px;color:#999;text-align:center;margin-top:25px">
          AI Trend Assistant | ${formatTimestamp(Date.now())} UTC<br>
          <a href="${config.dashboardUrl}/ai" style="color:#8b5cf6">Open AI Dashboard</a>
        </p>
      </div>
    `;

    const result = await resend.emails.send({
      from: config.emailFrom,
      to: config.notificationEmail,
      subject,
      html,
    });

    if (result.error) {
      console.error('Watch Email Resend API error:', result.error);
      return { success: false };
    }

    console.log(`Watch Email sent for ${task.ticker} — Resend ID: ${result.data?.id}`);
    return { success: true, resendId: result.data?.id as string };
  } catch (err: any) {
    console.error('Watch Email dispatch error:', err.message);
    return { success: false };
  }
}

// V4: Opportunity Email
export async function sendOpportunityEmail(opp: any, scoreText: string): Promise<{ success: boolean; resendId?: string }> {
  try {
    const dirEmoji = opp.direction === 'BULLISH' ? '🟢' : '🔴';
    const typeLabel = opp.workflow_type === 'reversal' ? 'Trend Reversal' : 'Trend Continuation';
    const entry = opp.entry_price?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '—';
    const sl = opp.stop_loss?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '—';
    const tp = opp.take_profit?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '—';
    const rr = opp.risk_reward || '—';
    const subject = `${dirEmoji} Trade Ready: ${opp.direction} ${typeLabel}`;
    const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:auto;background:#0a0e1a;padding:20px;border-radius:12px;"><h2 style="color:#fff">${dirEmoji} ${opp.direction} ${typeLabel}</h2><table style="width:100%;color:#e2e8f0;"><tr><td>Entry (50% Fib)</td><td style="text-align:right;font-weight:bold">${entry}</td></tr><tr><td>Stop Loss (0%)</td><td style="text-align:right;color:#ef4444;font-weight:bold">${sl}</td></tr><tr><td>Take Profit (100%)</td><td style="text-align:right;color:#10b981;font-weight:bold">${tp}</td></tr><tr><td>Risk-to-Reward</td><td style="text-align:right;font-weight:bold">1:${rr}</td></tr></table><div style="background:#111827;padding:15px;margin-top:15px;border-radius:8px;white-space:pre-wrap;line-height:1.7">${scoreText}</div><div style="text-align:center;margin-top:20px"><a href="${getTradingViewUrl(opp.ticker || '')}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:bold">Open Chart →</a></div><p style="font-size:12px;color:#999;text-align:center;margin-top:25px">AI Trend Assistant | ${formatTimestamp(Date.now())} UTC<br>For review only</p></div>`;
    const result = await resend.emails.send({ from: config.emailFrom, to: config.notificationEmail, subject, html });
    if (result.error) { console.error('Opportunity Email error:', result.error); return { success: false }; }
    return { success: true, resendId: result.data?.id as string };
  } catch (err: any) { console.error('Opportunity Email error:', err.message); return { success: false }; }
}

// ── SYSTEM V5: Structure Alert Email (LEG_ARMED only) ──
import { StructureAlert } from './structureAlertBuilder';

export async function sendStructureAlertEmail(
  alert: StructureAlert,
  commentary: string | null
): Promise<{ success: boolean; resendId?: string }> {
  try {
    const dirColor  = alert.direction === 'bullish' ? '#10b981' : '#ef4444';
    const dirEmoji  = alert.direction === 'bullish' ? '▲' : '▼';
    const dirLabel  = alert.direction === 'bullish' ? 'BULLISH BOS' : 'BEARISH BOS';
    const bosTime   = new Date(alert.bosTime).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

    const commentaryHtml = commentary
      ? `<div style="margin-top:20px;padding:14px;background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.3);border-radius:8px;font-size:13px;color:#c4b5fd;">
           <span style="font-weight:bold;color:#8b5cf6;">AI note:</span> ${commentary}
         </div>`
      : '';

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:auto;background:#0a0e1a;padding:24px;border-radius:12px;">

        <div style="border-bottom:2px solid #1e2d45;padding-bottom:14px;margin-bottom:20px;">
          <div style="font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;">
            5m Execution · 15m Bias Confirmed
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <h2 style="color:#fff;margin:0;font-size:22px;">${alert.symbol}</h2>
            <span style="font-size:13px;font-weight:800;color:${dirColor};background:rgba(0,0,0,0.3);padding:5px 12px;border-radius:6px;letter-spacing:1px;">
              ${dirEmoji} ${dirLabel}
            </span>
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#e2e8f0;">
          <tr style="border-bottom:1px solid #1e2d45;">
            <td style="padding:10px 4px;color:#94a3b8;">Broke at</td>
            <td style="padding:10px 4px;text-align:right;font-weight:bold;color:#fff;font-size:16px;">${alert.bosPrice.toFixed(2)}</td>
          </tr>
          <tr style="border-bottom:1px solid #1e2d45;">
            <td style="padding:10px 4px;color:#94a3b8;">Break time</td>
            <td style="padding:10px 4px;text-align:right;font-weight:bold;color:#fff;">${bosTime}</td>
          </tr>
          <tr style="border-bottom:1px solid #1e2d45;">
            <td style="padding:10px 4px;color:#94a3b8;">Entry zone (50%)</td>
            <td style="padding:10px 4px;text-align:right;font-weight:bold;color:#f59e0b;font-size:16px;">${alert.entry.toFixed(2)}</td>
          </tr>
          <tr style="border-bottom:1px solid #1e2d45;">
            <td style="padding:10px 4px;color:#94a3b8;">Reference stop (0%)</td>
            <td style="padding:10px 4px;text-align:right;font-weight:bold;color:#ef4444;">${alert.stop.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding:10px 4px;color:#94a3b8;">Reference target (100%)</td>
            <td style="padding:10px 4px;text-align:right;font-weight:bold;color:#10b981;">${alert.target.toFixed(2)} &nbsp;<span style="font-size:11px;color:#64748b;">(1R)</span></td>
          </tr>
        </table>

        <div style="margin-top:18px;padding:12px;background:#111827;border-radius:8px;font-size:13px;color:#94a3b8;line-height:1.6;">
          Setup notice only — review the chart yourself and place your order at the price you're comfortable with. No auto-entry, no auto-stop.
        </div>

        ${commentaryHtml}

        <div style="text-align:center;margin-top:20px;">
          <a href="${getTradingViewUrl(alert.symbol)}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:10px 22px;border-radius:6px;font-weight:bold;font-size:13px;">Open Chart on TradingView →</a>
        </div>

        <p style="font-size:11px;color:#475569;text-align:center;margin-top:22px;">
          AI Trend Assistant · ${formatTimestamp(Date.now())} UTC<br>
          <a href="${config.dashboardUrl}" style="color:#3b82f6;">Open Dashboard</a> &nbsp;|&nbsp; For review only — not financial advice
        </p>
      </div>
    `;

    const result = await resend.emails.send({
      from:    config.emailFrom,
      to:      config.notificationEmail,
      subject: alert.subject,
      html,
    });

    if (result.error) {
      console.error('Structure alert email error:', result.error);
      return { success: false };
    }
    console.log(`📧 Structure alert sent: ${alert.symbol} — Resend ID: ${result.data?.id}`);
    return { success: true, resendId: result.data?.id as string };
  } catch (err: any) {
    console.error('Structure alert email error:', err.message);
    return { success: false };
  }
}

