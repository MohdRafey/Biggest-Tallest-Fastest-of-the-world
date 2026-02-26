const GEOJSON_URL = 'https://raw.githubusercontent.com/datasets/geo-boundaries-world-110m/master/countries.geojson';

const nameMap = { 
    "usa": "United States",
    "uae": "United Arab Emirates",
    "uk": "United Kingdom",
    "russia": "Russian Federation",
    "korea": "South Korea" 
};

// Single source for ALL country sub-regions (states/provinces).
// Natural Earth Admin-1 contains every country worldwide with consistent 'name' and 'adm0_a3' properties.
// We fetch this once, cache it, and filter per country pack — no separate URL per country needed.
const NATURAL_EARTH_ADMIN1_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson';

// Maps pack key -> ISO 3166-1 alpha-3 code used in the Natural Earth 'adm0_a3' property.
// Add any country here and it will work automatically — no extra data source needed.
const PACK_ISO3 = {
    usa: 'USA',
    ind: 'IND',
    jpn: 'JPN',
    aus: 'AUS',
    can: 'CAN',
    deu: 'DEU',
    gbr: 'GBR',
    fra: 'FRA',
    esp: 'ESP',
    rus: 'RUS',
    chn: 'CHN',
};

// Module-level cache so we only download the ~14MB NE file once per session.
let _naturalEarthAdmin1Cache = null;

const themes = {
    bright: { water: '#748B97', land: '#f8f4f0', background: '#ffffff', border: '#cccccc' },
    dark: { water: '#748B97', land: '#1e1e1e', background: '#000000', border: '#ffffff' },
    sepia: { water: '#9ab09a', land: '#e3d5b8', background: '#dccba0', border: '#8e7a5e' },
    colorful: { water: '#3498db', land: '#2ecc71', background: '#f1c40f', border: '#ffffff' },
    oceanic: { water: '#1b3a4b', land: '#cfd8dc', background: '#eceff1', border: '#90a4ae' }
};

let map;
let activeMarkers = [];
let regionalData = { type: 'FeatureCollection', features: [] };
let selectedRegions = new Set();

// FIX 3: Wrap map initialization in DOMContentLoaded so #map div exists in the DOM
document.addEventListener('DOMContentLoaded', () => {
    map = new maplibregl.Map({
        container: 'map',
        style: 'https://tiles.openfreemap.org/styles/bright',
        center: [0, 20],
        zoom: 2,
        maxZoom: 10
    });

    map.on('load', () => { 
        applyTheme(); 
    });
});

function toggleConfig() {
    const wrapper = document.getElementById('panel-wrapper');
    wrapper.classList.toggle('hidden');
    // Arrow: ‹ when open (click to close), › when hidden (click to open)
    document.getElementById('panelArrow').innerHTML = wrapper.classList.contains('hidden') ? '&#8250;' : '&#8249;';
}

// 2. THEME & CLEANUP
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
    const mapContainer = document.getElementById('map');

    mapContainer.className = themeName === 'dark' ? 'theme-dark' : 'theme-light';

    if (map.getLayer('water')) map.setPaintProperty('water', 'fill-color', config.water);
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

    const box = document.getElementById('fact-box');
    if (themeName === 'dark') {
        box.style.background = "rgba(30, 30, 30, 0.98)";
        document.getElementById('fact-body').style.color = "#fff";
        document.getElementById('fact-details').style.color = "#bbb";
    } else {
        box.style.background = "rgba(255, 255, 255, 0.98)";
        document.getElementById('fact-body').style.color = "#1a1a1a";
        document.getElementById('fact-details').style.color = "#555";
    }
    cleanMap(); 
}

