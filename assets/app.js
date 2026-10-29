/*
 * Marin QR
 * All link, image, and QR work stays in the browser. No app data is sent or
 * stored. Shared navigation, copy feedback, and app information are owned by
 * the MarinOS App Shell.
 */

(() => {
  "use strict";

  const MAX_PARAMETER_ROWS = 20;
  const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
  const MAX_IMAGE_SIDE = 4096;
  const TARGET_PNG_SIZE = 2048;
  const MIN_CONTRAST_WITH_WHITE = 7;
  const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
  const DEFAULT_PARAMETER_NAME = "utm_source";
  const CUSTOM_PARAMETER_VALUE = "custom";
  const MAX_CUSTOM_PARAMETER_NAME_LENGTH = 64;
  const CUSTOM_PARAMETER_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._~-]*$/;
  const PARAMETER_OPTIONS = Object.freeze([
    { value: "utm_source", description: "Traffic source", group: "Campaign tracking" },
    { value: "utm_medium", description: "Marketing channel", group: "Campaign tracking" },
    { value: "utm_campaign", description: "Campaign name", group: "Campaign tracking" },
    { value: "utm_content", description: "Link or placement variant", group: "Campaign tracking" },
    { value: "utm_term", description: "Keyword or audience", group: "Campaign tracking" },
    { value: "ref", description: "Referral source", group: "General" },
    { value: "source", description: "Origin of visit", group: "General" },
    { value: "campaign", description: "Campaign identifier", group: "General" },
    { value: "event", description: "Event identifier", group: "General" },
    { value: "location", description: "Location identifier", group: "General" },
    { value: "lang", description: "Language preference", group: "General" },
    { value: "category", description: "Content category", group: "General" },
    { value: "topic", description: "Topic identifier", group: "General" },
    { value: "id", description: "Record identifier", group: "General" },
    { value: "form", description: "Form identifier", group: "General" },
    { value: "program", description: "Program identifier", group: "General" },
    { value: CUSTOM_PARAMETER_VALUE, label: "Custom…", description: "Enter a parameter name", group: "Other" }
  ]);
  const PARAMETER_PLACEHOLDERS = Object.freeze({
    utm_source: "flyer",
    utm_medium: "qr",
    utm_campaign: "flu_2026",
    utm_content: "poster_a",
    utm_term: "seniors",
    ref: "library",
    source: "outreach",
    event: "health_fair",
    location: "novato",
    lang: "es"
  });
  const FEATURES = Object.freeze({
    qrColorPicker: false
  });

  // The app URL can opt into broader destinations. This is a public mode,
  // not an authentication or access-control mechanism.
  const allowAnyHttpsDestination = (() => {
    const parameters = new URLSearchParams(window.location.search);
    const overrides = parameters.getAll("dest");
    return overrides.length === 1 && overrides[0] === "any";
  })();

  const state = {
    parameterId: 0,
    updateTimer: null,
    imageToken: 0,
    generationToken: 0,
    generating: false,
    logo: null,
    finalUrl: "",
    renderResult: null,
    openParameterPicker: null
  };

  let refs;

  function byId(id) {
    return document.getElementById(id);
  }

  function announce(message) {
    const status = byId("app-status-message");
    if (!status) return;
    status.textContent = "";
    window.requestAnimationFrame(() => {
      status.textContent = message;
    });
  }

  function setFieldError(input, error, message) {
    input.setAttribute("aria-invalid", "true");
    error.textContent = message;
    error.hidden = false;
  }

  function clearFieldError(input, error) {
    input.removeAttribute("aria-invalid");
    error.textContent = "";
    error.hidden = true;
  }

  function isAllowedHostname(hostname) {
    return window.MarinQrAuthorizedDomains.some((entry) => {
      if (hostname === entry.domain) return true;
      return entry.allowSubdomains && hostname.endsWith(`.${entry.domain}`);
    });
  }

  function parseDestination(rawValue) {
    const raw = rawValue.trim();
    if (!raw) return { empty: true };

    let url;
    try {
      url = new URL(raw);
    } catch {
      return {
        error: "Enter a full web address, such as https://hhs.marincounty.gov/services."
      };
    }

    if (url.protocol !== "https:") {
      return { error: "Use a secure HTTPS link." };
    }

    if (url.username || url.password) {
      return { error: "Remove the user name or password from this link." };
    }

    if (url.port) {
      return { error: "Remove the extra number after the website name." };
    }

    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (!hostname || (!allowAnyHttpsDestination && !isAllowedHostname(hostname))) {
      return { error: "Use a link from an approved Marin County website." };
    }

    url.hostname = hostname;
    return { url };
  }

  function normalizeHexColor(value) {
    const clean = value.trim().toLowerCase();
    if (/^[0-9a-f]{6}$/.test(clean)) return `#${clean}`;
    if (/^#[0-9a-f]{6}$/.test(clean)) return clean;
    return null;
  }

  function relativeLuminance(hex) {
    const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
    const linear = channels.map((channel) => (
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4
    ));
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  }

  function contrastWithWhite(hex) {
    return 1.05 / (relativeLuminance(hex) + 0.05);
  }

  function validateColor() {
    const color = normalizeHexColor(refs.colorText.value);
    if (!color) {
      setFieldError(
        refs.colorText,
        refs.colorError,
        "Enter six letters or numbers, such as #1f1f1f."
      );
      return null;
    }

    if (contrastWithWhite(color) < MIN_CONTRAST_WITH_WHITE) {
      setFieldError(
        refs.colorText,
        refs.colorError,
        "Choose a darker color. Light QR codes may not scan."
      );
      return null;
    }

    clearFieldError(refs.colorText, refs.colorError);
    refs.color.value = color;
    return color;
  }

  function makeLabel(text, input) {
    const label = document.createElement("label");
    label.htmlFor = input.id;
    label.textContent = text;
    label.append(input);
    return label;
  }

  function cancelScheduledUpdate() {
    window.clearTimeout(state.updateTimer);
    state.updateTimer = null;
  }

  function setExportActionsEnabled(enabled) {
    refs.downloadPng.disabled = !enabled;
    refs.downloadSvg.disabled = !enabled;
    refs.copyPng.disabled = !enabled;
    refs.copyUrl.disabled = !enabled;
  }

  function exportsAreReady() {
    return Boolean(
      state.finalUrl
      && state.renderResult
      && !state.updateTimer
      && !state.generating
    );
  }

  function getParameterOption(value) {
    return PARAMETER_OPTIONS.find((option) => option.value === value) || null;
  }

  function getParameterPlaceholder(value) {
    return PARAMETER_PLACEHOLDERS[value] || "Enter a value";
  }

  function createParameterPicker(id, initialValue, errorId, onSelectionChange) {
    const field = document.createElement("div");
    field.className = "qr-parameter-name-field";

    const label = document.createElement("label");
    label.id = `parameter-name-label-${id}`;
    label.textContent = "Parameter name";

    const picker = document.createElement("div");
    picker.className = "qr-parameter-picker";

    const trigger = document.createElement("button");
    trigger.id = `parameter-name-${id}`;
    trigger.type = "button";
    trigger.className = "qr-parameter-picker__trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-describedby", errorId);
    label.htmlFor = trigger.id;

    const triggerText = document.createElement("span");
    triggerText.className = "qr-parameter-picker__selection";
    const triggerName = document.createElement("span");
    triggerName.className = "qr-parameter-picker__name";
    const triggerDescription = document.createElement("span");
    triggerDescription.className = "qr-parameter-picker__description";
    triggerText.append(triggerName, triggerDescription);

    const arrow = document.createElement("span");
    arrow.className = "qr-parameter-picker__arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "▾";
    trigger.append(triggerText, arrow);

    const popup = document.createElement("div");
    popup.id = `parameter-picker-popup-${id}`;
    popup.className = "qr-parameter-picker__popup";
    popup.hidden = true;
    trigger.setAttribute("aria-controls", popup.id);

    const searchLabel = document.createElement("label");
    searchLabel.className = "visually-hidden";
    searchLabel.htmlFor = `parameter-search-${id}`;
    searchLabel.textContent = "Filter parameter names";

    const search = document.createElement("input");
    search.id = searchLabel.htmlFor;
    search.type = "search";
    search.className = "qr-parameter-picker__search";
    search.placeholder = "Type to filter";
    search.autocomplete = "off";
    search.autocapitalize = "none";
    search.spellcheck = false;
    search.setAttribute("role", "combobox");
    search.setAttribute("aria-autocomplete", "list");
    search.setAttribute("aria-expanded", "true");

    const listbox = document.createElement("div");
    listbox.id = `parameter-options-${id}`;
    listbox.className = "qr-parameter-picker__listbox";
    listbox.setAttribute("role", "listbox");
    listbox.setAttribute("aria-labelledby", label.id);
    search.setAttribute("aria-controls", listbox.id);

    const emptyMessage = document.createElement("p");
    emptyMessage.className = "qr-parameter-picker__empty";
    emptyMessage.setAttribute("role", "status");
    emptyMessage.setAttribute("aria-live", "polite");
    emptyMessage.textContent = "No matching parameter names.";
    emptyMessage.hidden = true;

    const groupRecords = new Map();
    const optionRecords = PARAMETER_OPTIONS.map((option, index) => {
      let groupRecord = groupRecords.get(option.group);
      if (!groupRecord) {
        const group = document.createElement("div");
        group.className = "qr-parameter-picker__group";
        group.setAttribute("role", "group");

        const groupLabel = document.createElement("div");
        groupLabel.id = `parameter-group-${id}-${groupRecords.size + 1}`;
        groupLabel.className = "qr-parameter-picker__group-label";
        groupLabel.textContent = option.group;
        group.setAttribute("aria-labelledby", groupLabel.id);
        group.append(groupLabel);
        listbox.append(group);
        groupRecord = { element: group, options: [] };
        groupRecords.set(option.group, groupRecord);
      }

      const optionButton = document.createElement("button");
      optionButton.id = `parameter-option-${id}-${index + 1}`;
      optionButton.type = "button";
      optionButton.className = "qr-parameter-picker__option";
      optionButton.dataset.value = option.value;
      optionButton.setAttribute("role", "option");
      optionButton.setAttribute("aria-selected", "false");
      optionButton.tabIndex = -1;

      const optionName = document.createElement("span");
      optionName.className = "qr-parameter-picker__option-name";
      optionName.textContent = option.label || option.value;
      const optionDescription = document.createElement("span");
      optionDescription.className = "qr-parameter-picker__option-description";
      optionDescription.textContent = option.description;
      optionButton.append(optionName, optionDescription);
      groupRecord.element.append(optionButton);

      const record = { option, element: optionButton, group: groupRecord };
      groupRecord.options.push(record);
      return record;
    });

    popup.append(searchLabel, search, listbox, emptyMessage);
    picker.append(trigger, popup);
    field.append(label, picker);

    let selectedValue = getParameterOption(initialValue) ? initialValue : DEFAULT_PARAMETER_NAME;
    let activeRecord = null;

    function visibleRecords() {
      return optionRecords.filter((record) => !record.element.hidden);
    }

    function setActiveRecord(record, scroll = true) {
      optionRecords.forEach((candidate) => {
        candidate.element.classList.toggle("is-active", candidate === record);
      });
      activeRecord = record || null;
      if (activeRecord) {
        search.setAttribute("aria-activedescendant", activeRecord.element.id);
        if (scroll) activeRecord.element.scrollIntoView({ block: "nearest" });
      } else {
        search.removeAttribute("aria-activedescendant");
      }
    }

    function renderSelection() {
      const selected = getParameterOption(selectedValue) || getParameterOption(DEFAULT_PARAMETER_NAME);
      trigger.dataset.value = selected.value;
      triggerName.textContent = selected.label || selected.value;
      triggerDescription.textContent = selected.description;
      optionRecords.forEach((record) => {
        record.element.setAttribute(
          "aria-selected",
          record.option.value === selected.value ? "true" : "false"
        );
      });
    }

    function filterOptions() {
      const query = search.value.trim().toLowerCase();
      optionRecords.forEach((record) => {
        const searchable = `${record.option.value} ${record.option.label || ""} ${record.option.description}`.toLowerCase();
        record.element.hidden = Boolean(query) && !searchable.includes(query);
      });
      groupRecords.forEach((groupRecord) => {
        groupRecord.element.hidden = !groupRecord.options.some((record) => !record.element.hidden);
      });

      const visible = visibleRecords();
      emptyMessage.hidden = visible.length > 0;
      if (!visible.includes(activeRecord)) {
        const selected = visible.find((record) => record.option.value === selectedValue);
        setActiveRecord(selected || visible[0] || null, false);
      }
    }

    function close(returnFocus = false) {
      if (popup.hidden) return;
      popup.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      search.value = "";
      setActiveRecord(null, false);
      if (state.openParameterPicker === api) state.openParameterPicker = null;
      if (returnFocus) trigger.focus();
    }

    function open(initialQuery = "", edge = "selected") {
      if (state.openParameterPicker && state.openParameterPicker !== api) {
        state.openParameterPicker.close(false);
      }
      popup.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      search.value = initialQuery;
      filterOptions();
      const visible = visibleRecords();
      if (edge === "last") {
        setActiveRecord(visible[visible.length - 1] || null, false);
      } else if (edge === "first") {
        setActiveRecord(visible[0] || null, false);
      } else {
        setActiveRecord(
          visible.find((record) => record.option.value === selectedValue) || visible[0] || null,
          false
        );
      }
      state.openParameterPicker = api;
      window.requestAnimationFrame(() => {
        search.focus();
        search.setSelectionRange(search.value.length, search.value.length);
      });
    }

    function choose(value) {
      const selected = getParameterOption(value);
      if (!selected) return;
      const previous = selectedValue;
      selectedValue = selected.value;
      renderSelection();
      close(false);
      if (selectedValue !== previous) {
        onSelectionChange(selectedValue, previous);
      } else {
        trigger.focus();
      }
    }

    function moveActive(step) {
      const visible = visibleRecords();
      if (!visible.length) return;
      const currentIndex = visible.indexOf(activeRecord);
      const nextIndex = currentIndex < 0
        ? (step > 0 ? 0 : visible.length - 1)
        : (currentIndex + step + visible.length) % visible.length;
      setActiveRecord(visible[nextIndex]);
    }

    trigger.addEventListener("click", () => {
      if (popup.hidden) open();
      else close(true);
    });

    trigger.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        open("", "selected");
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        open("", "last");
      } else if (
        event.key.length === 1
        && event.key !== " "
        && !event.altKey
        && !event.ctrlKey
        && !event.metaKey
      ) {
        event.preventDefault();
        open(event.key, "first");
      }
    });

    search.addEventListener("input", filterOptions);
    search.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveActive(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        moveActive(-1);
      } else if (event.key === "Home") {
        event.preventDefault();
        setActiveRecord(visibleRecords()[0] || null);
      } else if (event.key === "End") {
        event.preventDefault();
        const visible = visibleRecords();
        setActiveRecord(visible[visible.length - 1] || null);
      } else if (event.key === "Enter" && activeRecord) {
        event.preventDefault();
        choose(activeRecord.option.value);
      } else if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      } else if (event.key === "Tab") {
        close(false);
      }
    });

    optionRecords.forEach((record) => {
      record.element.addEventListener("mousedown", (event) => {
        event.preventDefault();
      });
      record.element.addEventListener("click", () => choose(record.option.value));
      record.element.addEventListener("mousemove", () => setActiveRecord(record, false));
    });

    field.addEventListener("focusout", () => {
      window.setTimeout(() => {
        if (!field.contains(document.activeElement)) close(false);
      }, 0);
    });

    const api = {
      field,
      button: trigger,
      wrapper: picker,
      close,
      open,
      getValue: () => selectedValue
    };

    renderSelection();
    return api;
  }

  function clearParameterRowError(row) {
    const controls = row.querySelectorAll(
      ".qr-parameter-picker__trigger, .qr-custom-parameter-input, .qr-parameter-value"
    );
    controls.forEach((control) => control.removeAttribute("aria-invalid"));
    const error = row.querySelector(".qr-parameter-error");
    error.textContent = "";
    error.hidden = true;
  }

  function setParameterRowError(row, controls, message) {
    controls.forEach((control) => control.setAttribute("aria-invalid", "true"));
    const error = row.querySelector(".qr-parameter-error");
    error.textContent = message;
    error.hidden = false;
  }

  function addParameterRow(name = DEFAULT_PARAMETER_NAME, value = "", moveFocus = false) {
    if (refs.parameterList.children.length >= MAX_PARAMETER_ROWS) {
      announce("You can add up to 20 tracking details.");
      return;
    }

    const id = ++state.parameterId;
    const trimmedName = String(name || "").trim();
    const initialOption = getParameterOption(trimmedName);
    const initialSelection = initialOption ? initialOption.value : (trimmedName ? CUSTOM_PARAMETER_VALUE : DEFAULT_PARAMETER_NAME);
    const initialCustomName = initialSelection === CUSTOM_PARAMETER_VALUE ? trimmedName : "";

    const row = document.createElement("div");
    row.className = "qr-parameter-row";
    row.dataset.parameterId = String(id);
    row.dataset.parameterSelection = initialSelection;
    row.dataset.parameterEngaged = value.trim() || initialCustomName ? "true" : "false";
    row.setAttribute("role", "group");

    const error = document.createElement("p");
    error.id = `parameter-error-${id}`;
    error.className = "app-error qr-parameter-error";
    error.setAttribute("role", "alert");
    error.hidden = true;

    const customField = document.createElement("div");
    customField.className = "qr-custom-parameter-field";
    customField.hidden = initialSelection !== CUSTOM_PARAMETER_VALUE;

    const customInput = document.createElement("input");
    customInput.id = `custom-parameter-name-${id}`;
    customInput.className = "qr-custom-parameter-input";
    customInput.type = "text";
    customInput.value = initialCustomName;
    customInput.maxLength = MAX_CUSTOM_PARAMETER_NAME_LENGTH;
    customInput.autocapitalize = "none";
    customInput.spellcheck = false;
    customInput.setAttribute("aria-describedby", error.id);
    customField.append(makeLabel("Custom parameter name", customInput));

    const valueInput = document.createElement("input");
    valueInput.id = `parameter-value-${id}`;
    valueInput.className = "qr-parameter-value";
    valueInput.type = "text";
    valueInput.value = value;
    valueInput.placeholder = getParameterPlaceholder(initialSelection);
    valueInput.autocapitalize = "none";
    valueInput.spellcheck = false;
    valueInput.setAttribute("aria-describedby", error.id);

    let picker;
    picker = createParameterPicker(id, initialSelection, error.id, (selection) => {
      row.dataset.parameterSelection = selection;
      row.dataset.parameterEngaged = "true";
      customInput.value = "";
      customField.hidden = selection !== CUSTOM_PARAMETER_VALUE;
      valueInput.value = "";
      valueInput.placeholder = getParameterPlaceholder(selection);
      clearParameterRowError(row);
      scheduleUpdate();
      window.requestAnimationFrame(() => {
        if (selection === CUSTOM_PARAMETER_VALUE) customInput.focus();
        else picker.button.focus();
      });
    });
    row.parameterPicker = picker;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "action-button is-danger qr-remove-parameter";
    remove.dataset.icon = "trash";
    remove.setAttribute("aria-label", "Remove tracking detail");
    remove.title = "Remove tracking detail";
    remove.addEventListener("pointerdown", cancelScheduledUpdate);
    remove.addEventListener("click", () => {
      if (state.openParameterPicker === picker) picker.close(false);
      row.remove();
      renumberParameterRows();
      void updatePreview();
      announce("Tracking detail removed.");
      refs.addParameter.focus();
    });

    row.append(
      picker.field,
      makeLabel("Value", valueInput),
      remove,
      customField,
      error
    );

    valueInput.addEventListener("input", () => {
      row.dataset.parameterEngaged = "true";
      scheduleUpdate();
    });
    customInput.addEventListener("input", () => {
      row.dataset.parameterEngaged = "true";
      scheduleUpdate();
    });

    refs.parameterList.append(row);
    renumberParameterRows();
    refs.addParameter.disabled = refs.parameterList.children.length >= MAX_PARAMETER_ROWS;

    if (moveFocus) picker.button.focus();
  }

  function renumberParameterRows() {
    const rows = [...refs.parameterList.querySelectorAll(".qr-parameter-row")];
    rows.forEach((row, index) => {
      const number = index + 1;
      row.setAttribute("aria-label", `Tracking detail ${number}`);
      row.querySelector(".qr-remove-parameter").setAttribute("aria-label", `Remove tracking detail ${number}`);
    });
    refs.addParameter.disabled = rows.length >= MAX_PARAMETER_ROWS;
  }

  function collectParameters() {
    const parameters = [];
    const seenNames = new Set();
    let valid = true;

    refs.parameterList.querySelectorAll(".qr-parameter-row").forEach((row) => {
      const selection = row.dataset.parameterSelection || DEFAULT_PARAMETER_NAME;
      const customInput = row.querySelector(".qr-custom-parameter-input");
      const valueInput = row.querySelector(".qr-parameter-value");
      const trigger = row.querySelector(".qr-parameter-picker__trigger");
      const customName = customInput.value.trim();
      const value = valueInput.value.trim();
      const engaged = row.dataset.parameterEngaged === "true" || Boolean(customName || value);

      clearParameterRowError(row);
      if (!engaged && !customName && !value) return;

      let name = selection;
      if (selection === CUSTOM_PARAMETER_VALUE) {
        name = customName;
        if (!name) {
          setParameterRowError(row, [customInput], "Add a custom parameter name.");
          valid = false;
          return;
        }
        if (
          name.length > MAX_CUSTOM_PARAMETER_NAME_LENGTH
          || !CUSTOM_PARAMETER_NAME_PATTERN.test(name)
        ) {
          setParameterRowError(
            row,
            [customInput],
            "Use letters, numbers, underscores, hyphens, periods, or tildes."
          );
          valid = false;
          return;
        }
      }

      if (!value) {
        setParameterRowError(row, [valueInput], "Add a value for this tracking detail.");
        valid = false;
        return;
      }

      if (seenNames.has(name)) {
        setParameterRowError(row, [trigger, customInput], "Use each tracking detail name only once.");
        valid = false;
        return;
      }

      seenNames.add(name);
      parameters.push({ name, value });
    });

    return { valid, parameters };
  }

  function showEmpty(message) {
    state.finalUrl = "";
    state.renderResult = null;
    refs.previewEmpty.textContent = message;
    refs.previewEmpty.hidden = false;
    refs.previewReady.hidden = true;
    refs.canvas.removeAttribute("data-qr-ready");
    refs.canvas.removeAttribute("data-final-url");
    refs.canvas.removeAttribute("data-qr-version");
    refs.canvas.removeAttribute("data-qr-module-count");
    refs.canvas.removeAttribute("data-logo-image-width-modules");
    refs.canvas.removeAttribute("data-logo-image-height-modules");
    refs.canvas.removeAttribute("data-logo-backing-width-modules");
    refs.canvas.removeAttribute("data-logo-backing-height-modules");
    refs.canvas.removeAttribute("data-logo-safety-usage");
    refs.canvas.removeAttribute("data-transparent-background");
    refs.canvasFrame.removeAttribute("data-transparent");
    refs.finalUrl.value = "";
    refs.finalUrl.textContent = "";
    refs.copyUrl.dataset.copyValue = "";
    setExportActionsEnabled(false);
  }

  function buildQrModel(finalUrl) {
    const qr = new window.MarinQrCode.QRCode(
      -1,
      window.MarinQrCode.QRErrorCorrectLevel.H
    );
    qr.addData(finalUrl);
    qr.make();
    return window.MarinQrSafety.createModel(
      qr,
      window.MarinQrCode.QRErrorCorrectLevel.H
    );
  }

  function renderQr(model, color, logoPlan = null, transparentBackground = false) {
    window.MarinQrSafety.render(
      refs.canvas,
      model,
      color,
      state.logo?.prepared || null,
      logoPlan,
      TARGET_PNG_SIZE,
      { transparentBackground }
    );

    refs.canvas.setAttribute("aria-label", "QR code for the final link shown below.");
    refs.canvas.dataset.transparentBackground = transparentBackground ? "true" : "false";
    refs.canvasFrame.dataset.transparent = transparentBackground ? "true" : "false";
    refs.canvas.dataset.qrReady = "true";
    refs.canvas.dataset.qrVersion = String(model.typeNumber);
    refs.canvas.dataset.qrModuleCount = String(model.moduleCount);
    if (logoPlan) {
      refs.canvas.dataset.logoImageWidthModules = logoPlan.imageWidth.toFixed(2);
      refs.canvas.dataset.logoImageHeightModules = logoPlan.imageHeight.toFixed(2);
      refs.canvas.dataset.logoBackingWidthModules = logoPlan.backingWidth.toFixed(2);
      refs.canvas.dataset.logoBackingHeightModules = logoPlan.backingHeight.toFixed(2);
      refs.canvas.dataset.logoSafetyUsage = logoPlan.verification.maximumUsage.toFixed(3);
    } else {
      refs.canvas.removeAttribute("data-logo-image-width-modules");
      refs.canvas.removeAttribute("data-logo-image-height-modules");
      refs.canvas.removeAttribute("data-logo-backing-width-modules");
      refs.canvas.removeAttribute("data-logo-backing-height-modules");
      refs.canvas.removeAttribute("data-logo-safety-usage");
    }
  }

  async function updatePreview() {
    cancelScheduledUpdate();
    const token = ++state.generationToken;
    state.generating = true;
    setExportActionsEnabled(false);

    try {
      const destination = parseDestination(refs.destination.value);
      if (destination.error) {
        setFieldError(refs.destination, refs.destinationError, destination.error);
      } else {
        clearFieldError(refs.destination, refs.destinationError);
      }

      const color = validateColor();
      const transparentBackground = refs.transparentBackground.checked;
      const parameterResult = collectParameters();

      if (destination.empty) {
        showEmpty("Add a web address to make a QR code.");
        return;
      }

      if (destination.error || !color || !parameterResult.valid) {
        showEmpty("Fix the fields to make a QR code.");
        return;
      }

      const final = new URL(destination.url.href);
      parameterResult.parameters.forEach(({ name, value }) => {
        final.searchParams.append(name, value);
      });
      const finalUrl = final.href;

      showEmpty(state.logo ? "Checking the center image…" : "Making your QR code…");
      refs.previewCard.setAttribute("aria-busy", "true");

      let model;
      let logoPlan = null;
      try {
        model = buildQrModel(finalUrl);
        if (state.logo) {
          clearFieldError(refs.imageInput, refs.imageError);
          logoPlan = await window.MarinQrSafety.findLargestLogoPlan(
            model,
            state.logo.prepared,
            color,
            { shouldCancel: () => token !== state.generationToken }
          );
          if (token !== state.generationToken) return;
          if (!logoPlan) {
            setFieldError(
              refs.imageInput,
              refs.imageError,
              "This image does not work well with this QR code. Try a shorter link or another image."
            );
            showEmpty("Try another center image to make this QR code.");
            return;
          }
        }

        renderQr(model, color, logoPlan, transparentBackground);
      } catch (error) {
        if (error?.name === "AbortError") return;
        console.error(error);
        const message = /overflow|code length|bad rs block/i.test(String(error))
          ? "This link is too long for a QR code. Shorten the link or remove tracking details."
          : "Marin QR could not make this code. Check the link and try again.";
        setFieldError(refs.destination, refs.destinationError, message);
        showEmpty("Fix the web address to make a QR code.");
        return;
      }

      if (token !== state.generationToken) return;
      state.finalUrl = finalUrl;
      state.renderResult = Object.freeze({
        model,
        color,
        preparedImage: state.logo?.prepared || null,
        logoPlan,
        transparentBackground,
        finalUrl
      });
      refs.canvas.dataset.finalUrl = finalUrl;
      refs.finalUrl.value = finalUrl;
      refs.finalUrl.textContent = finalUrl;
      refs.copyUrl.dataset.copyValue = finalUrl;
      refs.previewEmpty.hidden = true;
      refs.previewReady.hidden = false;
    } finally {
      if (token === state.generationToken) {
        state.generating = false;
        refs.previewCard.removeAttribute("aria-busy");
        setExportActionsEnabled(Boolean(state.finalUrl));
      }
    }
  }

  function scheduleUpdate() {
    cancelScheduledUpdate();
    state.generationToken += 1;
    state.generating = false;
    refs.previewCard.removeAttribute("aria-busy");
    showEmpty("Checking your changes…");
    state.updateTimer = window.setTimeout(() => {
      state.updateTimer = null;
      void updatePreview();
    }, 300);
  }

  function canvasToBlob() {
    return new Promise((resolve, reject) => {
      refs.canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("The PNG file could not be made."));
      }, "image/png");
    });
  }

  function svgToBlob() {
    const result = state.renderResult;
    if (!result) throw new Error("The SVG file could not be made.");
    const svg = window.MarinQrSafety.toSvg(
      result.model,
      result.color,
      result.preparedImage,
      result.logoPlan,
      {
        transparentBackground: result.transparentBackground,
        finalUrl: result.finalUrl
      }
    );
    return new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  }

  function saveBlob(blob, filename) {
    marinDownload({ content: blob, name: filename });
  }

  async function downloadPng() {
    if (!state.finalUrl) return;
    refs.downloadPng.setAttribute("aria-busy", "true");
    refs.downloadPng.disabled = true;

    try {
      saveBlob(await canvasToBlob(), "marin-qr.png");
      announce("PNG downloaded.");
    } catch (error) {
      console.error(error);
      announce("The PNG could not be downloaded. Try again.");
    } finally {
      refs.downloadPng.removeAttribute("aria-busy");
      refs.downloadPng.disabled = !exportsAreReady();
    }
  }

  async function downloadSvg() {
    if (!state.finalUrl) return;
    refs.downloadSvg.setAttribute("aria-busy", "true");
    refs.downloadSvg.disabled = true;

    try {
      saveBlob(svgToBlob(), "marin-qr.svg");
      announce("SVG downloaded.");
    } catch (error) {
      console.error(error);
      announce("The SVG could not be downloaded. Try again.");
    } finally {
      refs.downloadSvg.removeAttribute("aria-busy");
      refs.downloadSvg.disabled = !exportsAreReady();
    }
  }

  async function copyPng() {
    if (!state.finalUrl) return;

    if (!window.isSecureContext || !navigator.clipboard?.write || !window.ClipboardItem) {
      announce("This browser cannot copy the PNG. Use Download PNG.");
      return;
    }

    if (window.ClipboardItem.supports && !window.ClipboardItem.supports("image/png")) {
      announce("This browser cannot copy the PNG. Use Download PNG.");
      return;
    }

    refs.copyPng.setAttribute("aria-busy", "true");
    refs.copyPng.disabled = true;

    try {
      const pngPromise = canvasToBlob();
      const item = new ClipboardItem({ "image/png": pngPromise });
      // marin-shared-helpers: allow (copies an image; marinCopyRich and marinCopyText are for text)
      await navigator.clipboard.write([item]);
      announce("PNG copied.");
    } catch (error) {
      console.error(error);
      announce("The PNG could not be copied. Use Download PNG.");
    } finally {
      refs.copyPng.removeAttribute("aria-busy");
      refs.copyPng.disabled = !exportsAreReady();
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(reader.result), { once: true });
      reader.addEventListener("error", () => reject(new Error("The image could not be read.")), { once: true });
      reader.readAsDataURL(file);
    });
  }

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.addEventListener("load", () => resolve(image), { once: true });
      image.addEventListener("error", () => reject(new Error("The image could not be opened.")), { once: true });
      image.src = dataUrl;
    });
  }

  function clearImageChoice() {
    state.logo = null;
    refs.imageInput.value = "";
    refs.imagePreview.removeAttribute("src");
    refs.imageName.textContent = "";
    refs.imageChoice.hidden = true;
  }

  async function handleImageChoice() {
    const file = refs.imageInput.files?.[0];
    if (!file) return;

    const token = ++state.imageToken;
    state.generationToken += 1;
    state.generating = false;
    refs.previewCard.removeAttribute("aria-busy");
    clearFieldError(refs.imageInput, refs.imageError);
    setExportActionsEnabled(false);
    showEmpty("Reading the center image…");
    refs.previewCard.setAttribute("aria-busy", "true");

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      clearImageChoice();
      setFieldError(refs.imageInput, refs.imageError, "Choose a PNG, JPG, or WebP image.");
      void updatePreview();
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      clearImageChoice();
      setFieldError(refs.imageInput, refs.imageError, "Choose an image smaller than 2 MB.");
      void updatePreview();
      return;
    }

    refs.imageInput.setAttribute("aria-busy", "true");
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const image = await loadImage(dataUrl);
      if (token !== state.imageToken) return;

      if (image.naturalWidth > MAX_IMAGE_SIDE || image.naturalHeight > MAX_IMAGE_SIDE) {
        clearImageChoice();
        setFieldError(refs.imageInput, refs.imageError, "Choose an image that is no more than 4,096 pixels wide or tall.");
        void updatePreview();
        return;
      }

      const prepared = window.MarinQrImage.prepare(image);
      state.logo = { image, prepared, dataUrl, name: file.name };
      refs.imagePreview.src = dataUrl;
      refs.imageName.textContent = file.name;
      refs.imageChoice.hidden = false;
      clearFieldError(refs.imageInput, refs.imageError);
      void updatePreview();
      announce("Center image added.");
    } catch (error) {
      console.error(error);
      if (token !== state.imageToken) return;
      clearImageChoice();
      const message = /blank|visible size/i.test(String(error))
        ? "Choose an image with something visible in it."
        : "This image could not be opened. Choose another file.";
      setFieldError(refs.imageInput, refs.imageError, message);
      void updatePreview();
    } finally {
      if (token === state.imageToken) refs.imageInput.removeAttribute("aria-busy");
    }
  }

  function removeImage() {
    state.imageToken += 1;
    state.generationToken += 1;
    clearImageChoice();
    clearFieldError(refs.imageInput, refs.imageError);
    void updatePreview();
    announce("Center image removed.");
    refs.imageInput.focus();
  }

  function bindEvents() {
    refs.form.addEventListener("submit", (event) => {
      event.preventDefault();
      void updatePreview();
    });

    refs.destination.addEventListener("input", scheduleUpdate);
    refs.transparentBackground.addEventListener("change", scheduleUpdate);

    refs.color.addEventListener("input", () => {
      refs.colorText.value = refs.color.value.toLowerCase();
      clearFieldError(refs.colorText, refs.colorError);
      scheduleUpdate();
    });

    refs.colorText.addEventListener("input", () => {
      const color = normalizeHexColor(refs.colorText.value);
      if (color) refs.color.value = color;
      scheduleUpdate();
    });

    refs.colorText.addEventListener("blur", () => {
      const color = normalizeHexColor(refs.colorText.value);
      if (color) refs.colorText.value = color;
    });

    refs.addParameter.addEventListener("pointerdown", cancelScheduledUpdate);
    refs.addParameter.addEventListener("click", () => {
      addParameterRow(DEFAULT_PARAMETER_NAME, "", true);
      void updatePreview();
    });

    document.addEventListener("pointerdown", (event) => {
      const openPicker = state.openParameterPicker;
      if (openPicker && !openPicker.wrapper.contains(event.target)) {
        openPicker.close(false);
      }
    });
    refs.imageInput.addEventListener("change", handleImageChoice);
    refs.removeImage.addEventListener("click", removeImage);
    refs.downloadPng.addEventListener("click", downloadPng);
    refs.downloadSvg.addEventListener("click", downloadSvg);
    refs.copyPng.addEventListener("click", copyPng);
  }

  function start() {
    refs = {
      form: byId("qr-form"),
      destination: byId("destination-url"),
      destinationError: byId("destination-error"),
      destinationMode: byId("destination-mode"),
      allowedWebsitesHelp: byId("allowed-websites-help"),
      parameterList: byId("parameter-list"),
      addParameter: byId("add-parameter"),
      colorField: byId("qr-color-field"),
      color: byId("qr-color"),
      colorText: byId("qr-color-text"),
      colorError: byId("color-error"),
      transparentBackground: byId("transparent-background"),
      imageInput: byId("center-image"),
      imageError: byId("image-error"),
      imageChoice: byId("image-choice"),
      imagePreview: byId("image-preview"),
      imageName: byId("image-name"),
      removeImage: byId("remove-image"),
      previewCard: byId("qr-preview-card"),
      previewEmpty: byId("preview-empty"),
      previewReady: byId("preview-ready"),
      canvasFrame: byId("qr-canvas-frame"),
      canvas: byId("qr-canvas"),
      finalUrl: byId("final-url"),
      downloadPng: byId("download-png"),
      downloadSvg: byId("download-svg"),
      copyPng: byId("copy-png"),
      copyUrl: byId("copy-url")
    };

    const configReady = Array.isArray(window.MarinQrAuthorizedDomains)
      && window.MarinQrAuthorizedDomains.length > 0;
    const libraryReady = Boolean(
      window.MarinQrCode?.QRCode
      && window.MarinQrCode?.QRErrorCorrectLevel
      && window.MarinQrCode?.QRRSBlock
      && window.MarinQrImage?.prepare
      && window.MarinQrSafety?.createModel
      && window.MarinQrSafety?.findLargestLogoPlan
      && window.MarinQrSafety?.render
      && window.MarinQrSafety?.toSvg
    );

    if (!configReady || !libraryReady) {
      console.error("Marin QR could not load its local settings or QR library.");
      showEmpty("Marin QR could not start. Reload the page.");
      refs.form.querySelectorAll("input, button").forEach((control) => {
        control.disabled = true;
      });
      return;
    }

    refs.colorField.hidden = !FEATURES.qrColorPicker;
    refs.destinationMode.hidden = !allowAnyHttpsDestination;
    refs.allowedWebsitesHelp.hidden = allowAnyHttpsDestination;
    if (allowAnyHttpsDestination) {
      refs.destination.setAttribute("aria-describedby", "destination-mode destination-error");
    }
    bindEvents();
    addParameterRow(DEFAULT_PARAMETER_NAME);
    showEmpty("Add a web address to make a QR code.");
  }

  if (document.readyState === "complete") {
    start();
  } else {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  }
})();
