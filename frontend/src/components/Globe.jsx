import { useEffect, useRef } from 'react';
import axios from 'axios';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

// No Ion token needed — we use free tile providers
Cesium.Ion.defaultAccessToken = undefined;

/* ── Score → vivid per-country gradient colour ────────────────── */
function scoreToColor(score) {
    if (score >= 88) return { hex: '#ef4444', alpha: 0.78 }; // critical red
    if (score >= 75) return { hex: '#f97316', alpha: 0.72 }; // orange
    if (score >= 60) return { hex: '#10b981', alpha: 0.68 }; // emerald
    if (score >= 40) return { hex: '#06b6d4', alpha: 0.62 }; // cyan
    if (score >= 20) return { hex: '#3b82f6', alpha: 0.58 }; // blue
    return { hex: '#1e40af', alpha: 0.52 }; // deep blue
}

const EXCHANGE_SENTIMENT = {
    positive: '#10b981',
    mild_positive: '#34d399',
    neutral: '#fbbf24',
    mild_negative: '#fb923c',
    negative: '#ef4444',
};
const sentimentHex = (s) => EXCHANGE_SENTIMENT[s] ?? EXCHANGE_SENTIMENT.neutral;

/* ── Comprehensive ISO-A3/name → ISO-A2 mapping ─────────────── */
const NAME_TO_ISO2 = {
    // Common names
    'USA': 'US', 'United States': 'US', 'United States of America': 'US',
    'China': 'CN', 'Japan': 'JP', 'India': 'IN',
    'Germany': 'DE', 'France': 'FR', 'United Kingdom': 'GB',
    'Australia': 'AU', 'Canada': 'CA', 'Brazil': 'BR',
    'South Korea': 'KR', 'Korea': 'KR', 'Republic of Korea': 'KR',
    'Singapore': 'SG', 'Hong Kong': 'HK',
    'Russia': 'RU', 'Russian Federation': 'RU',
    'Saudi Arabia': 'SA', 'South Africa': 'ZA',
    'Mexico': 'MX', 'Switzerland': 'CH', 'Netherlands': 'NL',
    'Italy': 'IT', 'Spain': 'ES', 'Sweden': 'SE',
    'Norway': 'NO', 'Thailand': 'TH', 'Indonesia': 'ID',
    'Malaysia': 'MY', 'Turkey': 'TR', 'Türkiye': 'TR',
    'Argentina': 'AR', 'Nigeria': 'NG', 'Egypt': 'EG',
    'Pakistan': 'PK', 'Poland': 'PL',
    'United Arab Emirates': 'AE', 'Belgium': 'BE',
    'Austria': 'AT', 'Czech Republic': 'CZ', 'Czechia': 'CZ',
    'Greece': 'GR', 'Ireland': 'IE', 'New Zealand': 'NZ',
    'Bangladesh': 'BD', 'Ethiopia': 'ET', 'Finland': 'FI',
    'Denmark': 'DK', 'Portugal': 'PT', 'Israel': 'IL',
    'Ukraine': 'UA', 'Romania': 'RO', 'Chile': 'CL',
    'Colombia': 'CO', 'Vietnam': 'VN', 'Viet Nam': 'VN',
    'Philippines': 'PH', 'Kazakhstan': 'KZ', 'Kuwait': 'KW',
    'Qatar': 'QA', 'Oman': 'OM', 'Peru': 'PE',
    'Afghanistan': 'AF', 'Albania': 'AL', 'Algeria': 'DZ',
    'Angola': 'AO', 'Armenia': 'AM', 'Azerbaijan': 'AZ',
    'Belarus': 'BY', 'Bosnia and Herz.': 'BA', 'Bosnia and Herzegovina': 'BA',
    'Benin': 'BJ', 'Bhutan': 'BT', 'Bolivia': 'BO',
    'Botswana': 'BW', 'Burkina Faso': 'BF', 'Burundi': 'BI',
    'Cameroon': 'CM', 'Central African Rep.': 'CF', 'Central African Republic': 'CF',
    'Chad': 'TD', 'Congo': 'CG', 'Dem. Rep. Congo': 'CG',
    'Democratic Republic of the Congo': 'CG',
    'Republic of the Congo': 'CG',
    'Croatia': 'HR', 'Cuba': 'CU', 'Cyprus': 'CY',
    'Ecuador': 'EC', 'Ghana': 'GH', 'Guatemala': 'GT',
    'Guinea': 'GN', 'Guinea-Bissau': 'GW', 'Honduras': 'HN',
    'Hungary': 'HU', 'Iceland': 'IS', 'Iran': 'IR',
    'Iraq': 'IQ', "Côte d'Ivoire": 'CI', 'Ivory Coast': 'CI',
    'Jamaica': 'JM', 'Jordan': 'JO', 'Kenya': 'KE',
    'Kyrgyzstan': 'KG', 'Laos': 'LA', 'Lao PDR': 'LA',
    'Latvia': 'LV', 'Lebanon': 'LB', 'Lithuania': 'LT',
    'Luxembourg': 'LU', 'Madagascar': 'MG', 'Malawi': 'MW',
    'Mali': 'ML', 'Malta': 'MT', 'Mauritania': 'MR',
    'Mongolia': 'MN', 'Montenegro': 'ME', 'Morocco': 'MA',
    'Mozambique': 'MZ', 'Myanmar': 'MM',
    'Namibia': 'NA', 'Nepal': 'NP', 'Nicaragua': 'NI',
    'Niger': 'NE', 'North Korea': 'KP', 'Dem. Rep. Korea': 'KP',
    'Panama': 'PA', 'Papua New Guinea': 'PG',
    'Paraguay': 'PY', 'Puerto Rico': 'PR',
    'Rwanda': 'RW', 'Senegal': 'SN', 'Serbia': 'RS',
    'Sierra Leone': 'SL', 'Slovakia': 'SK', 'Slovenia': 'SI',
    'Somalia': 'SO', 'S. Sudan': 'SS', 'South Sudan': 'SS',
    'Sri Lanka': 'LK', 'Sudan': 'SD', 'Suriname': 'SR',
    'Syria': 'SY', 'Taiwan': 'TW',
    'Tajikistan': 'TJ', 'Tanzania': 'TZ', 'United Republic of Tanzania': 'TZ',
    'Timor-Leste': 'TL', 'East Timor': 'TL',
    'Tunisia': 'TN', 'Turkmenistan': 'TM', 'Uganda': 'UG',
    'Uruguay': 'UY', 'Uzbekistan': 'UZ', 'Venezuela': 'VE',
    'Yemen': 'YE', 'Zambia': 'ZM', 'Zimbabwe': 'ZW',
    'Libya': 'LY', 'Cambodia': 'KH',
    'Dominican Rep.': 'DO', 'Dominican Republic': 'DO',
    'Eq. Guinea': 'GQ', 'Equatorial Guinea': 'GQ',
    'Eritrea': 'ER', 'Gabon': 'GA', 'Gambia': 'GM',
    'Georgia': 'GE', 'Haiti': 'HT', 'Lesotho': 'LS',
    'Liberia': 'LR', 'Mauritius': 'MU', 'Moldova': 'MD',
    'W. Sahara': 'EH', 'Western Sahara': 'EH',
    'Eswatini': 'SZ', 'Swaziland': 'SZ',
    'Togo': 'TG', 'Trinidad and Tobago': 'TT',
    'N. Cyprus': 'CY',
    'Kosovo': 'XK', 'Somaliland': 'SO',
    'Fr. S. Antarctic Lands': 'TF',
    'Falkland Is.': 'FK', 'Falkland Islands': 'FK',
    'Greenland': 'GL', 'New Caledonia': 'NC',
    'Solomon Is.': 'SB', 'Solomon Islands': 'SB',
    'Vanuatu': 'VU', 'Fiji': 'FJ',
};