// 3. CORE ENGINE
async function runEngine() {
    clearPreviousTour();
    await loadRegionalPacks();

    const mode = document.getElementById('navMode').value;
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

async function handlePolygonNavigation(parts, speed) {
    const [type, name, color, border, fact, details, persist] = parts;
    const stayTime = parseInt(document.getElementById('stayDuration').value || 5) * 1000;
    
    addLog(`Searching ${type}: ${name}...`, 'info');
    let result = await findFeature(name, type);

    if (result && result.feature) {
        const { feature, source: sourceId } = result;
        const officialName = feature.properties.name || feature.properties.NAME_1 || name;
        const layerId = `highlight-${name.replace(/\s+/g, '-')}-${Date.now()}`;
        
        let currentMarker = null;

        if (feature.geometry.type === 'Point') {
            addLog(`⚠ ${name} is a Point. Flying there...`, 'error');
            map.flyTo({ center: feature.geometry.coordinates, zoom: 10, speed: speed });
        } else {
            const bounds = getBounds(feature);
            map.fitBounds(bounds, { padding: 150, speed: speed, essential: true });

            await new Promise(resolve => {
                let moved = false;
                const check = () => { if (moved && map.isSourceLoaded(sourceId)) resolve(); };
                map.once('moveend', () => { moved = true; check(); });
                setTimeout(resolve, 3000); 
            });

            showFactBox(fact, details, color);
            addHighlightLayer(layerId, officialName, color, border, sourceId);
            
            const el = document.createElement('div');
            el.className = 'country-marker';
            el.innerText = name;
            currentMarker = new maplibregl.Marker({ element: el }).setLngLat(bounds.getCenter()).addTo(map);
            activeMarkers.push(currentMarker);
            
            addLog(`Rendering highlight for ${officialName}...`, 'info');
        }

        await new Promise(r => setTimeout(r, stayTime));

        if (persist && persist.toLowerCase() !== 'true') {
            // FIX 6: Remove layers before removing the source to avoid dependent-layer errors
            if (map.getLayer(layerId)) map.removeLayer(layerId);
            if (map.getLayer(layerId + '-outline')) map.removeLayer(layerId + '-outline');
            
            if (currentMarker) {
                currentMarker.remove();
                activeMarkers = activeMarkers.filter(m => m !== currentMarker);
                addLog(`Removed text label for ${name}`, 'info');
            }

            if (sourceId !== 'engine-source' && map.getSource(sourceId)) {
                map.removeSource(sourceId);
            }
            
            hideFactBox();
            addLog(`Cleared ${name} completely`, 'info');
        }
    } else {
        addLog(`✘ Failed to find ${name}`, 'error');
    }
}

async function handleCityNavigation(parts, speed) {
    const [origin, name, color, fact, details, persist] = parts;
    
    const searchQuery = `${name}, ${origin}`;
    const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`;
    
    try {
        const response = await fetch(searchUrl);
        const results = await response.json();
        if (results.length > 0) {
            const { lon, lat } = results[0];
            map.flyTo({ center: [parseFloat(lon), parseFloat(lat)], zoom: 12, speed: speed });
            await new Promise(r => map.once('moveend', r));

            showFactBox(fact, details, color);
            const marker = createCityMarker(name, color, [parseFloat(lon), parseFloat(lat)]);

            await new Promise(r => setTimeout(r, 6000));

            // FIX 5: Guard against undefined persist before calling .toLowerCase()
            if (!persist || persist.toLowerCase() !== 'true') {
                marker.remove();
                hideFactBox();
            }
        }
    } catch (e) { console.error("City search failed", e); }
}

async function findFeature(lookupName, type) {
    const cleanName = lookupName.toLowerCase().trim();
    const isState = type.toLowerCase() === 'state' || type.toLowerCase() === 'province';

    addLog(`Searching ${type} for: "${cleanName}"`, "info");

    if (isState) {
        addLog(`Checking local index of ${regionalData.features.length} features...`, "info");
        
        let match = regionalData.features.find(f => {
            const p = f.properties;
            const featName = (p.name || p.NAME_1 || p.state || p.province || "").toLowerCase();
            return featName === cleanName;
        });

        if (match) {
            addLog(`✔ Match found in local index: ${cleanName}`, "success");
            const id = `state-src-${Date.now()}`;
            map.addSource(id, { type: 'geojson', data: match });
            return { feature: match, source: id };
        } else {
            addLog(`✘ No local match for "${cleanName}". Checking API fallback...`, "info");
        }
    }

    if (type.toLowerCase() === 'country') {
        addLog(`Checking global country file...`, "info");
        const countryRes = await fetch(GEOJSON_URL);
        const countryData = await countryRes.json();
        let countryMatch = countryData.features.find(f => f.properties.name.toLowerCase() === cleanName);
        if (countryMatch) return { feature: countryMatch, source: 'engine-source' };
    }

    addLog(`Requesting Polygon from Nominatim API for: ${lookupName}`, "info");
    const apiRes = await fetch(`https://nominatim.openstreetmap.org/search?format=geojson&polygon_geojson=1&q=${encodeURIComponent(lookupName)}&limit=1`);
    const apiData = await apiRes.json();
    
    if (apiData.features?.length > 0) {
        const feat = apiData.features[0];
        addLog(`API returned geometry type: ${feat.geometry.type}`, feat.geometry.type === 'Point' ? 'error' : 'success');
        
        const id = `api-src-${Date.now()}`;
        map.addSource(id, { type: 'geojson', data: feat });
        return { feature: feat, source: id };
    }

    return null;
}

function handleModeChange() {
    const mode = document.getElementById('navMode').value;
    const regionalSection = document.getElementById('regional-section');
    
    if (mode === 'city') {
        regionalSection.classList.add('display-none');
    } else {
        regionalSection.classList.remove('display-none');
    }
    
    updateCSVPlaceholder();
}

function addCountryTag() {
    const select = document.getElementById('countrySelect');
    const val = select.value;
    const text = select.options[select.selectedIndex].text;
    
    if (val && !selectedRegions.has(val)) {
        selectedRegions.add(val);
        renderTags();
        addLog(`Added to queue: ${text}`, 'info');
    }
    select.value = "";
}

function removeCountryTag(val) {
    selectedRegions.delete(val);
    renderTags();
    addLog(`Removed pack: ${val.toUpperCase()}`, 'info');
}

function renderTags() {
    const container = document.getElementById('tag-container');
    container.innerHTML = '';
    
    selectedRegions.forEach(val => {
        const option = document.querySelector(`#countrySelect option[value="${val}"]`);
        const displayName = option ? option.text : val.toUpperCase();
        
        const tag = document.createElement('div');
        tag.className = 'country-tag';
        tag.innerHTML = `
            ${displayName} 
            <span class="remove-btn" onclick="removeCountryTag('${val}')">&times;</span>
        `;
        container.appendChild(tag);
    });
}

async function loadRegionalPacks() {
    // Always reset so stale data from a previous run doesn't persist
    regionalData.features = [];

    if (selectedRegions.size === 0) return;

    // Validate all selected packs have known ISO3 codes before fetching
    const unknownPacks = [...selectedRegions].filter(k => !PACK_ISO3[k.toLowerCase()]);
    if (unknownPacks.length > 0) {
        unknownPacks.forEach(k => addLog(`⚠ Unknown pack key "${k}" — add it to PACK_ISO3 in script.js`, "error"));
    }

    const validPacks = [...selectedRegions].filter(k => PACK_ISO3[k.toLowerCase()]);
    if (validPacks.length === 0) return;

    // Fetch the Natural Earth Admin-1 file once and cache it for the session
    if (!_naturalEarthAdmin1Cache) {
        addLog(`Downloading Natural Earth Admin-1 data (one-time, ~14MB)...`, "info");
        try {
            const res = await fetch(NATURAL_EARTH_ADMIN1_URL);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            _naturalEarthAdmin1Cache = await res.json();
            addLog(`✔ Natural Earth Admin-1 downloaded. ${_naturalEarthAdmin1Cache.features.length} total regions cached.`, "success");
        } catch (e) {
            addLog(`✘ Failed to download Natural Earth Admin-1: ${e.message}`, "error");
            return;
        }
    } else {
        addLog(`Using cached Natural Earth Admin-1 data.`, "info");
    }

    // Filter the cached data for each selected pack
    for (const country of validPacks) {
        const key = country.toLowerCase();
        const iso3 = PACK_ISO3[key];

        const features = _naturalEarthAdmin1Cache.features.filter(f =>
            f.properties && f.properties.adm0_a3 === iso3
        );

        if (features.length === 0) {
            addLog(`⚠ No features found for ISO3 "${iso3}" (pack: ${key}). Check PACK_ISO3 mapping.`, "error");
            continue;
        }

        // Natural Earth already uses 'name' consistently — no normalisation needed
        regionalData.features.push(...features);
        addLog(`✔ ${key.toUpperCase()} pack loaded: ${features.length} regions (ISO3: ${iso3})`, "success");
    }
}

// 6. HELPERS
function showFactBox(fact, details, color) {
    const box = document.getElementById('fact-box');
    document.getElementById('fact-body').innerText = fact;
    document.getElementById('fact-details').innerText = details;
    box.style.borderColor = color;
    box.style.display = 'block';
}

function hideFactBox() { document.getElementById('fact-box').style.display = 'none'; }

function createCityMarker(name, dotColor, coords) {
    const container = document.createElement('div');
    container.className = 'city-marker-container';
    container.innerHTML = `<div class="city-label">${name}</div><div class="city-dot" style="background-color:${dotColor}"></div>`;
    const marker = new maplibregl.Marker({ element: container, anchor: 'bottom' }).setLngLat(coords).addTo(map);
    activeMarkers.push(marker);
    return marker;
}

function addHighlightLayer(id, officialName, color, width, sourceId) {
    const filter = (sourceId === 'engine-source') 
        ? ['==', ['get', 'name'], officialName] 
        // FIX 8: Use ['boolean', true] instead of ["all"] with no sub-expressions
        : ['boolean', true];

    map.addLayer({
        id: id,
        type: 'fill',
        source: sourceId,
        paint: {
            'fill-color': color,
            'fill-opacity': 0.5
        },
        filter: filter
    });

    map.addLayer({
        id: id + '-outline',
        type: 'line',
        source: sourceId,
        paint: {
            'line-color': color,
            'line-width': parseFloat(width) || 2
        },
        filter: filter
    });
}

// FIX 4: Handle MultiPolygon geometry in getBounds by flattening coords to the correct depth
function getBounds(feature) {
    const bounds = new maplibregl.LngLatBounds();
    const geom = feature.geometry;

    let coords;
    if (geom.type === 'Polygon') {
        coords = geom.coordinates[0];
    } else if (geom.type === 'MultiPolygon') {
        // MultiPolygon: [ [ [ [lng,lat], ... ] ] ] — need flat(2) from the top level
        coords = geom.coordinates.flat(2);
    } else {
        coords = geom.coordinates.flat(Infinity);
    }

    coords.forEach(c => { if (Array.isArray(c) && typeof c[0] === 'number') bounds.extend(c); });
    return bounds;
}

function clearPreviousTour() {
    activeMarkers.forEach(m => m.remove());
    activeMarkers = [];
    
    // FIX 6: Remove highlight layers before removing their sources
    map.getStyle().layers.forEach(l => { 
        if (l.id.startsWith('highlight-')) map.removeLayer(l.id); 
    });

    const style = map.getStyle();
    Object.keys(style.sources).forEach(s => {
        if (s.startsWith('state-src') || s.startsWith('api-src')) {
            map.removeSource(s);
        }
    });

    hideFactBox();
    addLog("--- New Tour Started ---", "info");
}

function copyLogs() {
    const logContent = document.getElementById('log-content');
    const text = logContent.innerText.replace(/\n\s*\n/g, '\n');
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.querySelector('.btn-log-action[onclick="copyLogs()"]');
        const orig = btn.innerText;
        btn.innerText = "Copied!";
        setTimeout(() => btn.innerText = orig, 2000);
    }).catch(err => console.error('Failed to copy:', err));
}

