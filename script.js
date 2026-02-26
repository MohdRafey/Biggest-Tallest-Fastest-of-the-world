const GEOJSON_URL = 'https://raw.githubusercontent.com/datasets/geo-boundaries-world-110m/master/countries.geojson';
const nameMap = { 
    "usa": "United States",
    "uae": "United Arab Emirates",
    "uk": "United Kingdom",
    "russia": "Russian Federation",
    "korea": "South Korea" 
};

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

// 1. INITIALIZATION
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

function toggleConfig() {
    document.getElementById('config-panel').classList.toggle('hidden');
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
        
        // Use the new column structure
        if (mode === 'polygon') {
            await handlePolygonNavigation(parts, speed);
        } else {
            await handleCityNavigation(parts, speed);
        }
    }
}
// --- UPDATED POLYGON HANDLER ---
// Format: Type (Country/State), Name, Color, Border, Fact, Details, Persist


// UPDATE YOUR HANDLER TO USE THE NEW LOGS:
async function handlePolygonNavigation(parts, speed) {
    const [type, name, color, border, fact, details, persist] = parts;
    const stayTime = parseInt(document.getElementById('stayDuration').value || 5) * 1000;
    
    addLog(`Searching ${type}: ${name}...`, 'info');
    let result = await findFeature(name, type);

    if (result && result.feature) {
        const { feature, source: sourceId } = result;
        const officialName = feature.properties.name || feature.properties.NAME_1 || name;
        const layerId = `highlight-${name.replace(/\s+/g, '-')}-${Date.now()}`;
        
        // Define marker outside the block so Cleanup can see it
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
            
            // Assign to the variable defined in the wider scope
            const el = document.createElement('div');
            el.className = 'country-marker';
            el.innerText = name;
            currentMarker = new maplibregl.Marker({ element: el }).setLngLat(bounds.getCenter()).addTo(map);
            activeMarkers.push(currentMarker);
            
            addLog(`Rendering highlight for ${officialName}...`, 'info');
        }

        await new Promise(r => setTimeout(r, stayTime));

        // CLEANUP SECTION
        if (persist && persist.toLowerCase() !== 'true') {
            if (map.getLayer(layerId)) map.removeLayer(layerId);
            if (map.getLayer(layerId + '-outline')) map.removeLayer(layerId + '-outline');
            
            // Use the correctly scoped variable
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
// --- UPDATED CITY HANDLER ---
// Format: Origin Country, Name, Circle Color, Fact, Details, Persist
async function handleCityNavigation(parts, speed) {
    const [origin, name, color, fact, details, persist] = parts;
    
    // Search using both name and origin for high accuracy
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
            if (persist.toLowerCase() !== 'true') {
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
            // Log every name we encounter until we find a match
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

    // FINAL API ATTEMPT
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
    
    // Hide or Show Regional Packs based on Mode
    if (mode === 'city') {
        regionalSection.classList.add('display-none');
    } else {
        regionalSection.classList.remove('display-none');
    }
    
    // Also run your existing placeholder update
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
    select.value = ""; // Reset dropdown for next selection
}

function removeCountryTag(val) {
    selectedRegions.delete(val);
    renderTags();
    addLog(`Removed pack: ${val.toUpperCase()}`, 'info');
}

function renderTags() {
    const container = document.getElementById('tag-container');
    container.innerHTML = ''; // Clear existing
    
    selectedRegions.forEach(val => {
        // Try to find the pretty name from the dropdown options
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
    if (selectedRegions.size === 0) return;
    regionalData.features = []; 
    
    for (const country of selectedRegions) {
        const url = `https://raw.githubusercontent.com/mledoze/countries/master/data/${country.toLowerCase()}.geo.json`;
        try {
            const res = await fetch(url);
            const data = await res.json();
            
            // THE FIX: Some mledoze files have the features inside data.features
            // Others ARE the features themselves.
            let featuresToStore = [];
            
            if (data.features && Array.isArray(data.features)) {
                featuresToStore = data.features;
            } else if (data.type === "Feature") {
                featuresToStore = [data];
            } else if (Array.isArray(data)) {
                featuresToStore = data;
            }

            regionalData.features.push(...featuresToStore);
            addLog(`✔ Success: ${country} processed. Added ${featuresToStore.length} sub-regions to local index.`, "success");
        } catch (e) {
            addLog(`✘ Error loading ${country}`, "error");
        }
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
    // Logic: If it's the global country file, filter by name.
    // If it's a specific state source created via findFeature, we show everything in that source.
    const filter = (sourceId === 'engine-source') 
        ? ['==', ['get', 'name'], officialName] 
        : ["all"]; 

    // Add Fill Layer
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

    // Add Outline Layer
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

function getBounds(feature) {
    const bounds = new maplibregl.LngLatBounds();
    const coords = feature.geometry.type === 'Polygon' ? feature.geometry.coordinates[0] : feature.geometry.coordinates.flat(2);
    coords.forEach(c => { if(Array.isArray(c) && typeof c[0] === 'number') bounds.extend(c); });
    return bounds;
}

function clearPreviousTour() {
    activeMarkers.forEach(m => m.remove());
    activeMarkers = [];
    
    // Clear existing highlight layers
    map.getStyle().layers.forEach(l => { 
        if (l.id.startsWith('highlight-')) map.removeLayer(l.id); 
    });

    // Clear temporary sources to prevent "Source already exists" errors
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
    // Get text and clean up multiple newlines
    const text = logContent.innerText.replace(/\n\s*\n/g, '\n');
    
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.querySelector('.btn-copy-log');
        const originalText = btn.innerText;
        btn.innerText = "COPIED!";
        setTimeout(() => btn.innerText = originalText, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
}

function addLog(message, type = 'info') {
    const logContent = document.getElementById('log-content');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    
    const timestamp = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    entry.innerHTML = `<span style="color: #666;">[${timestamp}]</span> ${message}`;
    
    logContent.appendChild(entry); // Append to end
    logContent.scrollTop = logContent.scrollHeight; // Auto-scroll to latest
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