/* ── ISO-A3 → ISO-A2 ──────────────────────────────────────── */
const ISO3_TO_ISO2 = {
    'USA': 'US', 'GBR': 'GB', 'CHN': 'CN', 'JPN': 'JP', 'IND': 'IN',
    'DEU': 'DE', 'FRA': 'FR', 'AUS': 'AU', 'CAN': 'CA', 'BRA': 'BR',
    'KOR': 'KR', 'SGP': 'SG', 'HKG': 'HK', 'RUS': 'RU', 'SAU': 'SA',
    'ZAF': 'ZA', 'MEX': 'MX', 'CHE': 'CH', 'NLD': 'NL', 'ITA': 'IT',
    'ESP': 'ES', 'SWE': 'SE', 'NOR': 'NO', 'THA': 'TH', 'IDN': 'ID',
    'MYS': 'MY', 'TUR': 'TR', 'ARG': 'AR', 'NGA': 'NG', 'EGY': 'EG',
    'PAK': 'PK', 'POL': 'PL', 'ARE': 'AE', 'BEL': 'BE', 'AUT': 'AT',
    'CZE': 'CZ', 'GRC': 'GR', 'IRL': 'IE', 'NZL': 'NZ', 'BGD': 'BD',
    'ETH': 'ET', 'FIN': 'FI', 'DNK': 'DK', 'PRT': 'PT', 'ISR': 'IL',
    'UKR': 'UA', 'ROU': 'RO', 'CHL': 'CL', 'COL': 'CO', 'VNM': 'VN',
    'PHL': 'PH', 'KAZ': 'KZ', 'KWT': 'KW', 'QAT': 'QA', 'OMN': 'OM',
    'PER': 'PE', 'AFG': 'AF', 'ALB': 'AL', 'DZA': 'DZ', 'AGO': 'AO',
    'ARM': 'AM', 'AZE': 'AZ', 'BLR': 'BY', 'BIH': 'BA', 'BEN': 'BJ',
    'BTN': 'BT', 'BOL': 'BO', 'BWA': 'BW', 'BFA': 'BF', 'BDI': 'BI',
    'CMR': 'CM', 'CAF': 'CF', 'TCD': 'TD', 'COG': 'CG', 'COD': 'CG',
    'HRV': 'HR', 'CUB': 'CU', 'CYP': 'CY', 'ECU': 'EC', 'GHA': 'GH',
    'GTM': 'GT', 'GIN': 'GN', 'GNB': 'GW', 'HND': 'HN', 'HUN': 'HU',
    'ISL': 'IS', 'IRN': 'IR', 'IRQ': 'IQ', 'CIV': 'CI', 'JAM': 'JM',
    'JOR': 'JO', 'KEN': 'KE', 'KGZ': 'KG', 'LAO': 'LA', 'LVA': 'LV',
    'LBN': 'LB', 'LTU': 'LT', 'LUX': 'LU', 'MDG': 'MG', 'MWI': 'MW',
    'MLI': 'ML', 'MLT': 'MT', 'MRT': 'MR', 'MNG': 'MN', 'MNE': 'ME',
    'MAR': 'MA', 'MOZ': 'MZ', 'MMR': 'MM', 'NAM': 'NA', 'NPL': 'NP',
    'NIC': 'NI', 'NER': 'NE', 'PRK': 'KP', 'PAN': 'PA', 'PNG': 'PG',
    'PRY': 'PY', 'PRI': 'PR', 'RWA': 'RW', 'SEN': 'SN', 'SRB': 'RS',
    'SLE': 'SL', 'SVK': 'SK', 'SVN': 'SI', 'SOM': 'SO', 'SSD': 'SS',
    'LKA': 'LK', 'SDN': 'SD', 'SUR': 'SR', 'SYR': 'SY', 'TWN': 'TW',
    'TJK': 'TJ', 'TZA': 'TZ', 'TLS': 'TL', 'TUN': 'TN', 'TKM': 'TM',
    'UGA': 'UG', 'URY': 'UY', 'UZB': 'UZ', 'VEN': 'VE', 'YEM': 'YE',
    'ZMB': 'ZM', 'ZWE': 'ZW', 'LBY': 'LY', 'KHM': 'KH', 'DOM': 'DO',
    'GNQ': 'GQ', 'ERI': 'ER', 'GAB': 'GA', 'GMB': 'GM', 'GEO': 'GE',
    'HTI': 'HT', 'LSO': 'LS', 'LBR': 'LR', 'MUS': 'MU', 'MDA': 'MD',
    'ESH': 'EH', 'SWZ': 'SZ', 'TGO': 'TG', 'TTO': 'TT',
    'GRL': 'GL', 'NCL': 'NC', 'SLB': 'SB', 'VUT': 'VU', 'FJI': 'FJ',
    'FLK': 'FK', 'ATF': 'TF', 'XKX': 'XK', '-99': null,
};

