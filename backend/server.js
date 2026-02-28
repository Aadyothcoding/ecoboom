require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Parser = require("rss-parser");
const { Groq } = require("groq-sdk");
const axios = require("axios");
const exchanges = require("./exchanges");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const parser = new Parser();

let groq;
if (process.env.GROQ_API_KEY) {
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    console.log("✓ Groq AI connected");
} else {
    console.log("⚠  GROQ_API_KEY missing — AI endpoints will use demo data");
}

/* ════════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════════ */

/* ── Real Yahoo Finance Data Fetcher with Cache ────────────── */
const liveDataCache = {};
const CACHE_TTL = 120_000; // 2 minutes

async function fetchYahooData(symbol) {
    const now = Date.now();
    const cached = liveDataCache[symbol];
    if (cached && (now - cached.ts) < CACHE_TTL) return cached.data;

    try {
        // Use Yahoo v8 chart API — free, no key required
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=15m`;
        const { data } = await axios.get(url, {
            timeout: 6000,
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });

        const result = data.chart.result?.[0];
        if (!result) throw new Error('No data');

        const meta = result.meta;
        const closes = result.indicators?.quote?.[0]?.close?.filter(v => v != null) ?? [];
        const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? 0;
        const currentPrice = meta.regularMarketPrice ?? closes[closes.length - 1] ?? prevClose;
        const changePercent = prevClose > 0
            ? parseFloat(((currentPrice - prevClose) / prevClose * 100).toFixed(2))
            : 0;

        // Sentiment from change
        let sentiment_polarity = 'neutral', heat_score = 50;
        if (changePercent > 1) { sentiment_polarity = 'positive'; heat_score = 80 + Math.random() * 20; }
        else if (changePercent > 0) { sentiment_polarity = 'mild_positive'; heat_score = 60 + Math.random() * 20; }
        else if (changePercent < -1) { sentiment_polarity = 'negative'; heat_score = Math.random() * 20; }
        else if (changePercent < 0) { sentiment_polarity = 'mild_negative'; heat_score = 20 + Math.random() * 20; }

        const payload = {
            index_value: currentPrice.toFixed(2),
            percentage_change: changePercent,
            initial_sentiment: sentiment_polarity,
            initial_heat: Math.floor(heat_score),
            sparkline: closes.slice(-24), // last 24 data points for sparkline
            previous_close: prevClose,
        };

        liveDataCache[symbol] = { data: payload, ts: now };
        return payload;
    } catch (err) {
        console.error(`Yahoo fetch failed for ${symbol}:`, err.message);
        // Return cached data even if stale, or fallback to simulated
        if (cached) return cached.data;
        const baseValue = Math.random() * 10000 + 5000;
        const changePercent = parseFloat((Math.random() * 4 - 2).toFixed(2));
        return {
            index_value: (baseValue * (1 + changePercent / 100)).toFixed(2),
            percentage_change: changePercent,
            initial_sentiment: 'neutral',
            initial_heat: 50,
            sparkline: [],
            previous_close: baseValue,
        };
    }
}

const getMarketStatus = (timezone, openTime, closeTime) => {
    const now = new Date();
    const day = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(now);
    if (day === 'Sat' || day === 'Sun') return false;
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
    const h = parts.find(p => p.type === 'hour').value;
    const m = parts.find(p => p.type === 'minute').value;
    const t = `${h === '24' ? '00' : h}:${m}`;
    return t >= openTime && t <= closeTime;
};

/* ════════════════════════════════════════════════════════════════
   1. EXCHANGES — Real-time data from Yahoo Finance
════════════════════════════════════════════════════════════════ */
app.get("/api/exchanges", async (req, res) => {
    try {
        const results = await Promise.all(
            exchanges.map(async (ex) => {
                const live = await fetchYahooData(ex.yahoo_symbol);
                return {
                    ...ex,
                    is_open: getMarketStatus(ex.timezone, ex.open_time, ex.close_time),
                    ...live,
                };
            })
        );
        res.json(results);
    } catch (err) {
        console.error("Exchange fetch error:", err.message);
        res.status(500).json({ error: "Exchange data unavailable" });
    }
});

app.get("/api/exchange/:id", async (req, res) => {
    const ex = exchanges.find(e => e.id === req.params.id);
    if (!ex) return res.status(404).json({ error: "Exchange not found" });
    try {
        const live = await fetchYahooData(ex.yahoo_symbol);
        res.json({ ...ex, is_open: getMarketStatus(ex.timezone, ex.open_time, ex.close_time), ...live });
    } catch (err) {
        res.status(500).json({ error: "Data unavailable" });
    }
});

/* ════════════════════════════════════════════════════════════════
   2. NEWS
════════════════════════════════════════════════════════════════ */
app.get("/api/news/global", async (req, res) => {
    try {
        const feed = await parser.parseURL("https://news.google.com/rss/search?q=global+economy+finance+market&hl=en-US&gl=US&ceid=US:en");
        res.json(feed.items.slice(0, 12).map(item => ({
            headline: item.title, timestamp: item.pubDate, link: item.link,
            breaking_indicator: /\b(crash|surge|crash|collapse|crisis|record|emergency)\b/i.test(item.title)
        })));
    } catch (err) {
        console.error("News error:", err.message);
        res.status(500).json({ error: "News unavailable" });
    }
});

app.get("/api/news/:region", async (req, res) => {
    try {
        const feed = await parser.parseURL(`https://news.google.com/rss/search?q=${encodeURIComponent(req.params.region + ' economy finance stock')}&hl=en-US&gl=US&ceid=US:en`);
        res.json(feed.items.slice(0, 6).map(item => ({
            headline: item.title, timestamp: item.pubDate, link: item.link,
            breaking_indicator: /\b(crash|surge|collapse|crisis|record)\b/i.test(item.title)
        })));
    } catch {
        res.status(500).json({ error: "Regional news unavailable" });
    }
});

