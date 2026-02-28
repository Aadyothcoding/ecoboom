import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

/* ─── Helpers ────────────────────────────────────────────── */
const fmtPrice = (n) => {
    if (!n) return '—';
    return n >= 10000 ? n.toLocaleString(undefined, { maximumFractionDigits: 0 })
        : n >= 1 ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : n.toFixed(6);
};

const PATTERN_STYLES = {
    'Bullish Signal': { bg: 'rgba(16,185,129,0.10)', border: '#10b981', text: '#10b981', icon: '📈' },
    'Bearish Warning': { bg: 'rgba(239,68,68,0.10)', border: '#ef4444', text: '#ef4444', icon: '📉' },
    'Watch Zone': { bg: 'rgba(251,191,36,0.10)', border: '#fbbf24', text: '#fbbf24', icon: '👁' },
    'Breakout Alert': { bg: 'rgba(99,102,241,0.10)', border: '#818cf8', text: '#818cf8', icon: '🚀' },
    'Risk Alert': { bg: 'rgba(239,68,68,0.10)', border: '#ef4444', text: '#ef4444', icon: '⚠️' },
    'Accumulation Zone': { bg: 'rgba(34,211,238,0.10)', border: '#22d3ee', text: '#22d3ee', icon: '💎' },
};
const ps = (type) => PATTERN_STYLES[type] ?? { bg: 'rgba(255,255,255,0.04)', border: '#334155', text: '#94a3b8', icon: '⚡' };

const TABS = [
    { id: 'news', label: 'News', icon: '📰' },
    { id: 'markets', label: 'Markets', icon: '📊' },
    { id: 'crypto', label: 'Crypto', icon: '₿' },
    { id: 'patterns', label: 'AI Scan', icon: '✦' },
    { id: 'chat', label: 'AI Chat', icon: '💬' },
];

/* ─── Shared micro-components ─────────────────────────────── */
function Spinner({ label = 'Loading…' }) {
    return (
        <div className="ls-loading">
            <div className="loading-spinner" />
            <span>{label}</span>
        </div>
    );
}

function EmptyState({ msg }) {
    return <div className="ls-empty">{msg}</div>;
}

/* ─── NEWS TAB ────────────────────────────────────────────── */
function NewsTab() {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const { data } = await axios.get('http://localhost:3000/api/news/global');
                setNews(data);
            } catch { } finally { setLoading(false); }
        };
        load();
        const id = setInterval(load, 120_000);
        return () => clearInterval(id);
    }, []);

    if (loading) return <Spinner label="Fetching live headlines…" />;
    if (!news.length) return <EmptyState msg="No headlines available" />;

    return (
        <div className="ls-list">
            {news.map((item, i) => (
                <a key={i} href={item.link} target="_blank" rel="noreferrer"
                    className={`ls-card ls-card--news ${item.breaking_indicator ? 'ls-card--breaking' : ''}`}>
                    {item.breaking_indicator && <span className="ls-badge ls-badge--red">Breaking</span>}
                    <p className="ls-card__headline">{item.headline}</p>
                    <span className="ls-card__meta">
                        {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live'}
                    </span>
                </a>
            ))}
        </div>
    );
}

