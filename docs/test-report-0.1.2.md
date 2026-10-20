# Marin QR 0.1.2 test report

Test date: 2026-10-20

## Environment

- Chromium 144.0.7559.96
- Python 3.13.5
- Node.js 22.16.0 for direct syntax checks; Playwright driver reported Node.js 24.11.1
- OpenCV 4.13.0
- NumPy 2.3.5
- pyzbar 0.1.9

## Passed checks

`bash scripts/check.sh --browser-in-memory` passed in full. This includes:

- generated security metadata synchronization;
- Marin App Shell manifest and file-integrity checks;
- repository structure and Python syntax;
- JavaScript syntax for all local runtime files;
- security metadata tests;
- exact allowlist and subdomain-policy tests;
- App Shell component integration;
- Content Security Policy allow/deny probes;
- URL, tracking, image, clipboard, and export workflows;
- 320 CSS pixel mobile reflow and dark mode;
- opaque PNG alpha verification;
- transparent PNG alpha verification;
- plain and center-image QR decoding;
- transparent PNG decoding after white compositing;
- white SVG structure and decoding;
- transparent SVG structure and decoding;
- transparent SVG decoding with an embedded center image;
- SVG title and final-link description checks;
- rejection of SVG scripts and external resource references;
- white center-image backing verification;
- downloaded transparent PNG decoding;
- transparent-edge trimming and image proportion checks;
- center-image width, height, area, and error-correction budget checks;
- hidden color control and retained color-code checks.

The SVG tests download the real generated file, parse its XML, rasterize it in Chromium, and decode the rasterized image back to the exact final URL. The PNG tests inspect the actual alpha channel and decode after compositing transparency onto white.

## Visual review

Automated screenshots were reviewed at:

- 1,440 by 1,000 CSS pixels in light mode with transparent output and a center image;
- 320 by 844 CSS pixels in dark mode.

The layout reflowed without horizontal page overflow. The new checkbox and SVG button fit the existing Design and Preview areas. The checker pattern made transparency visible without changing the exported file.

## Environment-limited check

`bash scripts/check.sh --browser` completed static, syntax, security, and metadata checks, but Chromium navigation to the local test server was blocked by the execution environment:

```text
net::ERR_BLOCKED_BY_ADMINISTRATOR at http://127.0.0.1:<port>/template-test/
```

The in-memory component, CSP, workflow, PNG, and SVG suites passed. A local or deployed HTTP smoke test is still required before promotion.

## Manual checks not performed here

- Scanning with physical phone camera apps.
- Testing transparent output on the exact final document or surface.
- Printing PNG and SVG at the planned size and scanning the printed copy.
- Clipboard behavior in each County-supported desktop browser without test mocks.
- Full deployed GitHub Pages navigation and HTTP response behavior.