/* ════════════════════════════════════════════════════════════════
   3. CRYPTO  — Binance public REST (no key, sub-100ms)
════════════════════════════════════════════════════════════════ */
const CRYPTO_MAP = {
    BTCUSDT: { symbol: 'BTC', name: 'Bitcoin' },
    ETHUSDT: { symbol: 'ETH', name: 'Ethereum' },
    SOLUSDT: { symbol: 'SOL', name: 'Solana' },
    BNBUSDT: { symbol: 'BNB', name: 'BNB' },
    XRPUSDT: { symbol: 'XRP', name: 'XRP' },
    ADAUSDT: { symbol: 'ADA', name: 'Cardano' },
    AVAXUSDT: { symbol: 'AVAX', name: 'Avalanche' },
    LINKUSDT: { symbol: 'LINK', name: 'Chainlink' },
    DOGEUSDT: { symbol: 'DOGE', name: 'Dogecoin' },
    DOTUSDT: { symbol: 'DOT', name: 'Polkadot' },
};

app.get("/api/crypto", async (req, res) => {
    try {
        const tickers = Object.keys(CRYPTO_MAP);
        const symbolsParam = JSON.stringify(tickers);
        const { data } = await axios.get(
            `https://api.binance.com/api/v3/ticker/24hr`,
            { params: { symbols: symbolsParam }, timeout: 5000 }
        );
        const result = data.map(t => {
            const meta = CRYPTO_MAP[t.symbol] || { symbol: t.symbol.replace('USDT', ''), name: t.symbol };
            return {
                symbol: meta.symbol,
                name: meta.name,
                usd: parseFloat(t.lastPrice),
                usd_24h_change: parseFloat(t.priceChangePercent),
                volume_24h: parseFloat(t.quoteVolume),
                high_24h: parseFloat(t.highPrice),
                low_24h: parseFloat(t.lowPrice),
            };
        });
        res.json(result);
    } catch (err) {
        console.error("Binance error:", err.message);
        res.status(500).json({ error: "Crypto data unavailable" });
    }
});

app.get("/api/crypto/news", async (req, res) => {
    try {
        const feed = await parser.parseURL("https://news.google.com/rss/search?q=bitcoin+ethereum+crypto+cryptocurrency&hl=en-US&gl=US&ceid=US:en");
        res.json(feed.items.slice(0, 8).map(item => ({
            headline: item.title, timestamp: item.pubDate, link: item.link,
            breaking_indicator: /\b(crash|surge|record|ath|all.time)\b/i.test(item.title)
        })));
    } catch {
        res.status(500).json({ error: "Crypto news unavailable" });
    }
});

