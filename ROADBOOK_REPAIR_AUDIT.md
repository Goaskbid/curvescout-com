# CurveScout.com v1.4.6 Roadbook Layout Audit

## Scope
This release preserves the stable search, OSM map, Google/OSM/GPX export and media-loading runtime, and changes only the roadbook presentation/content layer plus scoped CSS overrides.

## Fixes
- Riding-order preview is now compact and section-led.
- Checkpoints are no longer duplicated as full text cards in the preview; they remain visible as map/export anchors and in the checkpoint strip.
- Road section preview text is short and limited to essential road character.
- Detailed Roadbook sections now show variable context cards only when relevant.
- The same generic Weather/Traffic/Safety/Road Status/Fuel/Food/Sights/Water grid is no longer forced onto every section.
- Action chips are now generated from the relevant context cards only.
- Section cards use responsive grid constraints so text no longer spills over the image column.

## Content rule
- Checkpoints: brief purpose only.
- Sections: actual rider value: road character, traffic, road status, safety, fuel, food/rest, sights/photo, water/swim when relevant.
- No repeated generic “see yourself” links as a default list.

## Regression proof
- Search audit passed.
- Transfer audit passed.
- Deployment audit passed.
- Roadbook runtime helper audit passed.
- JavaScript syntax check passed.
