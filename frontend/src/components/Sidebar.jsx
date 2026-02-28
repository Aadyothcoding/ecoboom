import { useState, useEffect, Component } from 'react';
import axios from 'axios';
import {
    AreaChart, Area, Tooltip, ResponsiveContainer, YAxis,
} from 'recharts';



const RISK_CLASS = {
    'Low Risk': 'risk-low',
    'Moderate Risk': 'risk-mod',
    'High Risk': 'risk-high',
    'Critical Economic Danger': 'risk-crit',
};

const riskClass = (rawLabel) => {
    const label = String(rawLabel || '');
    if (!label) return '';
    for (const key of Object.keys(RISK_CLASS)) {
        if (label.includes(key.split(' ')[0])) return RISK_CLASS[key];
    }
    return '';
};

/* ── Error Boundary to prevent blank screen ──────────────── */
class SidebarErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(err) {
        console.error('Sidebar render error:', err);
    }
    render() {
        if (this.state.hasError) {
            return (
                <aside className="sidebar glass">
                    <div className="sidebar__inner" style={{ padding: 24 }}>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                            Something went wrong rendering this panel.
                        </p>
                        <button
                            className="sidebar__close"
                            onClick={() => { this.setState({ hasError: false }); this.props.onClose?.(); }}
                            style={{ marginTop: 12 }}
                        >
                            ✕ Close
                        </button>
                    </div>
                </aside>
            );
        }
        return this.props.children;
    }
}