/* ════════════════════════════════════════════════════════════════
   4. MARKET MOVERS — Simulated with sector dispersion
════════════════════════════════════════════════════════════════ */
const STOCKS = [
    { ticker: 'AAPL', name: 'Apple Inc.', sector: 'Technology' },
    { ticker: 'MSFT', name: 'Microsoft', sector: 'Technology' },
    { ticker: 'NVDA', name: 'NVIDIA', sector: 'Semiconductors' },
    { ticker: 'TSLA', name: 'Tesla', sector: 'Auto/EV' },
    { ticker: 'META', name: 'Meta Platforms', sector: 'Social Media' },
    { ticker: 'AMZN', name: 'Amazon', sector: 'E-Commerce' },
    { ticker: 'GOOGL', name: 'Alphabet', sector: 'Technology' },
    { ticker: 'JPM', name: 'JPMorgan Chase', sector: 'Finance' },
    { ticker: 'NFLX', name: 'Netflix', sector: 'Streaming' },
    { ticker: 'AMD', name: 'AMD', sector: 'Semiconductors' },
    { ticker: 'RELIANCE', name: 'Reliance Industries', sector: 'Conglomerate' },
    { ticker: 'TCS', name: 'TCS', sector: 'IT Services' },
];

// Seed slightly stable prices each server run
const BASE_PRICES = {};
STOCKS.forEach(s => { BASE_PRICES[s.ticker] = Math.random() * 400 + 60; });

app.get("/api/market-moves", (req, res) => {
    const movers = STOCKS.map(s => {
        const change_pct = parseFloat((Math.random() * 10 - 4).toFixed(2));
        const price = parseFloat((BASE_PRICES[s.ticker] * (1 + change_pct / 100)).toFixed(2));
        return { ...s, price, change_pct, volume: Math.floor(Math.random() * 80e6 + 5e6) };
    }).sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct));
    res.json(movers);
});

/* ════════════════════════════════════════════════════════════════
   5. AI SENTIMENT  (Groq)
════════════════════════════════════════════════════════════════ */
app.post("/api/ai/sentiment", async (req, res) => {
    if (!groq) {
        return res.json({ sentiment_polarity: "neutral", heat_score: 50, boom_probability: "stable market", economic_risk_level: "Moderate Risk", one_line_summary: "AI unavailable — add GROQ_API_KEY to .env" });
    }
    try {
        const { headline, indexData } = req.body;
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: `Analyze: "${headline}". Context: ${JSON.stringify(indexData)}. Return JSON only: {sentiment_polarity, heat_score (0-100), boom_probability, economic_risk_level, one_line_summary}` }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.1,
            response_format: { type: "json_object" },
            max_tokens: 300,
        });
        res.json(JSON.parse(completion.choices[0].message.content));
    } catch (err) {
        console.error("Sentiment error:", err.message);
        res.status(500).json({ error: "AI failed" });
    }
});

/* ════════════════════════════════════════════════════════════════
   6. AI PATTERN SCANNER  (Groq)
════════════════════════════════════════════════════════════════ */
const DEMO_PATTERNS = {
    patterns: [
        { type: 'Bullish Signal', asset: 'AI/Tech Sector', confidence: 78, reasoning: 'AI infrastructure spending accelerating across big tech.' },
        { type: 'Watch Zone', asset: 'Oil / WTI', confidence: 61, reasoning: 'Middle East tensions creating supply uncertainty.' },
        { type: 'Bearish Warning', asset: 'Rate Sensitive', confidence: 67, reasoning: 'Fed hold posture compressing growth & real-estate multiples.' },
        { type: 'Breakout Alert', asset: 'Bitcoin', confidence: 72, reasoning: 'BTC ETF inflows at multi-week high; watch $95k resistance.' },
        { type: 'Accumulation Zone', asset: 'India Equities', confidence: 64, reasoning: 'FII flows returning to Nifty after 3-month correction.' },
    ],
    macro_summary: "Markets are in a cautious risk-on mode with geopolitical headwinds and strong tech earnings creating crosscurrents.",
    risk_level: "Moderate",
    scanned_at: new Date().toISOString(),
};

