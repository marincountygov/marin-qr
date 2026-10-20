# Marin QR 0.2.1 release notes

Release date: 2026-10-20

## Summary

Marin QR now uses a searchable list of common query parameter names instead of an unrestricted name field. Staff can filter the list by typing, choose a standard name, or select **Custom…** when another name is required.

The value field remains empty until the user enters a value. Examples such as `flyer` and `qr` appear only as placeholders and are never added to the final link automatically.

## Parameter selector

The selector includes:

- the five standard UTM names;
- common general-purpose names such as `ref`, `event`, `location`, `lang`, and `program`;
- short descriptions that can also be searched;
- a Custom option that reveals a separate parameter-name field.

The options are grouped as **Campaign tracking**, **General**, and **Other**. The selector supports pointer use and keyboard operation, including direct typing, Arrow keys, Home, End, Enter, Escape, and Tab.

## Value behavior

- New rows start with `utm_source` selected.
- The Value field starts empty and shows `flyer` as placeholder text.
- Other selections provide relevant examples, such as `qr`, `flu_2026`, `poster_a`, `health_fair`, and `es`.
- Changing the selected parameter clears the current value so a value cannot be accidentally reused for a different name.
- An untouched starter row remains optional and does not block QR generation.

## Validation

- Custom names must begin with a letter or number.
- Custom names may contain letters, numbers, underscores, hyphens, periods, and tildes.
- Custom names are limited to 64 characters.
- Duplicate names among the helper rows are rejected.
- Existing query parameters already present in the pasted destination remain unchanged.
- The literal selector value `custom` is never inserted into the URL.

## Interface text changes

- Removed: “Paste the full link. It must use an approved Marin County website.”
- Shortened the image help to: “Use PNG, JPG, or WebP file.”
- Renamed the visible image field label from “Center image (optional)” to “Image.” The field remains optional.

## Dependencies and privacy

No runtime dependency was added. The selector, filtering, validation, URL construction, and QR generation all remain local to the browser. No entered link, parameter, value, or image is uploaded.

## Test coverage

Automated tests now cover:

- the complete curated option list and descriptions;
- an empty default value with `flyer` as placeholder;
- filtering by an option description;
- keyboard and touch selection;
- value clearing and contextual placeholder changes;
- accepted and rejected custom names;
- duplicate-name prevention;
- preservation of existing query parameters and fragments;
- mobile reflow with the selector open;
- all existing URL, QR decode, PNG, SVG, image, clipboard, security, light-mode, and dark-mode checks.

## Manual release checks

Before promotion:

1. Review the selector in each County-supported desktop browser.
2. Complete the selector workflow using only a keyboard and a screen reader.
3. Confirm the popup remains readable at 200% and 400% browser zoom.
4. Test a Custom parameter that the destination site is known to support.
5. Scan and print-test representative QR output as described in the main release checklist.
