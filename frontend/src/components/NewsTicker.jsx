import { useState, useEffect } from 'react';
import axios from 'axios';

export default function NewsTicker() {
    const [news, setNews] = useState([]);

    useEffect(() => {
        const fetchNews = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/news/global`);
                setNews(res.data);
            } catch (err) {
                console.error(`NewsTicker fetch error:', err);
            }
        };
        fetchNews();
        const id = setInterval(fetchNews, 90_000);
        return () => clearInterval(id);
    }, []);

    // Always show at least placeholder items while loading
    const items = news.length > 0
        ? news
        : [{ headline: 'Loading live market feed — please wait…', breaking_indicator: false }];

    return (
        <div className="news-ticker">
            <div className="news-ticker__label">
                <span className="news-ticker__label-dot" />
                Live&nbsp;Markets
            </div>

            <div className="news-ticker__track">
                <div className="news-ticker__scroll">
                    {/* Duplicate for seamless loop */}
                    {[...items, ...items].map((item, i) => (
                        <span
                            key={i}
                            className={`ticker__item${item.breaking_indicator ? ' ticker__item--breaking' : ''}`}
                        >
                            <span className="ticker__headline">{item.headline}</span>
                            <span className="ticker__sep" />
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}