/* ── Inner Sidebar Content ───────────────────────────────── */
function SidebarContent({ exchange, onClose }) {
    const [news, setNews] = useState([]);
    const [ai, setAi] = useState(null);
    const [loading, setLoading] = useState(false);
    const [chartData, setChartData] = useState([]);

    useEffect(() => {
        if (!exchange) return;
        setAi(null);
        setNews([]);

        const load = async () => {
            setLoading(true);
            const sparkPoints = (exchange.sparkline || []).map((v, i) => ({ i, v }));
            setChartData(sparkPoints);
            try {
                const newsRes = await axios.get(
                    `${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/news/${encodeURIComponent(exchange.country)}`
                );
                setNews(newsRes.data);

                if (newsRes.data.length > 0) {
                    const aiRes = await axios.post(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/ai/sentiment`, {
                        headline: newsRes.data[0].headline,
                        indexData: {
                            index: exchange.index_name,
                            value: exchange.index_value,
                            change: exchange.percentage_change,
                        },
                    });
                    setAi(aiRes.data);
                }
            } catch (err) {
                console.error('Sidebar load error:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [exchange]);

    if (!exchange) return null;

    const isUp = exchange.percentage_change >= 0;
    const lineColor = isUp ? 'var(--green-strong)' : 'var(--red)';
    const gradId = `grad-${exchange.id}`;

    const heatColor = ai
        ? ai.sentiment_polarity === 'positive' ? 'var(--green-strong)'
            : ai.sentiment_polarity === 'negative' ? 'var(--red)'
                : 'var(--yellow)'
        : 'var(--yellow)';

    return (
        <aside className="sidebar glass">
            <div className="sidebar__inner">

                {/* ── Header ─────────────────────────────────────── */}
                <div className="sidebar__header">
                    <div>
                        <div className="sidebar__exchange-id grad-text">{exchange.id}</div>
                        <div className="sidebar__exchange-name">{exchange.name} • {exchange.country}</div>
                    </div>
                    <button className="sidebar__close" onClick={onClose} aria-label="Close">×</button>
                </div>

                {/* ── Status / Index Card ─────────────────────────── */}
                <div className="sidebar__status-card">
                    <div>
                        <div className="sidebar__index-name">{exchange.index_name}</div>
                        <div className="sidebar__index-value">
                            {exchange.currency}{Number(exchange.index_value).toLocaleString()}
                        </div>
                        <div className={`sidebar__change sidebar__change--${isUp ? 'up' : 'down'}`}>
                            {isUp ? '▲' : '▼'} {Math.abs(exchange.percentage_change).toFixed(2)}%
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div className={`sidebar__badge sidebar__badge--${exchange.is_open ? 'open' : 'closed'}`}>
                            <span style={{
                                width: 6, height: 6, borderRadius: '50%',
                                background: 'currentColor',
                                display: 'inline-block',
                                animation: exchange.is_open ? 'pulse-dot 1.2s infinite' : 'none',
                            }} />
                            {exchange.is_open ? 'OPEN' : 'CLOSED'}
                        </div>
                        <div className="sidebar__hours">
                            {exchange.open_time} – {exchange.close_time} local
                        </div>
                    </div>
                </div>

                {/* ── Mini Sparkline ──────────────────────────────── */}
                <div className="sidebar__chart-wrap">
                    <ResponsiveContainer width="100%" height={90}>
                        <AreaChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                            <defs>
                                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={lineColor} stopOpacity={0.5} />
                                    <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <YAxis domain={['auto', 'auto']} hide />
                            <Tooltip
                                contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                                itemStyle={{ color: lineColor }}
                                labelFormatter={() => ''}
                                formatter={(v) => [v.toFixed(0), exchange.index_name]}
                            />
                            <Area
                                type="monotone"
                                dataKey="v"
                                stroke={lineColor}
                                strokeWidth={2}
                                fill={`url(#${gradId})`}
                                dot={false}
                                activeDot={{ r: 4, fill: lineColor }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* ── Loading ─────────────────────────────────────── */}
                {loading && (
                    <div className="sidebar__loading">
                        <div className="loading-spinner" />
                        Fetching market intelligence…
                    </div>
                )}

                {/* ── AI Pulse Panel ──────────────────────────────── */}
                {!loading && ai && (
                    <div className="ai-panel">
                        <div className="ai-panel__header">
                            <span className="ai-panel__header-icon">✦</span>
                            <span className="ai-panel__title">AI Pulse Analysis</span>
                        </div>
                        <p className="ai-panel__summary">{ai.one_line_summary}</p>

                        <div className="ai-panel__grid">
                            <div className="ai-panel__cell">
                                <div className="ai-panel__cell-label">Trend Forecast</div>
                                <div className="ai-panel__cell-value">{ai.boom_probability}</div>
                            </div>
                            <div className="ai-panel__cell">
                                <div className="ai-panel__cell-label">Risk Level</div>
                                <div className={`ai-panel__cell-value ai-panel__cell-value--${riskClass(ai.economic_risk_level)}`}>
                                    {ai.economic_risk_level}
                                </div>
                            </div>
                        </div>

                        <div className="heat-bar-wrap">
                            <div className="heat-bar-labels">
                                <span>HEAT INTENSITY</span>
                                <span>{ai.heat_score} / 100</span>
                            </div>
                            <div className="heat-bar-track">
                                <div
                                    className="heat-bar-fill"
                                    style={{ width: `${Math.min(100, ai.heat_score ?? 50)}%`, background: heatColor, boxShadow: `0 0 8px ${heatColor}` }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Regional News ────────────────────────────────── */}
                {!loading && news.length > 0 && (
                    <div>
                        <div className="sidebar__news-title">Trending {exchange.country} News</div>
                        <div className="news-list">
                            {news.map((item, i) => (
                                <div key={i} className={`news-card news-card--${item.breaking_indicator ? 'breaking' : 'normal'}`}>
                                    <div className="news-card__headline">{item.headline}</div>
                                    <div className="news-card__meta">
                                        {item.timestamp
                                            ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                            : 'Live'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </aside>
    );
}

/* ── Exported wrapper with error boundary + key-based remount ── */
export default function Sidebar({ exchange, onClose }) {
    if (!exchange) return null;
    return (
        <SidebarErrorBoundary onClose={onClose} key={exchange.id}>
            <SidebarContent exchange={exchange} onClose={onClose} />
        </SidebarErrorBoundary>
    );
}