function clearLogs() {
    document.getElementById('log-content').innerHTML = '';
}

function toggleLogMinimise() {
    const overlay = document.getElementById('map-log');
    const btn = document.querySelector('.btn-log-minimise');
    const isMin = overlay.classList.toggle('log-minimised');
    btn.textContent = isMin ? '+' : '−';
}

function addLog(message, type = 'info') {
    const logContent = document.getElementById('log-content');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    
    const timestamp = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    entry.innerHTML = `<span style="color: #666;">[${timestamp}]</span> ${message}`;
    
    logContent.appendChild(entry);
    logContent.scrollTop = logContent.scrollHeight;
}

function updateCSVPlaceholder() {
    const mode = document.getElementById('navMode').value;
    const input = document.getElementById('locationInput');
    const hint = document.getElementById('csvHint');

    if (mode === 'city') {
        hint.innerText = "Format: Origin Country, Name, Circle Color, Fact, Details, Persist";
        input.value = "India, Hyderabad, #FF5733, The City of Pearls, Famous for Biryani, false\nPakistan, Hyderabad, #33FF57, Historical City, Located in Sindh, false";
    } else {
        hint.innerText = "Format: Type (Country/State), Name, Color, Border, Fact, Details, Persist";
        input.value = "Country, Georgia, #e67e22, 2, Intersection of Europe and Asia, Famous for wine, false\nState, Georgia, #3498db, 2, US State, Known as the Peach State, false";
    }
}