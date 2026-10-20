# Marin QR 0.1.1 release notes

Release date: 2026-10-20

## Summary

Marin QR now makes a chosen center image as large as the current QR code can conservatively support. The app keeps the image's shape, removes transparent outer space, protects required QR patterns, and checks the affected QR data before export.

## User-visible changes

- Center images are larger when the QR grid has room.
- Wide and tall images keep their shape instead of being cropped to a square.
- Transparent outer margins no longer make the visible image look needlessly small.
- The app description now says “Make a QR code for an approved Marin County link.”
- The design section heading is now “Design.”
- QR color controls are hidden for now. The default dark color is unchanged.

## Reliability changes

- The app maps the QR grid's protected and data modules.
- Protected finder, timing, format, version, and alignment patterns are restored above the center image.
- The center image is limited by QR width, height, area, and per-block error-correction budgets.
- The app checks candidate sizes at two raster scales and reduces the final size below the largest passing candidate.
- Export stays disabled until the latest QR code is ready.

## Runtime verification implementation

The implementation does not add the proposed jsQR runtime dependency. Instead, it uses the existing encoder's exact module map and Reed-Solomon block layout. It samples the composed QR at two raster sizes, counts changed codewords in each block, preserves protected structures, and accepts only results below a conservative correction budget. This keeps the app smaller and avoids a second QR library. The release tests still use independent QR decoders to confirm that the final canvas and downloaded PNG contain the exact expected link.

## Test coverage

The automated suite decodes:

- a QR code without a center image;
- a QR code with a larger square image;
- a QR code with a wide image and transparent margins;
- a long-link QR code that uses version and alignment structures;
- the downloaded PNG.

The suite also verifies the allowlist, tracking parameters, hidden color feature, clipboard actions, responsive layout, dark mode, App Shell integration, Content Security Policy, and production metadata.

## Manual release checks

Before promoting this alpha release, scan a plain code and a center-image code with at least two supported phone camera apps. Print each at its planned size and scan the printed copy under normal office lighting.
