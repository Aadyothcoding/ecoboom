import { useState, useEffect } from 'react';

const CLOCKS = [
    { city: 'NYC', tz: 'America/New_York', flag: '🇺🇸' },
    { city: 'LDN', tz: 'Europe/London', flag: '🇬🇧' },
    { city: 'FRA', tz: 'Europe/Berlin', flag: '🇩🇪' },
    { city: 'MUM', tz: 'Asia/Kolkata', flag: '🇮🇳' },
    { city: 'TYO', tz: 'Asia/Tokyo', flag: '🇯🇵' },
];

function formatTime(date, timeZone) {
    try {
        return new Intl.DateTimeFormat('en-GB', {
            timeZone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).format(date);
    } catch {
        return '--:--';
    }
}

function formatSeconds(date, timeZone) {
    try {
        return new Intl.DateTimeFormat('en-GB', {
            timeZone,
            second: '2-digit',
        }).format(date);
    } catch {
        return '--';
    }
}

function isMarketOpen(tz) {
    try {
        const hours = parseInt(new Intl.DateTimeFormat('en-GB', {
            timeZone: tz, hour: '2-digit', hour12: false,
        }).format(new Date()));
        const day = new Date().toLocaleDateString('en-US', { timeZone: tz, weekday: 'short' });
        if (day === 'Sat' || day === 'Sun') return false;
        return hours >= 9 && hours < 17;
    } catch { return false; }
}

export default function MarketClock() {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    return (
        <header className="mclock">
            {/* Logo */}
            <div className="mclock__logo">
                <div className="mclock__pulse" />
                <span className="grad-text">EcoBoom</span>
            </div>

            {/* Clock chips */}
            <div className="mclock__row">
                {CLOCKS.map(({ city, tz, flag }) => {
                    const open = isMarketOpen(tz);
                    return (
                        <div key={tz} className={`mclock__chip ${open ? 'mclock__chip--open' : ''}`}>
                            <span className="mclock__flag">{flag}</span>
                            <div className="mclock__col">
                                <span className="mclock__city">{city}</span>
                                <span className="mclock__time">
                                    {formatTime(now, tz)}
                                    <span className="mclock__sec">:{formatSeconds(now, tz)}</span>
                                </span>
                            </div>
                            <span className={`mclock__dot ${open ? 'mclock__dot--on' : ''}`} />
                        </div>
                    );
                })}
            </div>

            {/* UTC badge */}
            <div className="mclock__utc">
                <span className="mclock__utc-label">UTC</span>
                <span className="mclock__utc-time">{now.toISOString().substring(11, 19)}</span>
            </div>
        </header>
    );
}
