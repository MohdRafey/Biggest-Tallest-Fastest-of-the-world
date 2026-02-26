const GEOJSON_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/main/data/countries.geojson';

const NATURAL_EARTH_ADMIN1_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson';

const PACK_ISO3 = {
    usa: 'USA', ind: 'IND', jpn: 'JPN', aus: 'AUS', can: 'CAN',
    deu: 'DEU', gbr: 'GBR', fra: 'FRA', esp: 'ESP', rus: 'RUS', chn: 'CHN',
};

let _naturalEarthAdmin1Cache = null;

const themes = {
    bright:     { water: '#748B97', land: '#f8f4f0', background: '#ffffff', border: '#cccccc' },
    dark:       { water: '#748B97', land: '#1e1e1e', background: '#000000', border: '#ffffff' },
    sepia:      { water: '#9ab09a', land: '#e3d5b8', background: '#dccba0', border: '#8e7a5e' },
    colorful:   { water: '#3498db', land: '#f8f4f0', background: '#2ecc71', border: '#ffffff' },
    oceanic:    { water: '#1b3a4b', land: '#cfd8dc', background: '#eceff1', border: '#90a4ae' },
    midnight:   { water: '#0a1628', land: '#0d2137', background: '#060e1a', border: '#1a4a6b' },
    slate:      { water: '#4a6274', land: '#2d3748', background: '#1a202c', border: '#718096' },
    sand:       { water: '#b5c4b1', land: '#f2e8d5', background: '#ede0c4', border: '#a0856c' },
    forest:     { water: '#4a7c6f', land: '#2d5a3d', background: '#1e3d2a', border: '#5a9e6f' },
    arctic:     { water: '#b8d4e8', land: '#e8f4f8', background: '#f0f8ff', border: '#7bacc4' },
    ember:      { water: '#2c1810', land: '#3d2314', background: '#1a0f0a', border: '#c4500a' },
    monochrome: { water: '#555555', land: '#333333', background: '#111111', border: '#888888' },
    paper:      { water: '#c8d8e0', land: '#f5f0e8', background: '#faf7f2', border: '#8b7355' },
    neon:       { water: '#0a0a0a', land: '#111111', background: '#000000', border: '#00ff88' },
    dusk:       { water: '#2d1b4e', land: '#3d2460', background: '#1a0f2e', border: '#8b5cf6' },
};

let map;
let activeMarkers = [];       // all live maplibre Marker objects
let persistedLayers = [];     // { layerId, outlineId, sourceId, marker } kept after handoff
let regionalData = { type: 'FeatureCollection', features: [] };
let selectedRegions = new Set();

// ─── CUSTOMIZER: read live values from the Customize tab ─────────────────────
function getCustomizer() {
    const v = id => document.getElementById(id);
    return {
        // Masters
        masterFactCard:  v('cx-master-fact').checked,
        masterDetails:   v('cx-master-details').checked,
        masterLabel:     v('cx-master-label').checked,
        recencyColor:    v('cx-recency-color').value || '#7f8c8d',

        // Fact card styles
        headingSize:     v('cx-heading-size').value   || '20',
        headingColor:    v('cx-heading-color').value  || '#1a1a1a',
        detailsSize:     v('cx-details-size').value   || '13',
        detailsColor:    v('cx-details-color').value  || '#555555',

        // Label styles
        labelSize:       v('cx-label-size').value     || '22',
        labelColor:      v('cx-label-color').value    || '#ffffff',
        labelShadow:     v('cx-label-shadow').checked,
    };
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    map = new maplibregl.Map({
        container: 'map',
        style: 'https://tiles.openfreemap.org/styles/bright',
        center: [0, 20],
        zoom: 2,
        maxZoom: 10
    });
    map.on('load', () => { applyTheme(); });
});

