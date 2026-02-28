// ─── samples.js ───────────────────────────────────────────────────────────────
// Shuffle datasets for the Map Engine's random sample feature.
// Loaded before script.js via <script> tag in index.html.
//
// Unified CSV format:
// Type, Name, Origin, Color, Fact, Details, Size, Label, ShowFact, Persist, PersistLabel, RecencyMode
// Origin: empty for polygons, country/region for cities
// Size:   border width (px) for polygons, dot radius (px) for cities

const SHUFFLE_POLYGON_DATASETS = [

    // 1 — G20 Major Economies
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