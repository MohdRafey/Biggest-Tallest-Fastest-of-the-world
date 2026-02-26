🌍 **Biggest-Tallest-Fastest-of-the-world**
An automated, cinematic map exploration engine designed to showcase global superlatives. Built with MapLibre GL JS, this tool uses a "Tour-as-Code" approach to fly users across the globe, highlighting record-breaking locations with precision.

🚀 The Engine
This project isn't just a map; it's a Geospatial Presentation Engine. It solves common mapping hurdles like name ambiguity (e.g., distinguishing between Georgia the country and Georgia the US state) and dynamic boundary loading.

Key Capabilities:
>> Cinematic Transitions: Smooth flight paths between points of interest with adjustable speeds.

>> Intelligent Disambiguation: Use Type (for regions) or Origin Country (for cities) to ensure the engine hits the exact record-holding location.

>> Dynamic UI: A searchable multi-select system to load high-detail regional data (Admin-1) only when needed.


**Polygon CSV Reference**
**Column order**
Type, Name, Color, BorderWidth, Label, ShowFact, Persist, PersistLabel, RecencyMode, Fact, Details

**Type**
Tells the engine what kind of geographic feature to look up.
Accepted values: Country, State, Province

**Name**
The name of the region to highlight. Must match the name in the data source exactly. For countries this matches the world boundaries file. For states and provinces this matches the loaded regional pack.

**Color**
The fill and border color of the highlight in hex format. Example: #e74c3c
This is the active color — the color shown while this row is the current stop.

**BorderWidth**
Thickness of the polygon outline in pixels. Accepts decimals. Example: 1.5

**Label**
Whether to show the region name as a text marker floating over the polygon while this stop is active.
true — name appears over the polygon during the stop.
false — no text over the polygon. Useful for dense maps where labels would overlap.

**ShowFact**
Whether to show the fact card at the top of the screen during this stop.
true — fact card appears with the Fact and Details values.
false — no fact card. The polygon highlights silently. Useful for orientation stops where you just want the viewer to see the geography.

**Persist**
Whether the polygon highlight stays on the map after the tour moves to the next stop.
true — highlight remains.
false — highlight is fully cleared when leaving this stop. PersistLabel and RecencyMode are ignored when this is false.

**PersistLabel**
Whether the text label stays over the polygon after leaving this stop. Only meaningful when Persist=true and Label=true.
true — label remains floating over the polygon after moving on.
false — label is removed when leaving even though the polygon stays.
Ignored when RecencyMode=true since accumulated labels create visual clutter as the tour progresses.

**RecencyMode**
Whether the polygon gets repainted to the recency color when the tour moves on. Only meaningful when Persist=true.
true — on leaving this stop the polygon color fades to the recency color defined in the customizer, indicating a visited region. The label is always removed regardless of PersistLabel.
false — polygon retains its original Color after leaving.

**Fact**
The main headline text shown in the fact card. Short and bold. Only displayed when ShowFact=true.

**Details**
The supporting text shown below the fact headline in the fact card. Can be longer. Only displayed when ShowFact=true.