// ─── PANEL TOGGLE ─────────────────────────────────────────────────────────────
function toggleConfig() {
    const wrapper = document.getElementById('panel-wrapper');
    wrapper.classList.toggle('hidden');
    document.getElementById('panelArrow').innerHTML =
        wrapper.classList.contains('hidden') ? '&#8250;' : '&#8249;';
}

// ─── TAB SWITCHING ────────────────────────────────────────────────────────────
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('tab-hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('tab-active'));
    document.getElementById('tab-' + tabName).classList.remove('tab-hidden');
    document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('tab-active');
}

// ─── THEME ────────────────────────────────────────────────────────────────────
function cleanMap() {
    if (!map.getSource('engine-source')) {
        map.addSource('engine-source', { type: 'geojson', data: GEOJSON_URL });
    }
    const hide = ['label', 'road', 'highway', 'transit', 'bridge', 'tunnel', 'rail', 'ferry'];
    map.getStyle().layers.forEach(layer => {
        if (hide.some(h => layer.id.toLowerCase().includes(h))) {
            map.setLayoutProperty(layer.id, 'visibility', 'none');
        }
    });
}

function applyTheme() {
    const themeName = document.getElementById('mapTheme').value;
    const config = themes[themeName];
    document.getElementById('map').className = themeName === 'dark' ? 'theme-dark' : 'theme-light';

    if (map.getLayer('water'))      map.setPaintProperty('water', 'fill-color', config.water);
    if (map.getLayer('background')) map.setPaintProperty('background', 'background-color', config.background);

    map.getStyle().layers.forEach(layer => {
        const id = layer.id.toLowerCase();
        if (id.includes('land') || id.includes('natural')) {
            try { map.setPaintProperty(layer.id, 'fill-color', config.land); } catch(e){}
        }
        if (id.includes('admin') || id.includes('boundary')) {
            try {
                map.setPaintProperty(layer.id, 'line-color', config.border);
                map.setPaintProperty(layer.id, 'line-opacity', 1);
                map.setPaintProperty(layer.id, 'line-width', 0.8);
            } catch(e){}
        }
    });
    cleanMap();
}

// ─── CORE ENGINE ──────────────────────────────────────────────────────────────
async function runEngine() {
    clearPreviousTour();
    await loadRegionalPacks();

    const mode  = document.getElementById('navMode').value;
    const speed = parseFloat(document.getElementById('speed').value);
    const lines = document.getElementById('locationInput').value.split('\n');

    map.setZoom(parseFloat(document.getElementById('startZoom').value));
    map.setMaxZoom(parseFloat(document.getElementById('maxZoom').value));

    for (let line of lines) {
        if (!line.trim()) continue;
        const parts = line.split(',').map(s => s.trim());
        if (mode === 'polygon') {
            await handlePolygonNavigation(parts, speed);
        } else {
            await handleCityNavigation(parts, speed);
        }
    }
}