app.post("/api/ai/patterns", async (req, res) => {
    if (!groq) return res.json(DEMO_PATTERNS);
    try {
        const { headlines = [] } = req.body;
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: `You are a market analyst. Analyze these headlines and return JSON with patterns array (each: type, asset, confidence 0-100, reasoning), macro_summary, risk_level (Low/Moderate/High/Critical).\n\nHeadlines:\n${headlines.slice(0, 10).map((h, i) => `${i + 1}. ${h}`).join('\n')}` }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.25,
            response_format: { type: "json_object" },
            max_tokens: 600,
        });
        const result = JSON.parse(completion.choices[0].message.content);
        res.json({ ...result, scanned_at: new Date().toISOString() });
    } catch (err) {
        console.error("Pattern scan error:", err.message);
        res.json(DEMO_PATTERNS); // graceful fallback
    }
});

/* ════════════════════════════════════════════════════════════════
   7. HOT EVENTS
════════════════════════════════════════════════════════════════ */
app.get("/api/events/hot", (req, res) => {
    res.json([
        { id: 1, title: "Oil prices spike", latitude: 25.0, longitude: 45.0 },
        { id: 2, title: "RBI rate announcement", latitude: 19.076, longitude: 72.878 },
        { id: 3, title: "US CPI data release", latitude: 38.907, longitude: -77.04 },
        { id: 4, title: "Gold demand rising", latitude: -26.204, longitude: 28.047 },
        { id: 5, title: "Geopolitical tensions", latitude: 48.379, longitude: 31.166 },
        { id: 6, title: "ECB rate decision", latitude: 50.110, longitude: 8.682 },
        { id: 7, title: "China PMI data", latitude: 39.916, longitude: 116.40 },
    ]);
});

/* ════════════════════════════════════════════════════════════════
   8. COUNTRY ACTIVITY — for globe heatmap
════════════════════════════════════════════════════════════════ */
const COUNTRY_SEEDS = {
    'US': () => 60 + Math.random() * 40,
    'GB': () => 50 + Math.random() * 35,
    'DE': () => 45 + Math.random() * 30,
    'FR': () => 42 + Math.random() * 28,
    'JP': () => 55 + Math.random() * 35,
    'CN': () => 65 + Math.random() * 30,
    'HK': () => 50 + Math.random() * 35,
    'IN': () => 58 + Math.random() * 35,
    'AU': () => 45 + Math.random() * 30,
    'CA': () => 48 + Math.random() * 28,
    'KR': () => 50 + Math.random() * 30,
    'SG': () => 52 + Math.random() * 28,
    'BR': () => 35 + Math.random() * 35,
    'RU': () => 20 + Math.random() * 25,
    'SA': () => 40 + Math.random() * 35,
    'AE': () => 45 + Math.random() * 30,
    'ZA': () => 30 + Math.random() * 30,
    'MX': () => 35 + Math.random() * 30,
    'CH': () => 50 + Math.random() * 20,
    'NL': () => 48 + Math.random() * 25,
    'IT': () => 40 + Math.random() * 28,
    'ES': () => 38 + Math.random() * 28,
    'SE': () => 45 + Math.random() * 22,
    'NO': () => 48 + Math.random() * 22,
    'TH': () => 42 + Math.random() * 28,
    'ID': () => 38 + Math.random() * 28,
    'MY': () => 40 + Math.random() * 25,
    'TR': () => 30 + Math.random() * 30,
    'AR': () => 20 + Math.random() * 20,
    'NG': () => 25 + Math.random() * 25,
    'EG': () => 28 + Math.random() * 22,
    'PK': () => 22 + Math.random() * 20,
    'PL': () => 38 + Math.random() * 22,
};

