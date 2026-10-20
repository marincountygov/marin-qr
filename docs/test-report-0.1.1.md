# Marin QR 0.1.1 test report

Test date: 2026-10-20

## Environment

- Chromium 144.0.7559.96
- Python 3.13.5
- Node.js 22.16.0
- OpenCV 4.13.0
- pyzbar 0.1.9

## Passed checks

`bash scripts/check.sh --browser-in-memory` passed in full. This includes:

- generated security metadata synchronization;
- Marin App Shell manifest and file-integrity checks;
- repository structure and Python syntax;
- JavaScript syntax for all local runtime files;
- security metadata tests;
- exact allowlist and subdomain policy tests;
- App Shell component integration;
- Content Security Policy allow/deny probes;
- URL, tracking, image, clipboard, and export workflows;
- 320 CSS pixel mobile reflow and dark mode;
- plain QR decoding;
- larger square center-image QR decoding;
- wide transparent center-image QR decoding;
- long-link QR decoding with QR version and alignment structures;
- downloaded PNG decoding;
- transparent-edge trimming and image proportion checks;
- center-image width, height, area, and error-correction budget checks;
- hidden color control and retained color-code checks.

The browser workflow decodes each tested QR payload and compares it with the final URL. It uses pyzbar when available and OpenCV as a fallback.

An additional sizing matrix generated and decoded square, wide, and tall images at QR versions 3, 5, 10, 14, and 20. All 15 outputs decoded to the exact expected URL. This check confirmed that image dimensions grow with the available QR grid while preserving each image's proportions.

## Visual review

Automated screenshots were reviewed at:

- 1,440 by 1,000 CSS pixels in light mode;
- 320 by 844 CSS pixels in dark mode.

The workflow reflowed without horizontal page overflow. The hidden QR color controls were absent, the “Design” heading was present, and wide images kept their proportions in both the file preview and generated QR.

## Environment-limited check

`bash scripts/check.sh --browser` completed static, syntax, security, and metadata checks, but Chromium navigation to the local test server was blocked by the execution environment:

```text
net::ERR_BLOCKED_BY_ADMINISTRATOR at http://127.0.0.1:<port>/template-test/
```

This is the same host policy that affected the 0.1.0 build. The in-memory workflow and separate CSP fixture passed. A local or deployed HTTP smoke test is still required before promotion.

## Manual checks not performed here

- Scanning with physical phone camera apps.
- Printing at the planned size and scanning the printed copy.
- Clipboard behavior in each County-supported desktop browser without test mocks.
- Full deployed GitHub Pages navigation and HTTP response behavior.