// ─── POLYGON HANDLER ──────────────────────────────────────────────────────────
// CSV columns: Type, Name, Color, BorderWidth, Label, ShowFact, Persist, PersistLabel, RecencyMode, Fact, Details
async function handlePolygonNavigation(parts, speed) {
    const [type, name, color, fact, details,
           borderWidth, labelFlag, showFactFlag,
           persistFlag, persistLabelFlag, recencyFlag] = parts;

    const cx       = getCustomizer();
    const stayTime = parseInt(document.getElementById('stayDuration').value || 5) * 1000;

    // Per-row flags — respect the customizer masters first
    const showLabel   = cx.masterLabel    && parseBool(labelFlag);
    const showFact    = cx.masterFactCard && parseBool(showFactFlag);
    const persist     = parseBool(persistFlag);
    const persistLabel = persist && parseBool(persistLabelFlag);
    const recencyMode = persist && parseBool(recencyFlag);

    addLog(`Navigating to ${type}: ${name}`, 'info');
    const result = await findFeature(name, type);

    if (!result || !result.feature) {
        addLog(`✘ Failed to find ${name}`, 'error');
        return;
    }

    const { feature, source: sourceId } = result;
    const officialName = feature.properties.name || feature.properties.NAME_1 || name;
    const layerId      = `highlight-${name.replace(/\s+/g, '-')}-${Date.now()}`;
    let   currentMarker = null;

    if (feature.geometry.type === 'Point') {
        addLog(`⚠ ${name} resolved to a Point — flying there instead`, 'error');
        map.flyTo({ center: feature.geometry.coordinates, zoom: 10, speed });
    } else {
        const bounds = getBounds(feature);
        map.fitBounds(bounds, { padding: 150, speed, essential: true });

        await new Promise(resolve => {
            let moved = false;
            const check = () => { if (moved && map.isSourceLoaded(sourceId)) resolve(); };
            map.once('moveend', () => { moved = true; check(); });
            setTimeout(resolve, 3000);
        });

        if (showFact) showFactBox(fact, details, color, cx);
        addHighlightLayer(layerId, officialName, color, borderWidth, sourceId);

        if (showLabel) {
            currentMarker = createPolygonLabel(name, bounds.getCenter(), cx);
        }

        addLog(`Highlighted ${officialName}`, 'info');
    }

    await new Promise(r => setTimeout(r, stayTime));

    // ── Handoff logic ──────────────────────────────────────────────────────────
    hideFactBox();

    if (!persist) {
        // Full clear
        removeHighlightLayer(layerId, sourceId);
        if (currentMarker) removeMarker(currentMarker);
        addLog(`Cleared ${name}`, 'info');

    } else if (recencyMode) {
        // Repaint to recency color, always drop label
        repaintLayer(layerId, cx.recencyColor);
        if (currentMarker) removeMarker(currentMarker);
        persistedLayers.push({ layerId, outlineId: layerId + '-outline', sourceId, marker: null });
        addLog(`${name} → recency color`, 'info');

    } else {
        // Keep original color, conditionally keep label
        if (!persistLabel && currentMarker) removeMarker(currentMarker);
        const keptMarker = persistLabel ? currentMarker : null;
        persistedLayers.push({ layerId, outlineId: layerId + '-outline', sourceId, marker: keptMarker });
        addLog(`${name} persisted`, 'info');
    }
}

// ─── CITY HANDLER ─────────────────────────────────────────────────────────────
// CSV columns: Origin, Name, Color, Fact, Details, Persist
async function handleCityNavigation(parts, speed) {
    const [origin, name, color, fact, details, persistFlag] = parts;
    const cx      = getCustomizer();
    const persist = parseBool(persistFlag);

    const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(name + ', ' + origin)}&limit=1`;
    try {
        const res     = await fetch(searchUrl);
        const results = await res.json();
        if (!results.length) { addLog(`✘ City not found: ${name}`, 'error'); return; }

        const { lon, lat } = results[0];
        map.flyTo({ center: [parseFloat(lon), parseFloat(lat)], zoom: 12, speed });
        await new Promise(r => map.once('moveend', r));

        if (cx.masterFactCard) showFactBox(fact, details, color, cx);
        const marker = createCityMarker(name, color, [parseFloat(lon), parseFloat(lat)]);

        await new Promise(r => setTimeout(r, parseInt(document.getElementById('stayDuration').value || 5) * 1000));

        hideFactBox();
        if (!persist) { marker.remove(); activeMarkers = activeMarkers.filter(m => m !== marker); }
    } catch(e) { addLog(`✘ City search error: ${e.message}`, 'error'); }
}

// ─── FEATURE LOOKUP ───────────────────────────────────────────────────────────
async function findFeature(lookupName, type) {
    const cleanName = lookupName.toLowerCase().trim();
    const isState   = ['state', 'province'].includes(type.toLowerCase());

    if (isState) {
        addLog(`Checking local index (${regionalData.features.length} regions)...`, 'info');
        const match = regionalData.features.find(f => {
            const p = f.properties;
            return (p.name || p.NAME_1 || '').toLowerCase() === cleanName;
        });
        if (match) {
            const id = `state-src-${Date.now()}`;
            map.addSource(id, { type: 'geojson', data: match });
            return { feature: match, source: id };
        }
        addLog(`No local match for "${cleanName}" — falling back to API`, 'info');
    }

    if (type.toLowerCase() === 'country') {
        const res  = await fetch(GEOJSON_URL);
        const data = await res.json();
        const match = data.features.find(f => f.properties.name.toLowerCase() === cleanName);
        if (match) return { feature: match, source: 'engine-source' };
    }

    addLog(`Querying Nominatim for: ${lookupName}`, 'info');
    const apiRes  = await fetch(`https://nominatim.openstreetmap.org/search?format=geojson&polygon_geojson=1&q=${encodeURIComponent(lookupName)}&limit=1`);
    const apiData = await apiRes.json();

    if (apiData.features?.length > 0) {
        const feat = apiData.features[0];
        const id   = `api-src-${Date.now()}`;
        map.addSource(id, { type: 'geojson', data: feat });
        addLog(`API: ${feat.geometry.type}`, feat.geometry.type === 'Point' ? 'error' : 'success');
        return { feature: feat, source: id };
    }

    return null;
}

