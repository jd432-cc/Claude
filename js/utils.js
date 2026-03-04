/* ===== Shared Utilities ===== */

const Utils = (() => {
  let _idCounter = 0;

  function uid(prefix) {
    return (prefix || 'id') + '_' + (++_idCounter) + '_' + Math.random().toString(36).slice(2, 7);
  }

  /* ---- Modal helper ---- */
  // onReady is called after the modal body is inserted into the DOM (for wiring up interactive widgets)
  function showModal(title, bodyHtml, onOk, onReady) {
    const overlay = document.getElementById('modal-overlay');
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');
    const okBtn = document.getElementById('modal-ok');
    const cancelBtn = document.getElementById('modal-cancel');
    const closeBtn = document.getElementById('modal-close');

    titleEl.textContent = title;
    bodyEl.innerHTML = bodyHtml;
    overlay.style.display = 'flex';

    if (onReady) onReady();

    function close() {
      overlay.style.display = 'none';
      okBtn.replaceWith(okBtn.cloneNode(true));
      cancelBtn.replaceWith(cancelBtn.cloneNode(true));
      closeBtn.replaceWith(closeBtn.cloneNode(true));
    }

    document.getElementById('modal-ok').addEventListener('click', () => {
      if (onOk) onOk();
      close();
    });
    document.getElementById('modal-cancel').addEventListener('click', close);
    document.getElementById('modal-close').addEventListener('click', close);
  }

  /* ---- Form builder for modals ---- */
  function formField(name, label, type, opts) {
    opts = opts || {};
    let input;
    if (type === 'select') {
      const options = (opts.options || []).map(o => {
        const sel = o.value === opts.value ? ' selected' : '';
        return `<option value="${o.value}"${sel}>${o.label}</option>`;
      }).join('');
      input = `<select id="modal-${name}" name="${name}">${options}</select>`;
    } else if (type === 'textarea') {
      input = `<textarea id="modal-${name}" name="${name}" rows="3">${opts.value || ''}</textarea>`;
    } else {
      const val = opts.value !== undefined ? opts.value : '';
      const extra = type === 'number' ? ` step="${opts.step || 'any'}"${opts.min !== undefined ? ' min="' + opts.min + '"' : ''}${opts.max !== undefined ? ' max="' + opts.max + '"' : ''}` : '';
      input = `<input type="${type}" id="modal-${name}" name="${name}" value="${val}"${extra}>`;
    }
    return `<div class="form-row"><label for="modal-${name}">${label}</label>${input}</div>`;
  }

  function getModalValue(name) {
    const el = document.getElementById('modal-' + name);
    if (!el) return '';
    // For searchable selects, the real value is stored in a hidden input
    if (el.dataset.searchSelect) return el.value;
    return el.type === 'number' ? parseFloat(el.value) : el.value;
  }

  /* ---- Searchable select dropdown ---- */
  function searchSelectField(name, label, options, selectedValue) {
    const id = 'modal-' + name;
    // Hidden input stores the actual value
    // Text input is what the user types into / sees
    const selectedOpt = options.find(o => o.value === selectedValue);
    const displayText = selectedOpt ? selectedOpt.label : '';

    return `<div class="form-row">
      <label for="${id}-input">${label}</label>
      <div class="search-select" id="${id}-wrap">
        <input type="hidden" id="${id}" data-search-select="1" value="${selectedValue || ''}">
        <input type="text" id="${id}-input" class="search-select-input" autocomplete="off"
               value="${displayText}" placeholder="Type to search..." data-target="${id}">
        <div class="search-select-dropdown" id="${id}-dropdown"></div>
      </div>
    </div>`;
  }

  /* Call after modal body is set to wire up all search-selects in it */
  function initSearchSelects(optionsMap) {
    // optionsMap: { fieldName: [{ value, label }, ...] }
    for (const [name, options] of Object.entries(optionsMap)) {
      const id = 'modal-' + name;
      const hiddenInput = document.getElementById(id);
      const textInput = document.getElementById(id + '-input');
      const dropdown = document.getElementById(id + '-dropdown');
      if (!hiddenInput || !textInput || !dropdown) continue;

      function renderList(filter) {
        const query = (filter || '').toLowerCase();
        const filtered = query
          ? options.filter(o => o.label.toLowerCase().includes(query))
          : options;

        dropdown.innerHTML = '';
        if (filtered.length === 0) {
          dropdown.innerHTML = '<div class="search-select-empty">No matches</div>';
          return;
        }
        for (const opt of filtered) {
          const item = document.createElement('div');
          item.className = 'search-select-item';
          if (opt.value === hiddenInput.value) item.classList.add('selected');
          item.textContent = opt.label;
          item.addEventListener('mousedown', (e) => {
            e.preventDefault(); // prevent blur before click registers
            hiddenInput.value = opt.value;
            textInput.value = opt.label;
            dropdown.classList.remove('open');
          });
          dropdown.appendChild(item);
        }
      }

      textInput.addEventListener('focus', () => {
        textInput.select();
        renderList(textInput.value);
        dropdown.classList.add('open');
      });

      textInput.addEventListener('input', () => {
        renderList(textInput.value);
        dropdown.classList.add('open');
        // If typed text doesn't exactly match any option, clear hidden value
        const exact = options.find(o => o.label.toLowerCase() === textInput.value.toLowerCase());
        hiddenInput.value = exact ? exact.value : '';
      });

      textInput.addEventListener('blur', () => {
        // Small delay so mousedown on item fires first
        setTimeout(() => {
          dropdown.classList.remove('open');
          // If hidden value is empty (no match), restore previous or first match
          if (!hiddenInput.value) {
            const partial = options.find(o => o.label.toLowerCase().includes(textInput.value.toLowerCase()));
            if (partial) {
              hiddenInput.value = partial.value;
              textInput.value = partial.label;
            } else if (options.length > 0) {
              hiddenInput.value = options[0].value;
              textInput.value = options[0].label;
            }
          }
        }, 150);
      });

      textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          dropdown.classList.remove('open');
          textInput.blur();
        }
        if (e.key === 'Enter') {
          // Select first visible item
          const first = dropdown.querySelector('.search-select-item');
          if (first) first.dispatchEvent(new Event('mousedown'));
          dropdown.classList.remove('open');
          e.preventDefault();
        }
      });
    }
  }

  /* ---- File download ---- */
  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ---- File import ---- */
  function importFile(accept, callback) {
    const input = document.getElementById('file-input');
    input.accept = accept || '.json';
    const handler = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => callback(ev.target.result, file.name);
      reader.readAsText(file);
      input.value = '';
      input.removeEventListener('change', handler);
    };
    input.addEventListener('change', handler);
    input.click();
  }

  /* ---- AWG current capacity lookup (ampacity for chassis wiring, ~40°C ambient) ---- */
  const AWG_DATA = {
    '22': { area_mm2: 0.33, ampacity: 5,   resistance_ohm_per_m: 0.0530 },
    '20': { area_mm2: 0.52, ampacity: 7.5,  resistance_ohm_per_m: 0.0333 },
    '18': { area_mm2: 0.82, ampacity: 10,   resistance_ohm_per_m: 0.0210 },
    '16': { area_mm2: 1.31, ampacity: 13,   resistance_ohm_per_m: 0.0132 },
    '14': { area_mm2: 2.08, ampacity: 18,   resistance_ohm_per_m: 0.00828 },
    '12': { area_mm2: 3.31, ampacity: 25,   resistance_ohm_per_m: 0.00521 },
    '10': { area_mm2: 5.26, ampacity: 35,   resistance_ohm_per_m: 0.00328 },
    '8':  { area_mm2: 8.37, ampacity: 50,   resistance_ohm_per_m: 0.00206 },
    '6':  { area_mm2: 13.3, ampacity: 65,   resistance_ohm_per_m: 0.00130 },
    '4':  { area_mm2: 21.2, ampacity: 85,   resistance_ohm_per_m: 0.000815 },
    '2':  { area_mm2: 33.6, ampacity: 115,  resistance_ohm_per_m: 0.000513 },
    '0':  { area_mm2: 53.5, ampacity: 150,  resistance_ohm_per_m: 0.000322 },
  };

  function getAWGAmpacity(gauge) {
    const d = AWG_DATA[String(gauge)];
    return d ? d.ampacity : null;
  }

  function getAWGOptions() {
    return Object.keys(AWG_DATA).map(g => ({ value: g, label: g + ' AWG' }));
  }

  /* ---- CAN bus load calculation ---- */
  function calcBusLoad(messages, bitrate) {
    // Each standard CAN frame: SOF(1) + ID(11) + RTR(1) + IDE(1) + r0(1) + DLC(4) + Data(0-64) + CRC(15) + CRC_del(1) + ACK(1) + ACK_del(1) + EOF(7) + IFS(3) = 47 + data bits
    // Stuff bits: roughly 1 stuff bit per 4 data bits (worst case)
    let totalBitsPerSec = 0;
    for (const msg of messages) {
      const dataBits = (msg.dlc || 8) * 8;
      const frameBits = 47 + dataBits;
      const stuffBits = Math.floor(frameBits / 4); // worst case estimate
      const totalFrameBits = frameBits + stuffBits;
      const cycleTime = msg.cycleTime || 100; // ms
      const framesPerSec = 1000 / cycleTime;
      totalBitsPerSec += totalFrameBits * framesPerSec;
    }
    return bitrate > 0 ? (totalBitsPerSec / bitrate) * 100 : 0;
  }

  /* ---- Wire color options ---- */
  const WIRE_COLORS = [
    'Black', 'Red', 'White', 'Green', 'Blue', 'Yellow', 'Orange', 'Brown',
    'Pink', 'Purple', 'Grey', 'Violet',
    'Red/Black', 'White/Black', 'Green/Black', 'Blue/White',
    'Yellow/Black', 'Orange/Black', 'Brown/White', 'Pink/Black'
  ];

  function getWireColorOptions() {
    return WIRE_COLORS.map(c => ({ value: c, label: c }));
  }

  /* ---- Color name <-> hex mapping ---- */
  const COLOR_NAME_TO_HEX = {
    'Black': '#222222', 'Red': '#dc2626', 'White': '#e8e8e8', 'Green': '#16a34a',
    'Blue': '#2563eb', 'Yellow': '#eab308', 'Orange': '#ea580c', 'Brown': '#92400e',
    'Pink': '#ec4899', 'Purple': '#9333ea', 'Grey': '#6b7280', 'Violet': '#7c3aed',
    'Red/Black': '#dc2626', 'White/Black': '#e8e8e8', 'Green/Black': '#16a34a',
    'Blue/White': '#2563eb', 'Yellow/Black': '#eab308', 'Orange/Black': '#ea580c',
    'Brown/White': '#92400e', 'Pink/Black': '#ec4899',
  };

  function colorToHex(color) {
    if (color && color.startsWith('#')) return color;
    return COLOR_NAME_TO_HEX[color] || '#888888';
  }

  /* ---- Color picker field (hex input + color swatch + preset buttons) ---- */
  function colorPickerField(name, label, currentValue) {
    const hexVal = colorToHex(currentValue);
    const id = 'modal-' + name;

    // Build preset color swatches
    const presets = Object.entries(COLOR_NAME_TO_HEX).map(([cname, chex]) => {
      const sel = (currentValue === cname || currentValue === chex) ? ' style="outline:2px solid var(--accent);outline-offset:1px;"' : '';
      return `<span class="color-preset" data-hex="${chex}" data-name="${cname}" title="${cname}"${sel}
        style="display:inline-block;width:20px;height:20px;border-radius:3px;background:${chex};border:1px solid #555;cursor:pointer;"></span>`;
    }).join('');

    return `<div class="form-row">
      <label>${label}</label>
      <div class="color-picker-row">
        <input type="color" id="${id}-swatch" value="${hexVal}">
        <input type="text" id="${id}" value="${hexVal}" placeholder="#rrggbb" maxlength="7" style="font-family:var(--mono);">
      </div>
      <div id="${id}-presets" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;">${presets}</div>
    </div>`;
  }

  function initColorPicker(name) {
    const id = 'modal-' + name;
    const textInput = document.getElementById(id);
    const swatch = document.getElementById(id + '-swatch');
    const presetsContainer = document.getElementById(id + '-presets');
    if (!textInput || !swatch) return;

    // Sync swatch -> text
    swatch.addEventListener('input', () => {
      textInput.value = swatch.value;
    });

    // Sync text -> swatch
    textInput.addEventListener('input', () => {
      const v = textInput.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(v)) {
        swatch.value = v;
      }
    });

    // Preset clicks
    if (presetsContainer) {
      presetsContainer.addEventListener('click', (e) => {
        const preset = e.target.closest('.color-preset');
        if (!preset) return;
        const hex = preset.dataset.hex;
        textInput.value = hex;
        swatch.value = hex;
        // Update outline
        presetsContainer.querySelectorAll('.color-preset').forEach(p => p.style.outline = '');
        preset.style.outline = '2px solid var(--accent)';
        preset.style.outlineOffset = '1px';
      });
    }
  }

  return {
    uid,
    showModal,
    formField,
    getModalValue,
    searchSelectField,
    initSearchSelects,
    colorPickerField,
    initColorPicker,
    colorToHex,
    downloadFile,
    importFile,
    AWG_DATA,
    getAWGAmpacity,
    getAWGOptions,
    calcBusLoad,
    WIRE_COLORS,
    getWireColorOptions,
  };
})();
