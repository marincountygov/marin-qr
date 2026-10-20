# Marin QR 0.1.2 release notes

Release date: 2026-10-20

## Summary

Marin QR can now export QR codes with a transparent background and download them as SVG files. Both options use the same checked QR data, center-image size, and final link as the preview and PNG output.

## User-visible changes

- Added a **Transparent background** checkbox under Design.
- Added a checker pattern in the preview so transparent areas are easy to see.
- Added **Download SVG** next to the existing PNG actions.
- Added short help text warning that transparent QR codes need a light, plain background.
- Added plain-language information about when to use PNG or SVG.

## Transparent output

White remains the default and safest background. When transparency is selected:

- the PNG keeps a real alpha channel;
- the SVG omits its white background rectangle;
- the four-module quiet zone remains present as transparent space;
- a center image keeps its white safety backing;
- PNG copy uses the same transparent output as PNG download.

The app cannot inspect the future document or surface behind a transparent code. Users must test the code on its final background.

## SVG output

- QR modules remain vector shapes and stay sharp when resized.
- The SVG contains an accessible title and description with the final link.
- A center image is converted to a local PNG data URL and embedded in the file.
- Prepared center images are limited to 1,600 pixels on their longest side before embedding to control file size.
- The SVG contains no script or external resource request.
- The same protected QR structures and center-image safety plan used by PNG output are used by SVG output.

## Dependencies

No new runtime dependency was added. SVG generation uses the existing QR model and local browser APIs.

## Test coverage

Automated browser tests now:

- confirm that default PNG output is opaque;
- confirm that transparent PNG output keeps an alpha channel;
- decode transparent PNG after placing it on white;
- parse and decode white SVG output;
- parse and decode transparent SVG output;
- parse and decode transparent SVG output with a center image;
- confirm that SVG files have no script or external resource;
- confirm that the center-image backing remains white;
- retain the full domain, tracking, image, clipboard, responsive, dark-mode, App Shell, and security test coverage.

## Manual release checks

Before promoting this alpha release:

1. Download PNG and SVG in each supported desktop browser.
2. Copy an opaque and transparent PNG where supported.
3. Place transparent PNG and SVG output on the exact light, plain background planned for use.
4. Scan white and transparent output with at least two supported phone camera apps.
5. Print PNG and SVG at the planned size and scan the printed copies.
