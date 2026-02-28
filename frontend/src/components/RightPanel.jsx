import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const RISK_COLORS = {
    low: { bg: 'rgba(16,185,129,0.12)', border: '#10b981', text: '#10b981', label: 'LOW' },
    moderate: { bg: 'rgba(251,191,36,0.12)', border: '#fbbf24', text: '#fbbf24', label: 'MID' },
    high: { bg: 'rgba(251,146,60,0.12)', border: '#fb923c', text: '#fb923c', label: 'HIGH' },
    critical: { bg: 'rgba(239,68,68,0.12)', border: '#ef4444', text: '#ef4444', label: 'CRIT' },
};

function getRisk(change) {
    const abs = Math.abs(change);
    if (abs > 3) return 'critical';
    if (abs > 2) return 'high';
    if (abs > 1) return 'moderate';
    return 'low';
}

/* ── Tiny SVG Sparkline ──────────────────────────────────── */
function Sparkline({ data, color, width = 80, height = 24 }) {
    if (!data || data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((v - min) / range) * (height - 2) - 1;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg width={width} height={height} className="rpanel__spark" viewBox={`0 0 ${width} ${height}`}>
            <defs>
                <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polygon
                points={`0,${height} ${points} ${width},${height}`}
                fill={`url(#sg-${color.replace('#', '')})`}
            />
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}



export default function RightPanel() {
    const [exchanges, setExchanges] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sparkData, setSparkData] = useState({});
    const prevRisks = useRef({});
    const [alerts, setAlerts] = useState([]);

    useEffect(() => {
        const load = async () => {
            try {
                const { data } = await axios.get(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/exchanges`);
                setExchanges(data);

                // Set sparklines from backend data
                const sparks = {};
                data.forEach(ex => {
                    sparks[ex.id] = ex.sparkline || [];
                });
                setSparkData(sparks);

                // Check for risk level changes (real-time alerts)
                const prev = prevRisks.current;
                data.forEach(ex => {
                    const newRisk = getRisk(ex.percentage_change ?? 0);
                    const oldRisk = prev[ex.id];
                    if (oldRisk && oldRisk !== newRisk) {
                        const rc = RISK_COLORS[newRisk];
                        setAlerts(a => [...a.slice(-4), {
                            id: Date.now() + ex.id,
                            text: `${ex.id} risk changed: ${RISK_COLORS[oldRisk]?.label || `?'} → ${rc.label}`,
                            color: rc.text,
                            ts: Date.now(),
                        }]);
                    }
                    prev[ex.id] = newRisk;
                });
                prevRisks.current = prev;
            } catch {
            } finally {
                setLoading(false);
            }
        };
        load();
        const id = setInterval(load, 30_000);
        return () => clearInterval(id);
    }, []);

    // Auto-dismiss alerts after 5 seconds
    useEffect(() => {
        if (alerts.length === 0) return;
        const timer = setTimeout(() => {
            setAlerts(a => a.filter(al => Date.now() - al.ts < 5000));
        }, 5000);
        return () => clearTimeout(timer);
    }, [alerts]);

    if (loading) {
        return (
            <aside className="rpanel glass">
                <div className="rpanel__header">
                    <span className="rpanel__title">Global Markets</span>
                </div>
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                    <div className="loading-spinner" />
                    Loading…
                </div>
            </aside>
        );
    }

    return (
        <>
            {/* Risk alert toasts */}
            <div className="risk-alerts">
                {alerts.map(al => (
                    <div key={al.id} className="risk-alert" style={{ borderColor: al.color }}>
                        <span className="risk-alert__icon">⚠️</span>
                        <span className="risk-alert__text">{al.text}</span>
                    </div>
                ))}
            </div>

            <aside className="rpanel glass">
                <div className="rpanel__header">
                    <span className="rpanel__title">🌐 Global Markets</span>
                    <span className="rpanel__count">{exchanges.length} exchanges</span>
                </div>

                <div className="rpanel__grid">
                    {exchanges.map((ex) => {
                        const change = ex.percentage_change ?? 0;
                        const up = change >= 0;
                        const risk = getRisk(change);
                        const rc = RISK_COLORS[risk];
                        const sparkColor = up ? '#10b981' : '#ef4444';

                        return (
                            <div key={ex.id} className="rpanel__card">
                                {/* Top row: ID + status */}
                                <div className="rpanel__card-top">
                                    <span className="rpanel__card-id">{ex.id}</span>
                                    <span className={`rpanel__status rpanel__status--${ex.is_open ? 'open' : 'closed'}`}>
                                        {ex.is_open ? '● OPEN' : '○ CLOSED'}
                                    </span>
                                </div>

                                {/* Country + Index */}
                                <div className="rpanel__card-country">{ex.country}</div>
                                <div className="rpanel__card-index">{ex.index_name}</div>

                                {/* Value + Change + Sparkline */}
                                <div className="rpanel__card-row">
                                    <div>
                                        <span className="rpanel__card-val">
                                            {ex.currency}{Number(ex.index_value).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </span>
                                        <span className={`rpanel__card-chg rpanel__card-chg--${up ? 'up' : 'dn'}`} style={{ marginLeft: 6 }}>
                                            {up ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
                                        </span>
                                    </div>
                                    <Sparkline data={sparkData[ex.id]} color={sparkColor} />
                                </div>

                                {/* Risk badge */}
                                <div className="rpanel__card-bottom">
                                    <div
                                        className="rpanel__risk"
                                        style={{ background: rc.bg, borderColor: rc.border, color: rc.text }}
                                    >
                                        RISK: {rc.label}
                                    </div>
                                    {/* Heat bar */}
                                    <div className="rpanel__heat-track" style={{ flex: 1 }}>
                                        <div
                                            className="rpanel__heat-fill"
                                            style={{
                                                width: `${Math.min(100, ex.initial_heat ?? 50)}%`,
                                                background: rc.text,
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </aside>
        </>
    );
}