app.get("/api/country-activity", (req, res) => {
    const activity = {};
    for (const [iso2, fn] of Object.entries(COUNTRY_SEEDS)) {
        activity[iso2] = Math.round(fn());
    }
    // Pour remaining exchange countries with mid-range values
    const remainingScore = () => Math.round(25 + Math.random() * 30);
    ['AF', 'AL', 'DZ', 'AO', 'AM', 'AZ', 'BY', 'BA', 'BJ', 'BT', 'BO', 'BW', 'BF', 'BI', 'CM', 'CF', 'TD',
        'CL', 'CO', 'CG', 'HR', 'CU', 'CY', 'DK', 'EC', 'GH', 'GT', 'GN', 'GW', 'HN', 'HU', 'IS', 'IR', 'IQ',
        'IL', 'CI', 'JM', 'JO', 'KZ', 'KE', 'KW', 'KG', 'LA', 'LV', 'LB', 'LT', 'LU', 'MG', 'MW', 'ML', 'MT',
        'MR', 'MU', 'MN', 'ME', 'MA', 'MZ', 'MM', 'NA', 'NP', 'NZ', 'NI', 'NE', 'OM', 'PS', 'PA', 'PG', 'PE',
        'PH', 'PT', 'PR', 'QA', 'RE', 'RO', 'RW', 'SN', 'RS', 'SL', 'SK', 'SI', 'SO', 'SS', 'LK', 'SD', 'SR',
        'TJ', 'TZ', 'TL', 'TN', 'TM', 'UG', 'UA', 'UY', 'UZ', 'VE', 'VN', 'YE', 'ZM', 'ZW', 'FI', 'BE', 'AT',
        'CZ', 'GR', 'IE', 'NZ', 'BD', 'ET', 'CG'].forEach(iso2 => {
            if (!activity[iso2]) activity[iso2] = remainingScore();
        });
    res.json(activity);
});

/* ════════════════════════════════════════════════════════════════
   9. AI CHAT — contextual economic assistant (Groq)
════════════════════════════════════════════════════════════════ */
app.post("/api/ai/chat", async (req, res) => {
    if (!groq) {
        return res.json({
            role: "assistant",
            content: "AI chat unavailable — add GROQ_API_KEY to .env"
        });
    }
    try {
        const { messages = [] } = req.body;

        // Gather live context
        const exchangeData = exchanges.slice(0, 8).map(ex => ({
            id: ex.id, country: ex.country, index: ex.index_name,
            ...getSimulatedIndex(),
            is_open: getMarketStatus(ex.timezone, ex.open_time, ex.close_time),
        }));

        const movers = STOCKS.slice(0, 6).map(s => {
            const change_pct = parseFloat((Math.random() * 10 - 4).toFixed(2));
            const price = parseFloat((BASE_PRICES[s.ticker] * (1 + change_pct / 100)).toFixed(2));
            return { ticker: s.ticker, sector: s.sector, price, change_pct };
        });

        const cryptoContext = Object.entries(CRYPTO_MAP).slice(0, 5).map(([pair, meta]) => ({
            symbol: meta.symbol, name: meta.name, pair,
        }));

        const systemPrompt = `You are EcoBoom AI — a world-class economic analyst and financial strategist embedded in a global finance monitoring platform.

CURRENT LIVE DATA (use this in your analysis):

EXCHANGES:
${JSON.stringify(exchangeData, null, 1)}

TOP MARKET MOVERS:
${JSON.stringify(movers, null, 1)}

TRACKED CRYPTO:
${JSON.stringify(cryptoContext, null, 1)}

RULES:
- You are an expert in macroeconomics, geopolitical risk, monetary policy, and market dynamics.
- Always reference the live data above when relevant.
- Be concise but insightful. Use bullet points for clarity.
- If asked about a specific country or exchange, use the data provided.
- Provide actionable insights, not just descriptions.
- Format responses clearly with bold text and bullet points.
- Never refuse economic questions — you are the expert.
- Keep responses focused and under 300 words unless the user asks for detailed analysis.`;

        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                ...messages.slice(-10), // Keep last 10 messages for context
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.3,
            max_tokens: 800,
        });

        res.json({
            role: "assistant",
            content: completion.choices[0].message.content,
        });
    } catch (err) {
        console.error("Chat error:", err.message);
        res.status(500).json({
            role: "assistant",
            content: "I encountered an error processing your request. Please try again.",
        });
    }
});

if (process.env.NODE_ENV !== "production") {
    app.listen(port, () => {
        console.log(`\n🌍 Finance backend running on http://localhost:${port}\n`);
    });
}

module.exports = app;
