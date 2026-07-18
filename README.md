# AI Trend Continuation Trading Assistant

An AI-powered SMC trading assistant that explains market structure events via Telegram.  
**This is NOT a trading bot — the system never executes trades.**

## Workflow

```
TradingView (M5) → CHOCH/BOS detected → Webhook → Vercel → DeepSeek AI → Telegram → Manual review
```

## Prerequisites

- Node.js 18+
- Vercel account (Hobby plan)
- DeepSeek API key
- Telegram Bot (created via @BotFather)
- TradingView account with the enhanced LuxAlgo SMC indicator

## Setup

### 1. Clone & Install

```bash
git clone <repo-url>
cd ai-trend-assistant
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
DEEPSEEK_API_KEY=sk-your-key
TELEGRAM_BOT_TOKEN=123456:ABC-DEF
TELEGRAM_CHAT_ID=123456789
WEBHOOK_SECRET=your-random-secret
```

### 3. Deploy to Vercel

```bash
npx vercel login
npx vercel link
npx vercel env add DEEPSEEK_API_KEY
npx vercel env add TELEGRAM_BOT_TOKEN
npx vercel env add TELEGRAM_CHAT_ID
npx vercel env add WEBHOOK_SECRET
npx vercel --prod
```

Note your deployment URL (e.g., `https://your-project.vercel.app`).

### 4. Configure TradingView

1. Load the enhanced SMC indicator on each symbol (M5 chart).
2. Create 4 alerts per symbol (Bullish CHOCH, Bearish CHOCH, Bullish BOS, Bearish BOS).
3. Set the webhook URL to: `https://your-project.vercel.app/api/webhook`
4. The indicator's `alert()` function builds the JSON payload automatically.

## Project Structure

```
├── api/
│   └── webhook.js          # Main webhook handler
├── lib/
│   ├── config.js           # Configuration & environment
│   ├── constants.js        # Watchlist, limits, emoji mappings
│   ├── deepseek.js         # DeepSeek API client
│   ├── logger.js           # Structured JSON logger
│   ├── telegram.js         # Telegram Bot API client
│   └── validators.js       # Webhook payload validation
├── templates/
│   └── system-prompt.txt   # DeepSeek system prompt (reference)
├── .env.example
├── vercel.json
└── package.json
```

## Watchlist (10 symbols, M5 only)

VOLATILITY_75_INDEX, VOLATILITY_75_1S_INDEX, VOLATILITY_50_INDEX,  
VOLATILITY_30_1S_INDEX, VOLATILITY_25_INDEX, VOLATILITY_25_1S_INDEX,  
VOLATILITY_15_1S_INDEX, VOLATILITY_10_INDEX, VOLATILITY_10_1S_INDEX,  
VOLATILITY_100_1S_INDEX

## Signals

Only 4 signal types are processed:

- Bullish CHOCH
- Bearish CHOCH
- Bullish BOS
- Bearish BOS

All other LuxAlgo signals are silently discarded.

## License

Private — For personal use only.