/* ─── MARKETS TAB ─────────────────────────────────────────── */
function MarketsTab() {
    const [movers, setMovers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const { data } = await axios.get('http://localhost:3000/api/market-moves');
                setMovers(data);
            } catch { } finally { setLoading(false); }
        };
        load();
        const id = setInterval(load, 30_000);
        return () => clearInterval(id);
    }, []);

    if (loading) return <Spinner label="Loading market movers…" />;
    if (!movers.length) return <EmptyState msg="Market data unavailable" />;

    return (
        <div className="ls-list">
            <div className="ls-row-header">
                <span>Ticker</span>
                <span style={{ textAlign: 'right' }}>Price</span>
                <span style={{ textAlign: 'right' }}>24h</span>
            </div>
            {movers.map((s, i) => {
                const up = s.change_pct >= 0;
                return (
                    <div key={i} className={`ls-card ls-card--row ls-card--${up ? 'up' : 'down'}`}>
                        <div className="ls-row__left">
                            <span className="ls-row__ticker">{s.ticker}</span>
                            <span className="ls-row__sub">{s.sector}</span>
                        </div>
                        <span className="ls-row__price">${fmtPrice(s.price)}</span>
                        <span className={`ls-row__change ls-row__change--${up ? 'up' : 'dn'}`}>
                            {up ? '▲' : '▼'} {Math.abs(s.change_pct).toFixed(2)}%
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

/* ─── CRYPTO TAB ──────────────────────────────────────────── */
function CryptoTab() {
    const [coins, setCoins] = useState([]);
    const [cnews, setCnews] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [cRes, nRes] = await Promise.all([
                    axios.get('http://localhost:3000/api/crypto'),
                    axios.get('http://localhost:3000/api/crypto/news'),
                ]);
                setCoins(Array.isArray(cRes.data) ? cRes.data : []);
                setCnews(Array.isArray(nRes.data) ? nRes.data : []);
            } catch (err) {
                console.error('Crypto fetch error:', err.message);
            } finally { setLoading(false); }
        };
        load();
        const id = setInterval(load, 15_000);
        return () => clearInterval(id);
    }, []);

    if (loading) return <Spinner label="Fetching crypto prices…" />;

    return (
        <div className="ls-list">
            <div className="ls-row-header">
                <span>Asset</span>
                <span style={{ textAlign: 'right' }}>Price (USD)</span>
                <span style={{ textAlign: 'right' }}>24h</span>
            </div>

            {coins.map((c, i) => {
                const up = (c.usd_24h_change ?? 0) >= 0;
                return (
                    <div key={i} className={`ls-card ls-card--row ls-card--${up ? 'up' : 'down'}`}>
                        <div className="ls-row__left">
                            <span className="ls-row__ticker">{c.symbol}</span>
                            <span className="ls-row__sub">{c.name}</span>
                        </div>
                        <span className="ls-row__price">${fmtPrice(c.usd)}</span>
                        <span className={`ls-row__change ls-row__change--${up ? 'up' : 'dn'}`}>
                            {up ? '▲' : '▼'} {Math.abs(c.usd_24h_change ?? 0).toFixed(2)}%
                        </span>
                    </div>
                );
            })}

            {cnews.length > 0 && (
                <>
                    <div className="ls-section-label" style={{ marginTop: 16, marginBottom: 6 }}>Crypto Headlines</div>
                    {cnews.map((item, i) => (
                        <a key={i} href={item.link} target="_blank" rel="noreferrer"
                            className={`ls-card ls-card--news ${item.breaking_indicator ? 'ls-card--breaking' : ''}`}>
                            {item.breaking_indicator && <span className="ls-badge ls-badge--cyan">Hot</span>}
                            <p className="ls-card__headline">{item.headline}</p>
                            <span className="ls-card__meta">
                                {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                        </a>
                    ))}
                </>
            )}
        </div>
    );
}

/* ─── AI PATTERNS TAB ─────────────────────────────────────── */
function PatternsTab() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    const scan = useCallback(async () => {
        setLoading(true);
        try {
            const newsRes = await axios.get('http://localhost:3000/api/news/global');
            const headlines = (newsRes.data || []).map(n => n.headline).filter(Boolean);
            const patRes = await axios.post('http://localhost:3000/api/ai/patterns', { headlines });
            setData(patRes.data);
        } catch (err) {
            console.error('Pattern scan error:', err.message);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { scan(); }, []);

    if (loading) return <Spinner label="AI scanning markets…" />;

    const patterns = Array.isArray(data?.patterns) ? data.patterns : [];
    const riskLower = (data?.risk_level || 'moderate').toLowerCase();

    return (
        <div className="ls-list">
            {data?.macro_summary && (
                <div className="ls-macro-box">
                    <div className="ls-section-label" style={{ marginBottom: 8 }}>Macro View</div>
                    <p className="ls-macro-text">{data.macro_summary}</p>
                    {data.risk_level && (
                        <span className={`ls-risk-badge ls-risk-badge--${riskLower}`}>{data.risk_level} Risk</span>
                    )}
                </div>
            )}

            {patterns.length > 0 && (
                <>
                    <div className="ls-section-label" style={{ marginTop: 12, marginBottom: 6 }}>AI Signals</div>
                    {patterns.map((p, i) => {
                        const s = ps(p.type);
                        return (
                            <div key={i} className="ls-pattern" style={{ background: s.bg, borderColor: s.border }}>
                                <div className="ls-pattern__hdr">
                                    <span style={{ fontSize: 14 }}>{s.icon}</span>
                                    <span className="ls-pattern__type" style={{ color: s.text }}>{p.type}</span>
                                    <span className="ls-pattern__conf">{p.confidence ?? 0}%</span>
                                </div>
                                <div className="ls-pattern__asset">{p.asset}</div>
                                <p className="ls-pattern__reason">{p.reasoning}</p>
                            </div>
                        );
                    })}
                </>
            )}

            <button className="ls-rescan-btn" onClick={scan} disabled={loading}>
                {loading ? '⟳ Scanning…' : '✦ Re-scan with AI'}
            </button>

            {data?.scanned_at && (
                <p className="ls-scan-ts">Scanned {new Date(data.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
            )}
        </div>
    );
}

/* ─── AI CHAT TAB ─────────────────────────────────────────── */
const QUICK_PROMPTS = [
    '🌎 Global market overview',
    '📊 Which markets are hot?',
    '₿ Crypto market analysis',
    '⚠️ Key risks right now',
];

function ChatTab() {
    const [messages, setMessages] = useState([
        { role: 'assistant', content: 'Welcome to **EcoBoom AI** 🌍\n\nI have access to live market data, exchange statuses, crypto prices, and global economic indicators.\n\nAsk me anything about the current economic landscape!' }
    ]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, sending]);

    const sendMessage = useCallback(async (text) => {
        const trimmed = (text || input).trim();
        if (!trimmed || sending) return;

        const userMsg = { role: 'user', content: trimmed };
        const allMessages = [...messages, userMsg];
        setMessages(allMessages);
        setInput('');
        setSending(true);

        try {
            // Send only role and content, excluding welcome message
            const apiMessages = allMessages
                .filter((_, i) => i > 0) // skip initial welcome
                .map(m => ({ role: m.role, content: m.content }));

            const { data } = await axios.post('http://localhost:3000/api/ai/chat', {
                messages: apiMessages,
            });

            setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
        } catch (err) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
            }]);
        } finally {
            setSending(false);
        }
    }, [input, messages, sending]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // Simple markdown: **bold**, bullet points, line breaks
    const renderContent = (text) => {
        if (!text) return '';
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/^[-•]\s/gm, '• ')
            .split('\n')
            .join('<br/>');
    };

    return (
        <div className="chat-container">
            {/* Message list */}
            <div className="chat-messages" ref={scrollRef}>
                {messages.map((msg, i) => (
                    <div key={i} className={`chat-msg chat-msg--${msg.role}`}>
                        {msg.role === 'assistant' && (
                            <div className="chat-msg__avatar">✦</div>
                        )}
                        <div
                            className="chat-msg__bubble"
                            dangerouslySetInnerHTML={{ __html: renderContent(msg.content) }}
                        />
                    </div>
                ))}

                {sending && (
                    <div className="chat-msg chat-msg--assistant">
                        <div className="chat-msg__avatar">✦</div>
                        <div className="chat-msg__bubble chat-msg__bubble--typing">
                            <span className="typing-dots">
                                <span /><span /><span />
                            </span>
                            Analyzing markets…
                        </div>
                    </div>
                )}
            </div>

            {/* Quick prompts — show only when few messages */}
            {messages.length <= 1 && (
                <div className="chat-quick-prompts">
                    {QUICK_PROMPTS.map((prompt, i) => (
                        <button
                            key={i}
                            className="chat-quick-btn"
                            onClick={() => sendMessage(prompt)}
                            disabled={sending}
                        >
                            {prompt}
                        </button>
                    ))}
                </div>
            )}

            {/* Input */}
            <div className="chat-input-wrap">
                <textarea
                    className="chat-input"
                    placeholder="Ask about markets, crypto, economics…"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    disabled={sending}
                />
                <button
                    className="chat-send-btn"
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || sending}
                    aria-label="Send"
                >
                    {sending ? '⟳' : '↑'}
                </button>
            </div>
        </div>
    );
}

