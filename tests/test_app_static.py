#!/usr/bin/env python3
"""Read-only checks for Marin QR's app-owned policy and static architecture."""
from __future__ import annotations

from html.parser import HTMLParser
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]


class SourceParser(HTMLParser):
    def __init__(self, source: str) -> None:
        super().__init__()
        self.scripts: list[str] = []
        self.styles: list[str] = []
        self.labels_for: set[str] = set()
        self.inputs: dict[str, dict[str, str | None]] = {}
        self.elements: dict[str, dict[str, str | None]] = {}
        self.feed(source)

    def handle_starttag(self, tag: str, attrs) -> None:
        values = dict(attrs)
        if values.get("id"):
            self.elements[values["id"]] = values
        if tag == "script" and values.get("src"):
            self.scripts.append(values["src"])
        if tag == "link" and values.get("rel") == "stylesheet":
            self.styles.append(values["href"])
        if tag == "label" and values.get("for"):
            self.labels_for.add(values["for"])
        if tag == "input" and values.get("id"):
            self.inputs[values["id"]] = values


class MarinQrStaticTests(unittest.TestCase):
    def setUp(self) -> None:
        self.html = (ROOT / "index.html").read_text(encoding="utf-8")
        self.app_js = (ROOT / "assets/app.js").read_text(encoding="utf-8")
        self.image_js = (ROOT / "assets/qr-image.js").read_text(encoding="utf-8")
        self.safety_js = (ROOT / "assets/qr-safety.js").read_text(encoding="utf-8")
        self.domains_js = (ROOT / "assets/authorized-domains.js").read_text(encoding="utf-8")

    def test_authorized_domain_policy_is_exact(self) -> None:
        entries = re.findall(
            r'domain:\s*"([a-z0-9.-]+)",\s*allowSubdomains:\s*(true|false)',
            self.domains_js,
        )
        self.assertEqual(entries, [
            ("marincounty.gov", "true"),
            ("marinhhs.org", "true"),
            ("marincountygov.github.io", "false"),
            ("marinmap.org", "true"),
        ])
        self.assertNotRegex(self.domains_js, r'domain:\s*["\']\*')

    def test_optional_public_https_mode_is_documented(self) -> None:
        parser = SourceParser(self.html)
        self.assertIn("destination-mode", parser.elements)
        self.assertIn("hidden", parser.elements["destination-mode"])
        self.assertEqual(parser.elements["destination-mode"].get("role"), "status")
        self.assertIn("allowed-websites-help", parser.elements)
        self.assertIn("Any HTTPS link", self.html)
        self.assertIn("https://marincountygov.github.io/marin-qr/?dest=any", self.html)
        self.assertIn('parameters.getAll("dest")', self.app_js)
        self.assertIn('overrides.length === 1 && overrides[0] === "any"', self.app_js)
        self.assertIn('(!allowAnyHttpsDestination && !isAllowedHostname(hostname))', self.app_js)
        self.assertIn('refs.destinationMode.hidden = !allowAnyHttpsDestination', self.app_js)
        self.assertIn('refs.allowedWebsitesHelp.hidden = allowAnyHttpsDestination', self.app_js)

    def test_app_has_no_network_or_persistent_storage_api(self) -> None:
        app_sources = "\n".join((self.app_js, self.image_js, self.safety_js))
        for name in (
            "fetch(", "XMLHttpRequest", "WebSocket", "EventSource", "sendBeacon",
            "localStorage", "sessionStorage", "indexedDB", "document.cookie",
        ):
            self.assertNotIn(name, app_sources)
        self.assertNotRegex(self.domains_js, r"https?://")

    def test_runtime_scripts_are_local_and_ordered(self) -> None:
        parser = SourceParser(self.html)
        self.assertEqual(parser.scripts, [
            "vendor/marinos/marinos.js",
            "vendor/qrcode/qrcode.js",
            "assets/authorized-domains.js",
            "assets/qr-image.js",
            "assets/qr-safety.js",
            "assets/app.js",
        ])
        self.assertEqual(parser.styles, [
            "vendor/marinos/marinos.css",
            "assets/app.css",
        ])
        self.assertTrue(all("://" not in value for value in parser.scripts + parser.styles))

    def test_static_form_controls_are_labeled(self) -> None:
        parser = SourceParser(self.html)
        for control_id in (
            "destination-url",
            "qr-color-text",
            "transparent-background",
            "center-image",
        ):
            self.assertIn(control_id, parser.labels_for)
        self.assertEqual(parser.inputs["qr-color"].get("aria-label"), "Choose QR code color")

    def test_color_picker_is_hidden_but_implementation_remains(self) -> None:
        parser = SourceParser(self.html)
        self.assertIn("hidden", parser.elements["qr-color-field"])
        self.assertIn("qrColorPicker: false", self.app_js)
        self.assertIn("validateColor", self.app_js)
        self.assertIn('refs.color.addEventListener("input"', self.app_js)
        self.assertIn('refs.colorText.addEventListener("input"', self.app_js)

    def test_transparent_background_and_svg_export_are_present(self) -> None:
        parser = SourceParser(self.html)
        background = parser.inputs["transparent-background"]
        self.assertEqual(background.get("type"), "checkbox")
        self.assertNotIn("checked", background)
        self.assertEqual(background.get("aria-describedby"), "background-help")
        self.assertIn("Use this only on a light, plain background.", self.html)
        self.assertIn('id="download-svg"', self.html)
        self.assertIn("Download SVG", self.html)
        self.assertIn('refs.transparentBackground.addEventListener("change"', self.app_js)
        self.assertIn('new Blob([svg], { type: "image/svg+xml;charset=utf-8" })', self.app_js)
        self.assertIn('saveBlob(svgToBlob(), "marin-qr.svg")', self.app_js)
        self.assertIn("function toSvg(", self.safety_js)
        self.assertIn('data-background="${transparentBackground ? "transparent" : "white"}"',
                      self.safety_js)
        self.assertIn("const SVG_EMBEDDED_IMAGE_MAX_SIDE = 1600", self.safety_js)
        self.assertIn("transparentBackground", self.safety_js)

    def test_approved_text_changes_are_present(self) -> None:
        self.assertIn(
            'app-description="Make a QR code for an approved Marin County link."',
            self.html,
        )
        self.assertIn('<h3 id="look-heading">Design</h3>', self.html)
        self.assertIn('<label for="center-image">Image</label>', self.html)
        self.assertIn("Use PNG, JPG, or WebP file.", self.html)
        self.assertNotIn("Make a QR code for an approved Marin County website.", self.html)
        self.assertNotIn(
            "Paste the full link. It must use an approved Marin County website.",
            self.html,
        )
        self.assertNotIn('id="destination-help"', self.html)
        self.assertNotIn("Center image <span", self.html)
        self.assertNotIn("The app keeps its shape and fits it inside the code.", self.html)

    def test_parameter_selector_is_curated_searchable_and_customizable(self) -> None:
        options = re.findall(
            r'\{ value: "([a-z_]+)", (?:label: "[^"]+", )?description: "([^"]+)"',
            self.app_js,
        )
        self.assertEqual(options, [
            ("utm_source", "Traffic source"),
            ("utm_medium", "Marketing channel"),
            ("utm_campaign", "Campaign name"),
            ("utm_content", "Link or placement variant"),
            ("utm_term", "Keyword or audience"),
            ("ref", "Referral source"),
            ("source", "Origin of visit"),
            ("campaign", "Campaign identifier"),
            ("event", "Event identifier"),
            ("location", "Location identifier"),
            ("lang", "Language preference"),
            ("category", "Content category"),
            ("topic", "Topic identifier"),
            ("id", "Record identifier"),
            ("form", "Form identifier"),
            ("program", "Program identifier"),
        ])
        self.assertIn('label: "Custom…", description: "Enter a parameter name"', self.app_js)
        self.assertIn('const DEFAULT_PARAMETER_NAME = "utm_source"', self.app_js)
        self.assertIn('utm_source: "flyer"', self.app_js)
        self.assertIn('search.setAttribute("role", "combobox")', self.app_js)
        self.assertIn('listbox.setAttribute("role", "listbox")', self.app_js)
        self.assertIn('search.placeholder = "Type to filter"', self.app_js)
        self.assertIn('makeLabel("Custom parameter name", customInput)', self.app_js)
        self.assertIn("Use each tracking detail name only once.", self.app_js)
        self.assertNotIn('nameInput.type = "text"', self.app_js)

    def test_reliability_and_image_limits_are_present(self) -> None:
        self.assertIn("const QUIET_ZONE_MODULES = 4", self.safety_js)
        self.assertIn("const MAX_BACKING_WIDTH_FRACTION = 0.30", self.safety_js)
        self.assertIn("const MAX_BACKING_AREA_FRACTION = 0.08", self.safety_js)
        self.assertIn("const SAFE_CORRECTION_FRACTION = 0.65", self.safety_js)
        self.assertIn("protectedModules", self.safety_js)
        self.assertIn("QRRSBlock.getRSBlocks", self.safety_js)
        self.assertIn("const MIN_CONTRAST_WITH_WHITE = 7", self.app_js)
        self.assertIn("QRErrorCorrectLevel.H", self.app_js)
        self.assertIn('"image/png", "image/jpeg", "image/webp"', self.app_js)
        self.assertNotIn('"image/svg+xml"', self.app_js)

    def test_image_preparation_preserves_shape_and_trims_transparency(self) -> None:
        self.assertIn("findVisibleBounds", self.image_js)
        self.assertIn("ALPHA_THRESHOLD", self.image_js)
        self.assertIn("sourceContext.getImageData", self.image_js)
        self.assertNotIn("Math.max(imageSize", self.image_js)

    def test_qr_license_and_privacy_metadata_are_present(self) -> None:
        self.assertIn("MIT License", (ROOT / "vendor/qrcode/LICENSE.txt").read_text(encoding="utf-8"))
        self.assertTrue((ROOT / "vendor/qrcode/SOURCE-PACKAGE-LICENSE.txt").is_file())
        security = json.loads((ROOT / "security.json").read_text(encoding="utf-8"))
        self.assertFalse(security["data"]["collectsUserData"])
        self.assertFalse(security["data"]["storesPersonalInformation"])
        self.assertEqual(security["csp"]["directives"]["script-src"], ["'self'"])

    def test_no_template_placeholders_remain_in_app_owned_files(self) -> None:
        files = [
            ROOT / "index.html", ROOT / "marin.yml", ROOT / "README.md",
            ROOT / "SECURITY.md", ROOT / "security.json", ROOT / "AGENTS.md",
        ]
        for path in files:
            self.assertNotRegex(path.read_text(encoding="utf-8"), r"APP_(?:NAME|DESCRIPTION|OWNER|REPO)")


if __name__ == "__main__":
    unittest.main(verbosity=2)
