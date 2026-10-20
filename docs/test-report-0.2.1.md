# Marin QR 0.2.1 test report

Test date: 2026-10-20

## Environment

- Chromium 144.0.7559.96
- Python 3.13.5
- Node.js 22.16.0
- Playwright Python 1.57.0
- OpenCV 4.13.0
- NumPy 2.3.5
- pyzbar 0.1.9

## Passed checks

`bash scripts/check.sh --browser-in-memory` passed in full. This includes:

- generated security metadata synchronization;
- Marin App Shell version, manifest, and file-integrity checks;
- repository structure and Python syntax;
- JavaScript syntax for all local runtime files;
- security metadata tests;
- exact destination allowlist and subdomain-policy tests;
- App Shell component integration;
- Content Security Policy allow/deny probes;
- the complete curated parameter-name list and descriptions;
- an empty initial Value with `flyer` as placeholder text;
- an untouched starter row that does not alter or block a valid destination;
- type-to-filter behavior using an option description;
- keyboard opening, filtering, and selection;
- touch opening and option selection in the mobile context;
- clearing the Value and changing its placeholder when the selected name changes;
- accepted custom parameter serialization;
- invalid custom parameter-name rejection;
- duplicate parameter-name rejection;
- preservation of the destination's existing query parameters and fragment;
- URL, image, clipboard, and export workflows;
- 320 CSS pixel mobile reflow with the selector open;
- light and dark mode rendering;
- opaque and transparent PNG alpha verification;
- plain and center-image QR decoding;
- transparent PNG decoding after white compositing;
- white and transparent SVG structure and decoding;
- transparent SVG decoding with an embedded center image;
- SVG title, final-link description, and external-resource checks;
- transparent-edge trimming and image proportion checks;
- center-image width, height, area, and correction-budget checks;
- hidden color control and retained color-code checks.

The workflow test independently decodes the generated canvas, downloaded PNG files, and rasterized SVG files back to the exact final URL.

## Accessibility inspection

The browser accessibility snapshot exposed:

- each row as a numbered tracking-detail group;
- a labeled Parameter name button with the selected name and description;
- a labeled filter combobox;
- a labeled listbox with Campaign tracking, General, and Other groups;
- selected and active options;
- a labeled Value field with placeholder semantics;
- a numbered Remove action.

The automated workflow also verifies keyboard focus transfer into the filter, Arrow-key opening, Enter selection, validation errors, `aria-invalid`, and keyboard-compatible removal.

## Visual review

Automated screenshots were reviewed at:

- 1,440 by 1,000 CSS pixels in light mode;
- 320 by 844 CSS pixels in dark mode with the selector open;
- 1,440 by 1,000 CSS pixels with the list filtered to `campaign`.

The desktop picker displayed the two matching results (`utm_campaign` and `campaign`) with their descriptions. The mobile picker remained within the viewport and presented a vertical, scrollable option list. An initial interaction between Pico's generic `[role="group"]` styling and the ARIA option groups was found during review and corrected before the final test run.

## Environment-limited HTTP check

`bash scripts/check.sh --browser` completed static, syntax, security, and metadata checks, but Chromium navigation to the local test server was blocked by the execution environment:

```text
net::ERR_BLOCKED_BY_ADMINISTRATOR at http://127.0.0.1:<port>/template-test/
```

The in-memory component, CSP, full application workflow, PNG, SVG, responsive, and QR decoding suites passed. A local or deployed HTTP smoke test remains required before promotion.

## Manual checks not performed here

- Screen-reader review in each County-supported browser and screen-reader combination.
- Browser zoom review at 200% and 400% outside the automated viewport checks.
- Physical phone scanning.
- Printing PNG and SVG output at the planned size and scanning the printed copy.
- Clipboard behavior in each County-supported desktop browser without test mocks.
- Full deployed GitHub Pages navigation and HTTP response behavior.