/* ─── MAIN CONTROL PANEL — COLLAPSIBLE ─────────────────── */
export default function LeftSidebar() {
    const [active, setActive] = useState('news');
    const [collapsed, setCollapsed] = useState(() => window.innerWidth < 768);

    return (
        <>
            {/* Toggle button — always visible */}
            <button
                className={`ls-toggle ${collapsed ? 'ls-toggle--collapsed' : ''}`}
                onClick={() => setCollapsed(c => !c)}
                aria-label={collapsed ? 'Open panel' : 'Close panel'}
            >
                {collapsed ? '▶' : '◀'}
            </button>

            <aside className={`left-sidebar glass ${collapsed ? 'left-sidebar--collapsed' : ''}`}>
                <div className="ls-tabs">
                    {TABS.map(t => (
                        <button key={t.id} className={`ls-tab${active === t.id ? ' ls-tab--active' : ''}`} onClick={() => setActive(t.id)}>
                            <span className="ls-tab__icon">{t.icon}</span>
                            <span className="ls-tab__label">{t.label}</span>
                        </button>
                    ))}
                </div>
                <div className={`ls-content${active === 'chat' ? ' ls-content--chat' : ''}`}>
                    {active === 'news' && <NewsTab />}
                    {active === 'markets' && <MarketsTab />}
                    {active === 'crypto' && <CryptoTab />}
                    {active === 'patterns' && <PatternsTab />}
                    {active === 'chat' && <ChatTab />}
                </div>
            </aside>
        </>
    );
}
