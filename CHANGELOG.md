# Changelog

All notable changes to Marin QR are documented here.

## 0.2.1 - 2026-10-20

### Added

- Searchable, keyboard-operable parameter selector with grouped standard names and short descriptions.
- Custom parameter option with a conditionally shown, validated name field.
- Contextual value placeholders such as `flyer`, `qr`, and `health_fair`; placeholders are never inserted as values.
- Duplicate-name validation for tracking details.
- Automated coverage for filtering, keyboard and touch selection, custom names, value clearing, placeholders, duplicate prevention, and mobile reflow with the selector open.

### Changed

- Replaced the unrestricted tracking-name text field with the curated selector.
- New tracking rows start with `utm_source` selected and an empty value. An untouched starter row remains optional.
- Removed the destination helper sentence “Paste the full link. It must use an approved Marin County website.”
- Shortened the image help to “Use PNG, JPG, or WebP file.”
- Renamed the visible “Center image (optional)” label to “Image”; the field remains optional.

## 0.1.2 - 2026-10-20

### Added

- Optional transparent background for preview, PNG download, PNG copy, and SVG export.
- SVG download with vector QR modules, accessible title and description, and no external resources.
- Local PNG embedding for center images in SVG files, with a 1,600-pixel longest-side limit.
- Automated alpha-channel checks and independent decoding of opaque, transparent, and center-image SVG output.

### Changed

- The preview now uses a checker pattern when transparency is selected.
- A center image keeps its white safety backing in transparent output.
- Export actions now share the same checked QR model, center-image plan, color, and background choice.

## 0.1.1 - 2026-10-20

### Added

- Automatic center-image sizing based on the generated QR grid, image shape, protected QR structures, and a conservative error-correction budget.
- Transparent-edge trimming that runs in the browser and keeps the visible image's original proportions.
- Protection for finder, timing, format, version, and alignment patterns when a center image is drawn.
- Responsive checking states that disable export until the latest QR code is ready.
- Browser tests for larger square images, wide transparent images, long links, protected patterns, and exported PNG decoding.

### Changed

- Updated the app description to “Make a QR code for an approved Marin County link.”
- Renamed the “Look” section to “Design.”
- Center images are no longer cropped to a square.
- Hidden the QR color controls while keeping their validation and rendering code available for a later release.

## 0.1.0 - 2026-10-20

### Added

- Complete HTTPS URL entry with parsed hostname validation.
- Auditable domain allowlist for `marincounty.gov`, `marinhhs.org`, `marincountygov.github.io`, and `marinmap.org`, including the approved subdomain rules.
- Optional tracking name/value rows that preserve existing URL queries and fragments.
- Live QR preview with a visible final URL.
- Dark QR color picker with a scan-reliability contrast check.
- Optional local PNG, JPEG, or WebP center image with file-size, type, and dimension limits.
- High-error-correction QR rendering, fixed white background, four-module quiet zone, and high-resolution PNG output.
- Download PNG, Copy PNG, and Copy link actions.
- Browser-only processing with no app backend or runtime network dependency.
- Plain-language About and Accessibility content.
- Domain, validation, responsive-layout, clipboard, download, and QR decode tests.