// ─── REGIONAL PACKS ───────────────────────────────────────────────────────────
function handleModeChange() {
    const mode = document.getElementById('navMode').value;
    document.getElementById('regional-section').classList.toggle('display-none', mode === 'city');
    updateCSVPlaceholder();
}

function addCountryTag() {
    const select = document.getElementById('countrySelect');
    const val  = select.value;
    const text = select.options[select.selectedIndex].text;
    if (val && !selectedRegions.has(val)) { selectedRegions.add(val); renderTags(); addLog(`Pack queued: ${text}`, 'info'); }
    select.value = '';
}

function removeCountryTag(val) {
    selectedRegions.delete(val);
    renderTags();
    addLog(`Pack removed: ${val.toUpperCase()}`, 'info');
}

function renderTags() {
    const container = document.getElementById('tag-container');
    container.innerHTML = '';
    selectedRegions.forEach(val => {
        const option      = document.querySelector(`#countrySelect option[value="${val}"]`);
        const displayName = option ? option.text : val.toUpperCase();
        const tag         = document.createElement('div');
        tag.className     = 'country-tag';
        tag.innerHTML     = `${displayName} <span class="remove-btn" onclick="removeCountryTag('${val}')">&times;</span>`;
        container.appendChild(tag);
    });
}

async function loadRegionalPacks() {
    regionalData.features = [];
    if (selectedRegions.size === 0) return;

    const unknownPacks = [...selectedRegions].filter(k => !PACK_ISO3[k.toLowerCase()]);
    unknownPacks.forEach(k => addLog(`⚠ Unknown pack "${k}"`, 'error'));

    const validPacks = [...selectedRegions].filter(k => PACK_ISO3[k.toLowerCase()]);
    if (!validPacks.length) return;

    if (!_naturalEarthAdmin1Cache) {
        addLog(`Downloading Natural Earth Admin-1 (~14MB, one-time)...`, 'info');
        try {
            const res = await fetch(NATURAL_EARTH_ADMIN1_URL);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            _naturalEarthAdmin1Cache = await res.json();
            addLog(`✔ Cached ${_naturalEarthAdmin1Cache.features.length} regions`, 'success');
        } catch(e) {
            addLog(`✘ Download failed: ${e.message}`, 'error');
            return;
        }
    } else {
        addLog(`Using cached Natural Earth data`, 'info');
    }

    for (const country of validPacks) {
        const iso3     = PACK_ISO3[country.toLowerCase()];
        const features = _naturalEarthAdmin1Cache.features.filter(f => f.properties?.adm0_a3 === iso3);
        if (!features.length) { addLog(`⚠ No features for ISO3 ${iso3}`, 'error'); continue; }
        regionalData.features.push(...features);
        addLog(`✔ ${country.toUpperCase()}: ${features.length} regions loaded`, 'success');
    }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function parseBool(val) {
    return String(val).toLowerCase().trim() === 'true';
}

function showFactBox(fact, details, borderColor, cx) {
    const box       = document.getElementById('fact-box');
    const bodyEl    = document.getElementById('fact-body');
    const detailsEl = document.getElementById('fact-details');

    bodyEl.innerText    = fact    || '';
    bodyEl.style.fontSize = cx.headingSize + 'px';
    bodyEl.style.color    = cx.headingColor;

    if (cx.masterDetails) {
        detailsEl.innerText          = details || '';
        detailsEl.style.fontSize     = cx.detailsSize + 'px';
        detailsEl.style.color        = cx.detailsColor;
        detailsEl.style.display      = '';
        detailsEl.style.borderTop    = '';
        detailsEl.style.paddingTop   = '';
        detailsEl.style.marginTop    = '';
    } else {
        detailsEl.style.display = 'none';
    }

    box.style.borderColor = borderColor;
    box.style.display     = 'block';
}

function hideFactBox() {
    document.getElementById('fact-box').style.display = 'none';
}

function createPolygonLabel(name, center, cx) {
    const el       = document.createElement('div');
    el.className   = 'country-marker';
    el.innerText   = name;
    el.style.fontSize  = cx.labelSize  + 'px';
    el.style.color     = cx.labelColor;
    el.style.textShadow = cx.labelShadow
        ? '0 0 12px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.6)'
        : 'none';
    const marker = new maplibregl.Marker({ element: el }).setLngLat(center).addTo(map);
    activeMarkers.push(marker);
    return marker;
}

function createCityMarker(name, dotColor, coords) {
    const container   = document.createElement('div');
    container.className = 'city-marker-container';
    container.innerHTML = `<div class="city-label">${name}</div><div class="city-dot" style="background-color:${dotColor}"></div>`;
    const marker = new maplibregl.Marker({ element: container, anchor: 'bottom' }).setLngLat(coords).addTo(map);
    activeMarkers.push(marker);
    return marker;
}

function removeMarker(marker) {
    marker.remove();
    activeMarkers    = activeMarkers.filter(m => m !== marker);
}

function addHighlightLayer(id, officialName, color, width, sourceId) {
    const filter = sourceId === 'engine-source'
        ? ['==', ['get', 'name'], officialName]
        : ['boolean', true];

    map.addLayer({ id, type: 'fill', source: sourceId,
        paint: { 'fill-color': color, 'fill-opacity': 0.5 }, filter });
    map.addLayer({ id: id + '-outline', type: 'line', source: sourceId,
        paint: { 'line-color': color, 'line-width': parseFloat(width) || 2 }, filter });
}

function repaintLayer(layerId, recencyColor) {
    if (map.getLayer(layerId))              map.setPaintProperty(layerId, 'fill-color', recencyColor);
    if (map.getLayer(layerId + '-outline')) map.setPaintProperty(layerId + '-outline', 'line-color', recencyColor);
}

function removeHighlightLayer(layerId, sourceId) {
    if (map.getLayer(layerId))              map.removeLayer(layerId);
    if (map.getLayer(layerId + '-outline')) map.removeLayer(layerId + '-outline');
    if (sourceId !== 'engine-source' && map.getSource(sourceId)) map.removeSource(sourceId);
}

function getBounds(feature) {
    const bounds = new maplibregl.LngLatBounds();
    const geom   = feature.geometry;
    let coords;
    if      (geom.type === 'Polygon')      coords = geom.coordinates[0];
    else if (geom.type === 'MultiPolygon') coords = geom.coordinates.flat(2);
    else                                    coords = geom.coordinates.flat(Infinity);
    coords.forEach(c => { if (Array.isArray(c) && typeof c[0] === 'number') bounds.extend(c); });
    return bounds;
}

function clearPreviousTour() {
    activeMarkers.forEach(m => m.remove());
    activeMarkers = [];

    // Clear persisted layers from previous tour
    persistedLayers.forEach(({ layerId, outlineId, sourceId, marker }) => {
        if (map.getLayer(layerId))   map.removeLayer(layerId);
        if (map.getLayer(outlineId)) map.removeLayer(outlineId);
        if (sourceId !== 'engine-source' && map.getSource(sourceId)) map.removeSource(sourceId);
        if (marker) marker.remove();
    });
    persistedLayers = [];

    // Safety sweep for any orphaned highlight layers
    map.getStyle().layers.forEach(l => {
        if (l.id.startsWith('highlight-')) map.removeLayer(l.id);
    });
    const style = map.getStyle();
    Object.keys(style.sources).forEach(s => {
        if (s.startsWith('state-src') || s.startsWith('api-src')) map.removeSource(s);
    });

    hideFactBox();
    addLog('--- New Tour Started ---', 'info');
}

// ─── LOG CONTROLS ─────────────────────────────────────────────────────────────
function copyLogs() {
    const text = document.getElementById('log-content').innerText.replace(/\n\s*\n/g, '\n');
    navigator.clipboard.writeText(text).then(() => {
        const btn  = document.querySelector('.btn-log-action[onclick="copyLogs()"]');
        const orig = btn.innerText;
        btn.innerText = 'Copied!';
        setTimeout(() => btn.innerText = orig, 2000);
    }).catch(err => console.error('Failed to copy:', err));
}

function clearLogs() { document.getElementById('log-content').innerHTML = ''; }

function toggleLogMinimise() {
    const overlay = document.getElementById('map-log');
    const btn     = document.querySelector('.btn-log-minimise');
    const isMin   = overlay.classList.toggle('log-minimised');
    btn.textContent = isMin ? '+' : '−';
}

function addLog(message, type = 'info') {
    const logContent = document.getElementById('log-content');
    const entry      = document.createElement('div');
    entry.className  = `log-entry ${type}`;
    const ts = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    entry.innerHTML  = `<span style="color:#666">[${ts}]</span> ${message}`;
    logContent.appendChild(entry);
    logContent.scrollTop = logContent.scrollHeight;
}

// ─── CSV PLACEHOLDER ──────────────────────────────────────────────────────────
function updateCSVPlaceholder() {
    const mode  = document.getElementById('navMode').value;
    const input = document.getElementById('locationInput');
    const hint  = document.getElementById('csvHint');

    if (mode === 'city') {
        hint.innerText = 'Format: Origin, Name, Color, Fact, Details, Persist';
        input.value =
`India, Mumbai, #e74c3c, Financial Capital, Home to Bollywood, false
India, Delhi, #3498db, The Capital, Seat of Indian Government, false`;
    } else {
        hint.innerText = 'Format: Type, Name, Color, Fact, Details, BorderWidth, Label, ShowFact, Persist, PersistLabel, RecencyMode';
        input.value =
`Country, India, #e67e22, The Subcontinent, World's most populous country, 2, false, true, false, false, false
State, Maharashtra, #e74c3c, Maharashtra, Home to Mumbai — India's financial hub, 1.5, true, true, true, false, true
State, Karnataka, #e74c3c, Karnataka, Silicon Valley of India, 1.5, true, true, true, false, true
State, Tamil Nadu, #e74c3c, Tamil Nadu, Land of Temples and Culture, 1.5, true, true, true, false, true
State, Kerala, #e74c3c, Kerala, God's Own Country, 1.5, true, true, true, false, true`;
    }
}

// ─── COLOR SYNC (swatch ↔ hex input) ─────────────────────────────────────────
function syncColor(swatchId, hexId, value) {
    // Only sync if it looks like a valid hex color
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
        document.getElementById(swatchId).value = value;
        document.getElementById(hexId).value    = value;
    }
}