function resolveIso2(entity) {
    const props = entity.properties;
    // Try ISO_A2 directly
    const a2 = props?.iso_a2?.getValue?.() ?? props?.ISO_A2?.getValue?.();
    if (a2 && a2 !== '-99' && a2.length === 2) return a2;

    // Try ISO_A3 → ISO_A2
    const a3 = props?.iso_a3?.getValue?.() ?? props?.ISO_A3?.getValue?.();
    if (a3 && ISO3_TO_ISO2[a3]) return ISO3_TO_ISO2[a3];

    // Try name mapping
    const name = props?.name?.getValue?.() ?? props?.NAME?.getValue?.()
        ?? props?.ADMIN?.getValue?.() ?? props?.admin?.getValue?.() ?? '';
    if (NAME_TO_ISO2[name]) return NAME_TO_ISO2[name];

    // Try 'id' field (some GeoJSON uses this)
    const id = props?.id?.getValue?.();
    if (id && id.length === 2) return id;
    if (id && ISO3_TO_ISO2[id]) return ISO3_TO_ISO2[id];

    return null;
}

export default function Globe({ onExchangeSelect, mapMode = '3d' }) {
    const containerRef = useRef(null);
    const tooltipRef = useRef(null);
    const viewerRef = useRef(null);

    useEffect(() => {
        if (!containerRef.current) return;
        let destroyed = false;

        /* ── Hidden credit container to remove Cesium branding ──── */
        const creditDiv = document.createElement('div');
        creditDiv.style.display = 'none';
        containerRef.current.appendChild(creditDiv);

        /* ── Viewer ──────────────────────────────────────────────── */
        const viewer = new Cesium.Viewer(containerRef.current, {
            imageryProvider: false,
            animation: false,
            baseLayerPicker: false,
            fullscreenButton: false,
            geocoder: false,
            homeButton: false,
            infoBox: false,
            sceneModePicker: false,
            selectionIndicator: false,
            timeline: false,
            navigationHelpButton: false,
            scene3DOnly: false,
            terrainProvider: new Cesium.EllipsoidTerrainProvider(),
            msaaSamples: 4,
            creditContainer: creditDiv,
        });

        viewerRef.current = viewer;
        const scene = viewer.scene;
        const globe = scene.globe;

        /* ── Dark-themed base map (CartoDB Dark Matter — free, no key) ── */
        const darkTiles = new Cesium.UrlTemplateImageryProvider({
            url: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
            credit: new Cesium.Credit('© CartoDB © OpenStreetMap contributors'),
            maximumLevel: 18,
            tileWidth: 512,
            tileHeight: 512,
        });
        const baseLayer = viewer.imageryLayers.addImageryProvider(darkTiles);
        baseLayer.brightness = 0.55;
        baseLayer.saturation = 0.6;

        /* ── Globe aesthetics ────────────────────────────────────── */
        globe.enableLighting = false;
        globe.baseColor = Cesium.Color.fromCssColorString('#050f1a');
        globe.showGroundAtmosphere = true;

        scene.backgroundColor = Cesium.Color.fromCssColorString('#020912');

        scene.skyAtmosphere.show = true;
        scene.skyAtmosphere.hueShift = 0.08;
        scene.skyAtmosphere.saturationShift = -0.25;
        scene.skyAtmosphere.brightnessShift = -0.05;

        // Stars
        scene.skyBox = new Cesium.SkyBox({
            sources: {
                positiveX: Cesium.buildModuleUrl('Assets/Textures/SkyBox/tycho2t3_80_px.jpg'),
                negativeX: Cesium.buildModuleUrl('Assets/Textures/SkyBox/tycho2t3_80_mx.jpg'),
                positiveY: Cesium.buildModuleUrl('Assets/Textures/SkyBox/tycho2t3_80_py.jpg'),
                negativeY: Cesium.buildModuleUrl('Assets/Textures/SkyBox/tycho2t3_80_my.jpg'),
                positiveZ: Cesium.buildModuleUrl('Assets/Textures/SkyBox/tycho2t3_80_pz.jpg'),
                negativeZ: Cesium.buildModuleUrl('Assets/Textures/SkyBox/tycho2t3_80_mz.jpg'),
            }
        });

        if (scene.postProcessStages.fxaa) scene.postProcessStages.fxaa.enabled = true;

        /* ── Country heatmap via canvas imagery overlay ────────────── */
        const paintCountries = async () => {
            if (destroyed) return;
            try {
                const [actRes, geoRes] = await Promise.all([
                    axios.get(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/country-activity`),
                    axios.get('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson'),
                ]);

                if (destroyed) return;

                const activityMap = actRes.data;
                const features = geoRes.data.features || [];

                // Create an equirectangular canvas
                const W = 4096, H = 2048;
                const canvas = document.createElement('canvas');
                canvas.width = W;
                canvas.height = H;
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, W, H);

                // Project lon/lat → canvas pixel
                const toX = (lon) => ((lon + 180) / 360) * W;
                const toY = (lat) => ((90 - lat) / 180) * H;

                features.forEach(feature => {
                    if (!feature.geometry) return;

                    // Resolve ISO-A2
                    const props = feature.properties || {};
                    const name = props.name || props.NAME || props.ADMIN || '';
                    const iso2 = NAME_TO_ISO2[name]
                        || (props.iso_a2 && props.iso_a2 !== '-99' ? props.iso_a2 : null)
                        || (props.ISO_A2 && props.ISO_A2 !== '-99' ? props.ISO_A2 : null)
                        || (props.id && props.id.length === 2 ? props.id : null)
                        || (props.iso_a3 ? ISO3_TO_ISO2[props.iso_a3] : null)
                        || (props.ISO_A3 ? ISO3_TO_ISO2[props.ISO_A3] : null)
                        || null;

                    const score = iso2 ? (activityMap[iso2] ?? 25) : 25;
                    const { hex, alpha } = scoreToColor(score);

                    // Convert hex to rgba for canvas
                    const r = parseInt(hex.slice(1, 3), 16);
                    const g = parseInt(hex.slice(3, 5), 16);
                    const b = parseInt(hex.slice(5, 7), 16);
                    const fillStyle = `rgba(${r},${g},${b},${alpha})`;
                    const strokeStyle = `rgba(56,189,248,0.35)`;

                    const drawPolygon = (ring) => {
                        if (!ring || ring.length < 3) return;
                        ctx.beginPath();
                        ctx.moveTo(toX(ring[0][0]), toY(ring[0][1]));
                        for (let i = 1; i < ring.length; i++) {
                            ctx.lineTo(toX(ring[i][0]), toY(ring[i][1]));
                        }
                        ctx.closePath();
                        ctx.fillStyle = fillStyle;
                        ctx.fill();
                        ctx.strokeStyle = strokeStyle;
                        ctx.lineWidth = 1.2;
                        ctx.stroke();
                    };

                    if (feature.geometry.type === 'MultiPolygon') {
                        feature.geometry.coordinates.forEach(polygon => {
                            if (polygon[0]) drawPolygon(polygon[0]);
                        });
                    } else if (feature.geometry.type === 'Polygon') {
                        if (feature.geometry.coordinates[0]) {
                            drawPolygon(feature.geometry.coordinates[0]);
                        }
                    }
                });

                if (destroyed) return;

                // Convert canvas to an imagery layer
                const dataUrl = canvas.toDataURL('image/png');
                const provider = new Cesium.SingleTileImageryProvider({
                    url: dataUrl,
                    rectangle: Cesium.Rectangle.fromDegrees(-180, -90, 180, 90),
                    tileWidth: W,
                    tileHeight: H,
                });
                const heatLayer = viewer.imageryLayers.addImageryProvider(provider);
                heatLayer.alpha = 0.85;

            } catch (e) {
                console.warn('Country heatmap failed:', e.message);
            }
        };
        paintCountries();

        /* ── Glow-point builder ──────────────────────────────────── */
        const addGlowPoint = ({ id, position, color, size, label, data }) => {
            // 3-layer concentric glow
            viewer.entities.add({ position, point: { pixelSize: size * 3.5, color: color.withAlpha(0.10), disableDepthTestDistance: Number.POSITIVE_INFINITY } });
            viewer.entities.add({ position, point: { pixelSize: size * 2.0, color: color.withAlpha(0.25), disableDepthTestDistance: Number.POSITIVE_INFINITY } });
            return viewer.entities.add({
                id,
                position,
                point: {
                    pixelSize: size,
                    color: color.withAlpha(0.96),
                    outlineColor: Cesium.Color.WHITE.withAlpha(0.5),
                    outlineWidth: 1.8,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    scaleByDistance: new Cesium.NearFarScalar(1.5e6, 1.3, 1.5e8, 0.4),
                },
                label: {
                    text: label,
                    font: 'bold 11px Inter, sans-serif',
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    fillColor: Cesium.Color.WHITE,
                    outlineColor: Cesium.Color.fromCssColorString('#020912'),
                    outlineWidth: 5,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(0, -(size + 10)),
                    distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 9e6),
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    translucencyByDistance: new Cesium.NearFarScalar(4e6, 1, 9e6, 0),
                },
                description: data ? JSON.stringify(data) : undefined,
            });
        };

        /* ── Fetch & plot exchanges ──────────────────────────────── */
        axios.get(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/exchanges`).then(({ data }) => {
            if (destroyed) return;
            data.forEach(ex => {
                const hex = sentimentHex(ex.initial_sentiment);
                const color = Cesium.Color.fromCssColorString(hex);
                const size = Math.round(12 + (ex.initial_heat ?? 50) / 11);
                addGlowPoint({ id: ex.id, position: Cesium.Cartesian3.fromDegrees(ex.longitude, ex.latitude), color, size, label: ex.id, data: ex });
            });
        }).catch(console.error);

        /* ── Hot event pins ─────────────────────────────────────── */
        axios.get(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/events/hot`).then(({ data }) => {
            if (destroyed) return;
            data.forEach(ev => {
                addGlowPoint({
                    position: Cesium.Cartesian3.fromDegrees(ev.longitude, ev.latitude, 100000),
                    color: Cesium.Color.fromCssColorString('#facc15'),
                    size: 9,
                    label: '🔥 ' + ev.title,
                });
            });
        }).catch(console.error);

        /* ── Click handler ──────────────────────────────────────── */
        const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
        handler.setInputAction(mv => {
            const picked = scene.pick(mv.position);
            if (Cesium.defined(picked) && picked.id?.description) {
                try {
                    const data = JSON.parse(picked.id.description.getValue());
                    // Defer React state update to avoid conflicting with Cesium's render loop
                    setTimeout(() => onExchangeSelect(data), 0);
                } catch (_) { }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        /* ── Hover tooltip handler ─────────────────────────────── */
        handler.setInputAction(mv => {
            const tooltip = tooltipRef.current;
            if (!tooltip) return;
            const picked = scene.pick(mv.endPosition);
            if (Cesium.defined(picked) && picked.id?.description) {
                try {
                    const d = JSON.parse(picked.id.description.getValue());
                    const chg = d.percentage_change ?? 0;
                    const up = chg >= 0;
                    const absChg = Math.abs(chg);
                    const risk = absChg > 3 ? 'CRITICAL' : absChg > 2 ? 'HIGH' : absChg > 1 ? 'MID' : 'LOW';
                    const riskClr = absChg > 3 ? '#ef4444' : absChg > 2 ? '#fb923c' : absChg > 1 ? '#fbbf24' : '#10b981';
                    tooltip.innerHTML = `
                        < div style = "font-weight:800;font-size:14px;color:#f1f5f9;margin-bottom:3px" > ${d.id}</div >
                        <div style="font-size:11px;color:#94a3b8;margin-bottom:4px">${d.index_name} • ${d.country}</div>
                        <div style="display:flex;align-items:center;gap:8px">
                            <span style="font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700">${d.currency || ''}${Number(d.index_value).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            <span style="font-size:12px;font-weight:700;color:${up ? '#10b981' : '#ef4444'}">${up ? '▲' : '▼'} ${absChg.toFixed(2)}%</span>
                        </div>
                        <div style="margin-top:4px;font-size:9px;font-weight:800;letter-spacing:0.1em;padding:2px 6px;border-radius:3px;display:inline-block;background:${riskClr}22;color:${riskClr};border:1px solid ${riskClr}55">RISK: ${risk}</div>
                        <div style="margin-top:3px;font-size:10px;color:${d.is_open ? '#10b981' : '#475569'}">${d.is_open ? '● OPEN' : '○ CLOSED'}</div>
                    `;
                    tooltip.style.display = 'block';
                    tooltip.style.left = (mv.endPosition.x + 16) + 'px';
                    tooltip.style.top = (mv.endPosition.y - 10) + 'px';
                } catch (_) {
                    tooltip.style.display = 'none';
                }
            } else {
                tooltip.style.display = 'none';
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        /* ── Initial camera fly-in ──────────────────────────────── */
        viewer.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(20, 15, 24000000) });
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(20, 15, 13500000),
            duration: 4,
            easingFunction: Cesium.EasingFunction.QUADRATIC_OUT,
        });

        return () => {
            destroyed = true;
            viewerRef.current = null;
            if (!viewer.isDestroyed()) viewer.destroy();
        };
    }, []);

    /* ── Morph between 2D / 3D when mapMode changes ────────── */
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer || viewer.isDestroyed()) return;
        const scene = viewer.scene;
        if (mapMode === '2d' && scene.mode !== Cesium.SceneMode.SCENE2D) {
            scene.morphTo2D(1.5);
        } else if (mapMode === '3d' && scene.mode !== Cesium.SceneMode.SCENE3D) {
            scene.morphTo3D(1.5);
        }
    }, [mapMode]);

    return (
        <div ref={containerRef} style={{ position: 'absolute', inset: 0 }}>
            <div
                ref={tooltipRef}
                className="globe-tooltip"
                style={{ display: 'none' }}
            />
        </div>
    );
}
