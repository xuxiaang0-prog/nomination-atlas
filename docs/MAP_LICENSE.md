# Australia map data and licence

`apps/web/src/australia-map.json` is derived from Natural Earth 1:50m Admin 1 States and Provinces, version 5.1.1. The source archive contains all eight requested Australian state/territory features; none of their boundaries was invented.

- Dataset: https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-1-states-provinces/
- Original download: https://naturalearth.s3.amazonaws.com/50m_cultural/ne_50m_admin_1_states_provinces.zip
- Official terms: https://www.naturalearthdata.com/about/terms-of-use/
- Terms checked: 8 October 2026.

Natural Earth declares its vector and raster datasets public domain. It permits modification, redistribution, and personal, educational, or commercial use without permission or mandatory attribution. Optional credit: Made with Natural Earth.

## Transformation and scope

The asset preserves the source polygon rings for WA, NT, SA, QLD, NSW, VIC, TAS and ACT. It uses ellipsoidal Australian Albers projection parameters (central meridian 132°E, standard parallels 18°S and 36°S, GRS80), then fits the north-up geometry into an 800 × 760 SVG view box. It rounds display coordinates to 0.01 SVG units; no simplification or boundary synthesis is applied. Natural Earth WGS84 coordinates are treated as display coordinates without a datum correction. This is an overview map, not cadastral or survey data.

ACT retains its true small polygon. Its separate label and leader line are a presentation callout, not an enlarged boundary. Jervis Bay Territory and external territories are outside the product's eight-jurisdiction scope and are not reassigned to another state.

Source ZIP SHA-256: `61f79e6705e62a55d6bcf698394295a589af5e24a4b2684c6519dd35c1300bf6`.

Projection parameters independently checked against Geoscience Australia's DEA reference: https://knowledge.dea.ga.gov.au/notebooks/How_to_guides/Planetary_computer/

## Component use

Import the JSON, use its `viewBox`, and render each state's `path` with SVG `fillRule="evenodd"`. Render the label at `label.x`, `label.y`. ACT's `callout` provides the label position plus `anchorX` and `anchorY` for a leader line or a clickable marker; render ACT last so the real polygon stays above NSW. A marker is an interaction aid and should remain distinct from the boundary.

The map asset provides geography only. Nomination allocations, invitation records and policy evidence must come from their separately tracked sources.
