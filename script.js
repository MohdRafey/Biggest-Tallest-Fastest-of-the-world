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
    colorful:   { water: '#3498db', land: '#2ecc71', background: '#f1c40f', border: '#ffffff' },
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
    toggleConfig();
    clearPreviousTour();
    await loadRegionalPacks();

    const speed = parseFloat(document.getElementById('speed').value);
    const lines = document.getElementById('locationInput').value.split('\n');

    map.setZoom(parseFloat(document.getElementById('startZoom').value));
    map.setMaxZoom(parseFloat(document.getElementById('maxZoom').value));

    for (let line of lines) {
        if (!line.trim()) continue;
        const parts = line.split(',').map(s => s.trim());
        const type  = (parts[0] || '').toLowerCase();
        if (type === 'city') {
            await handleCityNavigation(parts, speed);
        } else {
            await handlePolygonNavigation(parts, speed);
        }
    }
}

// ─── POLYGON HANDLER ──────────────────────────────────────────────────────────
// CSV columns: Type, Name, Color, BorderWidth, Label, ShowFact, Persist, PersistLabel, RecencyMode, Fact, Details
async function handlePolygonNavigation(parts, speed) {
    // Format: Type, Name, Origin(ignored), Color, Fact, Details, Size, Label, ShowFact, Persist, PersistLabel, RecencyMode
    const [type, name, , color, fact, details,
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
    // Format: Type, Name, Origin, Color, Fact, Details, Size, Label, ShowFact, Persist, PersistLabel
    const [type, name, origin, color, fact, details, size, labelFlag, showFactFlag, persistFlag, persistLabelFlag] = parts;
    const cx        = getCustomizer();
    const stayTime  = parseInt(document.getElementById('stayDuration').value || 5) * 1000;
    const showLabel = cx.masterLabel    && parseBool(labelFlag);
    const showFact  = cx.masterFactCard && parseBool(showFactFlag);
    const persist   = parseBool(persistFlag);
    const persistLabel = persist && parseBool(persistLabelFlag);
    const dotSize   = parseFloat(size) || 10;

    const searchQuery = origin ? `${name}, ${origin}` : name;
    const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`;
    try {
        const res     = await fetch(searchUrl);
        const results = await res.json();
        if (!results.length) { addLog(`✘ City not found: ${name}`, 'error'); return; }

        const { lon, lat } = results[0];
        const coords = [parseFloat(lon), parseFloat(lat)];

        map.flyTo({ center: coords, zoom: 8, speed });
        await new Promise(r => map.once('moveend', r));

        if (showFact) showFactBox(fact, details, color, cx);
        const marker = createCityMarker(name, color, coords, dotSize, showLabel);

        await new Promise(r => setTimeout(r, stayTime));

        hideFactBox();
        if (!persist) {
            marker.remove();
            activeMarkers = activeMarkers.filter(m => m !== marker);
        } else if (!persistLabel) {
            // Keep dot but remove label text
            const labelEl = marker.getElement().querySelector('.city-label');
            if (labelEl) labelEl.remove();
            persistedLayers.push({ layerId: null, outlineId: null, sourceId: null, marker });
        } else {
            persistedLayers.push({ layerId: null, outlineId: null, sourceId: null, marker });
        }
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
    // navMode dropdown removed — regional section always visible
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

function createCityMarker(name, dotColor, coords, size = 10, showLabel = true) {
    const container     = document.createElement('div');
    container.className = 'city-marker-container';
    const labelHtml = showLabel ? `<div class="city-label">${name}</div>` : '';
    const px = Math.max(6, Math.min(size, 40));
    container.innerHTML = `${labelHtml}<div class="city-dot" style="background-color:${dotColor}; width:${px}px; height:${px}px;"></div>`;
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
    // Single unified format — no mode branching needed
}

// ─── COLOR SYNC (swatch ↔ hex input) ─────────────────────────────────────────
function syncColor(swatchId, hexId, value) {
    // Only sync if it looks like a valid hex color
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
        document.getElementById(swatchId).value = value;
        document.getElementById(hexId).value    = value;
    }
}

// ─── SHUFFLE DATASETS ─────────────────────────────────────────────────────────
// 5 country-level datasets, 10 records each.
// Format: Type, Name, Color, Fact, Details, BorderWidth, Label, ShowFact, Persist, PersistLabel, RecencyMode

const SHUFFLE_POLYGON_DATASETS = [

    // 1 — G20 Major Economies
    // Type, Name, Color, Fact, Details, Size, Label, ShowFact, Persist, PersistLabel, RecencyMode
    `Country, United States, , #2ecc71, United States, Largest economy by nominal GDP, 2, true, true, false, false, false
Country, China, , #e74c3c, China, Second largest economy and manufacturing powerhouse, 2, true, true, false, false, false
Country, Germany, , #3498db, Germany, Largest economy in Europe, 2, true, true, false, false, false
Country, Japan, , #9b59b6, Japan, Third largest economy by nominal GDP, 2, true, true, false, false, false
Country, India, , #e67e22, India, Fastest growing major economy, 2, true, true, false, false, false
Country, United Kingdom, , #1abc9c, United Kingdom, Fifth largest economy globally, 2, true, true, false, false, false
Country, France, , #e91e63, France, Sixth largest economy and cultural powerhouse, 2, true, true, false, false, false
Country, Brazil, , #f39c12, Brazil, Largest economy in South America, 2, true, true, false, false, false
Country, Canada, , #00bcd4, Canada, One of the world's most trade-dependent nations, 2, true, true, false, false, false
Country, Australia, , #8bc34a, Australia, Largest economy in Oceania, 2, true, true, false, false, false`,

    // 2 — BRICS Nations + Candidates
    `Country, Brazil, , #e74c3c, Brazil, Co-founder of BRICS and South America's giant, 2, true, true, false, false, false
Country, Russia, , #3498db, Russia, World's largest country by land area, 2, true, true, false, false, false
Country, India, , #f39c12, India, Home to 1.4 billion people, 2, true, true, false, false, false
Country, China, , #e91e63, China, World's largest exporter, 2, true, true, false, false, false
Country, South Africa, , #2ecc71, South Africa, Africa's most industrialised economy, 2, true, true, false, false, false
Country, Saudi Arabia, , #9b59b6, Saudi Arabia, World's largest oil exporter, 2, true, true, false, false, false
Country, Iran, , #1abc9c, Iran, Fourth largest proven oil reserves globally, 2, true, true, false, false, false
Country, Egypt, , #e67e22, Egypt, Most populous country in the Arab world, 2, true, true, false, false, false
Country, Ethiopia, , #00bcd4, Ethiopia, Second most populous country in Africa, 2, true, true, false, false, false
Country, Argentina, , #8bc34a, Argentina, Second largest country in South America, 2, true, true, false, false, false`,

    // 3 — South & Southeast Asia
    `Country, India, , #e67e22, India, World's most populous democracy, 2, true, true, false, false, false
Country, Pakistan, , #3498db, Pakistan, Second most populous Muslim-majority country, 2, true, true, false, false, false
Country, Bangladesh, , #2ecc71, Bangladesh, One of the most densely populated countries, 2, true, true, false, false, false
Country, Sri Lanka, , #e74c3c, Sri Lanka, Island nation known as the Pearl of the Indian Ocean, 2, true, true, false, false, false
Country, Nepal, , #9b59b6, Nepal, Home to eight of the world's ten tallest peaks, 2, true, true, false, false, false
Country, Thailand, , #f39c12, Thailand, Most visited country in Southeast Asia, 2, true, true, false, false, false
Country, Vietnam, , #1abc9c, Vietnam, One of the fastest growing economies in Asia, 2, true, true, false, false, false
Country, Indonesia, , #e91e63, Indonesia, World's largest archipelago nation, 2, true, true, false, false, false
Country, Malaysia, , #00bcd4, Malaysia, One of Southeast Asia's most prosperous nations, 2, true, true, false, false, false
Country, Philippines, , #8bc34a, Philippines, Archipelago of over 7600 islands, 2, true, true, false, false, false`,

    // 4 — African Continent Highlights
    `Country, Nigeria, , #e74c3c, Nigeria, Most populous country in Africa, 2, true, true, false, false, false
Country, Ethiopia, , #3498db, Ethiopia, Africa's second most populous nation, 2, true, true, false, false, false
Country, Egypt, , #f39c12, Egypt, Home to one of the world's oldest civilisations, 2, true, true, false, false, false
Country, South Africa, , #2ecc71, South Africa, Southernmost country on the African continent, 2, true, true, false, false, false
Country, Kenya, , #9b59b6, Kenya, East Africa's economic hub, 2, true, true, false, false, false
Country, Ghana, , #1abc9c, Ghana, First sub-Saharan country to gain independence, 2, true, true, false, false, false
Country, Tanzania, , #e67e22, Tanzania, Home to Mount Kilimanjaro and Serengeti, 2, true, true, false, false, false
Country, Morocco, , #e91e63, Morocco, Gateway between Africa and Europe, 2, true, true, false, false, false
Country, Angola, , #00bcd4, Angola, One of Africa's largest oil producers, 2, true, true, false, false, false
Country, Mozambique, , #8bc34a, Mozambique, Long Indian Ocean coastline in Southern Africa, 2, true, true, false, false, false`,

    // 5 — European Union Core Members
    `Country, Germany, , #3498db, Germany, EU's largest economy and most populous member, 2, true, true, false, false, false
Country, France, , #e74c3c, France, Founding member and second largest EU economy, 2, true, true, false, false, false
Country, Italy, , #2ecc71, Italy, Third largest economy in the Eurozone, 2, true, true, false, false, false
Country, Spain, , #f39c12, Spain, Fourth largest economy in the EU, 2, true, true, false, false, false
Country, Poland, , #9b59b6, Poland, Largest economy in Central Eastern Europe, 2, true, true, false, false, false
Country, Netherlands, , #1abc9c, Netherlands, One of the world's largest export economies, 2, true, true, false, false, false
Country, Belgium, , #e67e22, Belgium, Home to key EU and NATO institutions, 2, true, true, false, false, false
Country, Sweden, , #e91e63, Sweden, Largest Nordic economy and EU member, 2, true, true, false, false, false
Country, Austria, , #00bcd4, Austria, Central European nation with strong industrial base, 2, true, true, false, false, false
Country, Portugal, , #8bc34a, Portugal, Western Europe's oldest nation-state, 2, true, true, false, false, false`,

];

const SHUFFLE_CITY_DATASETS = [

    // 1 — Global Financial Capitals
    // Type, Name, Color, Fact, Details, Size, Label, ShowFact, Persist, PersistLabel
    `City, New York, USA, #f39c12, Financial Capital of the World, Home to Wall Street and the NYSE, 12, true, true, false, false
City, London, UK, #3498db, Global Finance Hub, Centre of European and global banking, 12, true, true, false, false
City, Tokyo, Japan, #e74c3c, Asia's Largest Financial Centre, World's third largest stock exchange, 12, true, true, false, false
City, Shanghai, China, #2ecc71, China's Commercial Capital, Largest city in the world's second economy, 12, true, true, false, false
City, Frankfurt, Germany, #9b59b6, Europe's Banking Capital, Home to the European Central Bank, 10, true, true, false, false
City, Singapore, Singapore, #1abc9c, Asia's Gateway, One of the world's top four financial centres, 10, true, true, false, false
City, Zurich, Switzerland, #e67e22, Global Private Banking Hub, One of the world's leading financial centres, 10, true, true, false, false
City, Dubai, UAE, #e91e63, Middle East Finance Hub, Fastest growing financial centre globally, 10, true, true, false, false
City, Hong Kong, China, #00bcd4, Asia's Financial Centre, Bridge between China and global markets, 10, true, true, false, false
City, Paris, France, #8bc34a, European Business Capital, Home to the Paris Bourse and major multinationals, 10, true, true, false, false`,

    // 2 — Historic World Capitals
    `City, Rome, Italy, #e74c3c, The Eternal City, Capital of the ancient Roman Empire, 12, true, true, false, false
City, Athens, Greece, #3498db, Birthplace of Democracy, One of the world's oldest cities, 10, true, true, false, false
City, Cairo, Egypt, #f39c12, City of a Thousand Minarets, Built beside the ancient pyramids of Giza, 12, true, true, false, false
City, Beijing, China, #9b59b6, China's Imperial Capital, Home to the Forbidden City and Tiananmen Square, 12, true, true, false, false
City, Delhi, India, #e67e22, Capital of India, One of the world's most historically layered cities, 12, true, true, false, false
City, Istanbul, Turkey, #2ecc71, City on Two Continents, Straddles both Europe and Asia, 12, true, true, false, false
City, Tehran, Iran, #1abc9c, Persian Capital, Gateway to Iran's ancient civilisation, 10, true, true, false, false
City, Lima, Peru, #e91e63, City of Kings, Founded by conquistadors on the Pacific coast, 10, true, true, false, false
City, Mexico City, Mexico, #00bcd4, Aztec to Modern Metropolis, Built on the ruins of Tenochtitlan, 12, true, true, false, false
City, Kyoto, Japan, #8bc34a, Japan's Ancient Capital, Former imperial seat for over a thousand years, 10, true, true, false, false`,

];

function shuffleCSV() {
    const input = document.getElementById('locationInput');
    // Pick from all datasets (polygon + city)
    const all    = [...SHUFFLE_POLYGON_DATASETS, ...SHUFFLE_CITY_DATASETS];
    const picked = all[Math.floor(Math.random() * all.length)];
    input.value  = picked.trim();

    input.style.transition = 'background 0.15s';
    input.style.background = '#eafaf1';
    setTimeout(() => { input.style.background = ''; }, 400);
}