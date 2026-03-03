/* ===== Shared Utilities ===== */

const Utils = (() => {
  let _idCounter = 0;

  function uid(prefix) {
    return (prefix || 'id') + '_' + (++_idCounter) + '_' + Math.random().toString(36).slice(2, 7);
  }

  /* ---- Modal helper ---- */
  function showModal(title, bodyHtml, onOk) {
    const overlay = document.getElementById('modal-overlay');
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');
    const okBtn = document.getElementById('modal-ok');
    const cancelBtn = document.getElementById('modal-cancel');
    const closeBtn = document.getElementById('modal-close');

    titleEl.textContent = title;
    bodyEl.innerHTML = bodyHtml;
    overlay.style.display = 'flex';

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
      const extra = type === 'number' ? ` step="${opts.step || 'any'}" min="${opts.min !== undefined ? opts.min : ''}" max="${opts.max !== undefined ? opts.max : ''}"` : '';
      input = `<input type="${type}" id="modal-${name}" name="${name}" value="${val}"${extra}>`;
    }
    return `<div class="form-row"><label for="modal-${name}">${label}</label>${input}</div>`;
  }

  function getModalValue(name) {
    const el = document.getElementById('modal-' + name);
    if (!el) return '';
    return el.type === 'number' ? parseFloat(el.value) : el.value;
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

  return {
    uid,
    showModal,
    formField,
    getModalValue,
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
