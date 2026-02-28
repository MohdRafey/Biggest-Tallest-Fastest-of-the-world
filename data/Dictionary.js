// ─── dictionary.js ────────────────────────────────────────────────────────────
// Static lookup tables used by the Map Engine.
// Loaded before script.js via <script> tag in index.html.

// Maps regional pack dropdown key → ISO 3166-1 alpha-3 code.
// Used to filter Natural Earth Admin-1 data per country pack.
const PACK_ISO3 = {
    usa: 'USA', ind: 'IND', jpn: 'JPN', aus: 'AUS', can: 'CAN',
    deu: 'DEU', gbr: 'GBR', fra: 'FRA', esp: 'ESP', rus: 'RUS', chn: 'CHN',
};

// Hardcoded mainland bounding boxes for countries whose GeoJSON includes
// distant overseas territories that would cause extreme zoom-out.
// Format: [[west, south], [east, north]]
const MAINLAND_BOUNDS = {
    'France':        [[ -5.1, 41.3], [  9.6, 51.1]],  // Metropolitan France
    'Netherlands':   [[  3.3, 50.7], [  7.2, 53.6]],  // European Netherlands
    'Norway':        [[  4.5, 57.9], [ 31.1, 71.2]],  // Mainland Norway
    'Russia':        [[ 19.6, 41.2], [180.0, 81.9]],  // Avoids antimeridian wrap
    'United States': [[-179.9, 18.9], [-66.9, 71.4]], // Contiguous 48 + Alaska
};

// Map themes — each defines water, land, background and border colors.
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