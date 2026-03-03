/* ===== Wiring Loom Planner Module ===== */

const Wiring = (() => {
  let state = {
    connectors: [],  // { id, name, type, pins: [{ id, number, label, func }] }
    wires: []        // { id, wireId, fromConnector, fromPin, toConnector, toPin, gauge, color, length, notes }
  };

  let selectedConnectorId = null;

  // Diagram layout positions (persisted per connector id)
  let connectorPositions = {};  // { connId: { x, y } }
  let dragState = null;         // { connId, offsetX, offsetY }
  let hoveredWireId = null;
  let canvasReady = false;

  // Pin-to-pin wire connection state
  let connectingFrom = null;    // { connId, pinId } — first pin clicked
  let mousePos = null;          // { x, y } — current mouse for preview line
  let hoveredPin = null;        // { connId, pinIdx } — pin under cursor

  /* ---- State ---- */
  function getState() { return state; }

  function setState(newState) {
    state = newState;
    selectedConnectorId = null;
    render();
  }

  /* ---- Connectors ---- */
  function addConnector() {
    const html = Utils.formField('name', 'Connector Name', 'text', { value: '' }) +
      Utils.formField('type', 'Connector Type', 'select', {
        value: 'Deutsch',
        options: [
          { value: 'Deutsch', label: 'Deutsch DT/DTM' },
          { value: 'Superseal', label: 'AMP Superseal' },
          { value: 'Metripack', label: 'Delphi Metripack' },
          { value: 'Molex', label: 'Molex' },
          { value: 'JST', label: 'JST' },
          { value: 'OBD-II', label: 'OBD-II' },
          { value: 'DB9', label: 'DB9' },
          { value: 'Terminal', label: 'Ring/Spade Terminal' },
          { value: 'Splice', label: 'Splice' },
          { value: 'Other', label: 'Other' },
        ]
      }) +
      Utils.formField('pinCount', 'Number of Pins', 'number', { value: 4, min: 1, max: 200, step: 1 });

    Utils.showModal('Add Connector', html, () => {
      const name = Utils.getModalValue('name').trim();
      if (!name) return;
      const pinCount = parseInt(Utils.getModalValue('pinCount')) || 4;
      const pins = [];
      for (let i = 1; i <= pinCount; i++) {
        pins.push({ id: Utils.uid('pin'), number: i, label: 'Pin ' + i, func: '' });
      }
      state.connectors.push({
        id: Utils.uid('conn'),
        name,
        type: Utils.getModalValue('type'),
        pins
      });
      render();
    });
  }

  function editConnector(connId) {
    const conn = state.connectors.find(c => c.id === connId);
    if (!conn) return;

    const html = Utils.formField('name', 'Connector Name', 'text', { value: conn.name }) +
      Utils.formField('type', 'Connector Type', 'select', {
        value: conn.type,
        options: [
          { value: 'Deutsch', label: 'Deutsch DT/DTM' },
          { value: 'Superseal', label: 'AMP Superseal' },
          { value: 'Metripack', label: 'Delphi Metripack' },
          { value: 'Molex', label: 'Molex' },
          { value: 'JST', label: 'JST' },
          { value: 'OBD-II', label: 'OBD-II' },
          { value: 'DB9', label: 'DB9' },
          { value: 'Terminal', label: 'Ring/Spade Terminal' },
          { value: 'Splice', label: 'Splice' },
          { value: 'Other', label: 'Other' },
        ]
      });

    Utils.showModal('Edit Connector', html, () => {
      conn.name = Utils.getModalValue('name').trim() || conn.name;
      conn.type = Utils.getModalValue('type');
      render();
    });
  }

  function deleteConnector(connId) {
    // Remove wires connected to this connector
    state.wires = state.wires.filter(w => w.fromConnector !== connId && w.toConnector !== connId);
    state.connectors = state.connectors.filter(c => c.id !== connId);
    if (selectedConnectorId === connId) selectedConnectorId = null;
    render();
  }

  function selectConnector(connId) {
    selectedConnectorId = connId;
    render();
  }

  /* ---- Pins ---- */
  function addPin() {
    if (!selectedConnectorId) return;
    const conn = state.connectors.find(c => c.id === selectedConnectorId);
    if (!conn) return;

    const nextNum = conn.pins.length > 0 ? Math.max(...conn.pins.map(p => p.number)) + 1 : 1;

    const html = Utils.formField('number', 'Pin Number', 'number', { value: nextNum, min: 1, step: 1 }) +
      Utils.formField('label', 'Label', 'text', { value: '' }) +
      Utils.formField('func', 'Function', 'text', { value: '' });

    Utils.showModal('Add Pin', html, () => {
      conn.pins.push({
        id: Utils.uid('pin'),
        number: parseInt(Utils.getModalValue('number')) || nextNum,
        label: Utils.getModalValue('label').trim() || 'Pin ' + nextNum,
        func: Utils.getModalValue('func').trim()
      });
      conn.pins.sort((a, b) => a.number - b.number);
      render();
    });
  }

  function editPin(connId, pinId) {
    const conn = state.connectors.find(c => c.id === connId);
    if (!conn) return;
    const pin = conn.pins.find(p => p.id === pinId);
    if (!pin) return;

    const html = Utils.formField('number', 'Pin Number', 'number', { value: pin.number, min: 1, step: 1 }) +
      Utils.formField('label', 'Label', 'text', { value: pin.label }) +
      Utils.formField('func', 'Function', 'text', { value: pin.func });

    Utils.showModal('Edit Pin', html, () => {
      pin.number = parseInt(Utils.getModalValue('number')) || pin.number;
      pin.label = Utils.getModalValue('label').trim() || pin.label;
      pin.func = Utils.getModalValue('func').trim();
      conn.pins.sort((a, b) => a.number - b.number);
      render();
    });
  }

  function deletePin(connId, pinId) {
    const conn = state.connectors.find(c => c.id === connId);
    if (!conn) return;
    // Remove wires connected to this pin
    state.wires = state.wires.filter(w =>
      !(w.fromConnector === connId && w.fromPin === pinId) &&
      !(w.toConnector === connId && w.toPin === pinId)
    );
    conn.pins = conn.pins.filter(p => p.id !== pinId);
    render();
  }

  /* ---- Wires ---- */
  function buildPinOptions() {
    const options = [];
    for (const conn of state.connectors) {
      for (const pin of conn.pins) {
        options.push({
          value: conn.id + '::' + pin.id,
          label: conn.name + ' : Pin ' + pin.number + (pin.label !== 'Pin ' + pin.number ? ' (' + pin.label + ')' : '')
        });
      }
    }
    return options;
  }

  function addWire(preFrom, preTo) {
    if (state.connectors.length < 1) {
      alert('Add at least one connector before creating wires.');
      return;
    }

    const pinOpts = buildPinOptions();
    if (pinOpts.length < 2) {
      alert('Need at least 2 pins across connectors to create a wire.');
      return;
    }

    const nextWireNum = state.wires.length + 1;
    const defaultFrom = preFrom || pinOpts[0].value;
    const defaultTo = preTo || (pinOpts.length > 1 ? pinOpts[1].value : pinOpts[0].value);

    const html = Utils.formField('wireId', 'Wire ID / Label', 'text', { value: 'W' + nextWireNum }) +
      Utils.searchSelectField('from', 'From (Connector:Pin)', pinOpts, defaultFrom) +
      Utils.searchSelectField('to', 'To (Connector:Pin)', pinOpts, defaultTo) +
      Utils.formField('gauge', 'Wire Gauge', 'select', { value: '18', options: Utils.getAWGOptions() }) +
      Utils.colorPickerField('color', 'Wire Color', '#dc2626') +
      Utils.formField('length', 'Length (m)', 'number', { value: 1, min: 0.01, step: 0.01 }) +
      Utils.formField('notes', 'Notes', 'text', { value: '' });

    Utils.showModal('Add Wire', html, () => {
      const fromVal = Utils.getModalValue('from');
      const toVal = Utils.getModalValue('to');
      const [fromConn, fromPin] = fromVal.split('::');
      const [toConn, toPin] = toVal.split('::');

      state.wires.push({
        id: Utils.uid('wire'),
        wireId: Utils.getModalValue('wireId').trim() || 'W' + nextWireNum,
        fromConnector: fromConn,
        fromPin: fromPin,
        toConnector: toConn,
        toPin: toPin,
        gauge: Utils.getModalValue('gauge'),
        color: Utils.getModalValue('color'),
        length: parseFloat(Utils.getModalValue('length')) || 1,
        notes: Utils.getModalValue('notes').trim()
      });
      render();
    }, () => {
      Utils.initSearchSelects({ from: pinOpts, to: pinOpts });
      Utils.initColorPicker('color');
    });
  }

  function editWire(wireInternalId) {
    const wire = state.wires.find(w => w.id === wireInternalId);
    if (!wire) return;

    const pinOpts = buildPinOptions();

    const html = Utils.formField('wireId', 'Wire ID / Label', 'text', { value: wire.wireId }) +
      Utils.searchSelectField('from', 'From (Connector:Pin)', pinOpts, wire.fromConnector + '::' + wire.fromPin) +
      Utils.searchSelectField('to', 'To (Connector:Pin)', pinOpts, wire.toConnector + '::' + wire.toPin) +
      Utils.formField('gauge', 'Wire Gauge', 'select', { value: wire.gauge, options: Utils.getAWGOptions() }) +
      Utils.colorPickerField('color', 'Wire Color', wire.color) +
      Utils.formField('length', 'Length (m)', 'number', { value: wire.length, min: 0.01, step: 0.01 }) +
      Utils.formField('notes', 'Notes', 'text', { value: wire.notes });

    Utils.showModal('Edit Wire', html, () => {
      const fromVal = Utils.getModalValue('from');
      const toVal = Utils.getModalValue('to');
      const [fromConn, fromPin] = fromVal.split('::');
      const [toConn, toPin] = toVal.split('::');

      wire.wireId = Utils.getModalValue('wireId').trim() || wire.wireId;
      wire.fromConnector = fromConn;
      wire.fromPin = fromPin;
      wire.toConnector = toConn;
      wire.toPin = toPin;
      wire.gauge = Utils.getModalValue('gauge');
      wire.color = Utils.getModalValue('color');
      wire.length = parseFloat(Utils.getModalValue('length')) || wire.length;
      wire.notes = Utils.getModalValue('notes').trim();
      render();
    }, () => {
      Utils.initSearchSelects({ from: pinOpts, to: pinOpts });
      Utils.initColorPicker('color');
    });
  }

  function deleteWire(wireInternalId) {
    state.wires = state.wires.filter(w => w.id !== wireInternalId);
    render();
  }

  /* ---- Export / Import ---- */
  function exportJSON() {
    Utils.downloadFile('wiring_loom.json', JSON.stringify(state, null, 2));
  }

  function importJSON() {
    Utils.importFile('.json', (content) => {
      try {
        const data = JSON.parse(content);
        if (data.connectors && Array.isArray(data.connectors)) {
          setState(data);
        }
      } catch (e) {
        alert('Invalid JSON file: ' + e.message);
      }
    });
  }

  function exportBOM() {
    const rows = [['Wire ID', 'From', 'To', 'Gauge (AWG)', 'Color', 'Length (m)', 'Max Current (A)', 'Notes']];

    for (const wire of state.wires) {
      const fromLabel = getPinLabel(wire.fromConnector, wire.fromPin);
      const toLabel = getPinLabel(wire.toConnector, wire.toPin);
      const ampacity = Utils.getAWGAmpacity(wire.gauge) || '?';
      rows.push([wire.wireId, fromLabel, toLabel, wire.gauge, wire.color, wire.length, ampacity, wire.notes]);
    }

    // Summary by gauge and color
    rows.push([]);
    rows.push(['--- Wire Summary ---']);
    rows.push(['Gauge (AWG)', 'Color', 'Qty', 'Total Length (m)']);

    const summary = {};
    for (const wire of state.wires) {
      const key = wire.gauge + '|' + wire.color;
      if (!summary[key]) summary[key] = { gauge: wire.gauge, color: wire.color, qty: 0, length: 0 };
      summary[key].qty++;
      summary[key].length += wire.length;
    }

    for (const s of Object.values(summary)) {
      rows.push([s.gauge, s.color, s.qty, s.length.toFixed(2)]);
    }

    // Connector summary
    rows.push([]);
    rows.push(['--- Connector Summary ---']);
    rows.push(['Connector', 'Type', 'Pin Count']);
    for (const conn of state.connectors) {
      rows.push([conn.name, conn.type, conn.pins.length]);
    }

    const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
    Utils.downloadFile('wiring_bom.csv', csv, 'text/csv');
  }

  /* ---- Helpers ---- */
  function getPinLabel(connId, pinId) {
    const conn = state.connectors.find(c => c.id === connId);
    if (!conn) return '?';
    const pin = conn.pins.find(p => p.id === pinId);
    if (!pin) return conn.name + ':?';
    return conn.name + ':Pin' + pin.number;
  }

  function getWireConnectionsForPin(connId, pinId) {
    return state.wires.filter(w =>
      (w.fromConnector === connId && w.fromPin === pinId) ||
      (w.toConnector === connId && w.toPin === pinId)
    );
  }

  function updateStats() {
    document.getElementById('wire-count-display').textContent = 'Wires: ' + state.wires.length;
    const total = state.wires.reduce((sum, w) => sum + (w.length || 0), 0);
    document.getElementById('total-length-display').textContent = 'Total Length: ' + total.toFixed(2) + ' m';
  }

  /* ---- Render ---- */
  function render() {
    renderConnectorList();
    renderConnectorDetail();
    renderWireSchedule();
    updateStats();
    drawWiringDiagram();
  }

  function renderConnectorList() {
    const container = document.getElementById('wire-connector-list');
    container.innerHTML = '';

    for (const conn of state.connectors) {
      const card = document.createElement('div');
      card.className = 'item-card' + (selectedConnectorId === conn.id ? ' selected' : '');
      card.innerHTML = `
        <div>
          <div class="item-name">${escHtml(conn.name)}</div>
          <div class="item-sub">${escHtml(conn.type)} &middot; ${conn.pins.length} pins</div>
        </div>
        <div class="item-actions">
          <button title="Edit" data-action="edit">&#9998;</button>
          <button title="Delete" data-action="delete">&times;</button>
        </div>
      `;
      card.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        if (action === 'edit') { e.stopPropagation(); editConnector(conn.id); }
        else if (action === 'delete') { e.stopPropagation(); deleteConnector(conn.id); }
        else selectConnector(conn.id);
      });
      container.appendChild(card);
    }
  }

  function renderConnectorDetail() {
    const placeholder = document.getElementById('wire-detail-placeholder');
    const detail = document.getElementById('wire-detail');

    if (!selectedConnectorId) {
      placeholder.style.display = '';
      detail.style.display = 'none';
      return;
    }

    const conn = state.connectors.find(c => c.id === selectedConnectorId);
    if (!conn) {
      placeholder.style.display = '';
      detail.style.display = 'none';
      return;
    }

    placeholder.style.display = 'none';
    detail.style.display = '';
    document.getElementById('wire-detail-title').textContent = conn.name + ' — ' + conn.type;

    const tbody = document.getElementById('wire-pin-tbody');
    tbody.innerHTML = '';

    for (const pin of conn.pins) {
      const connections = getWireConnectionsForPin(conn.id, pin.id);
      const connText = connections.map(w => {
        const otherConn = w.fromConnector === conn.id && w.fromPin === pin.id ? w.toConnector : w.fromConnector;
        const otherPin = w.fromConnector === conn.id && w.fromPin === pin.id ? w.toPin : w.fromPin;
        return w.wireId + ' → ' + getPinLabel(otherConn, otherPin);
      }).join(', ') || '—';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${pin.number}</td>
        <td>${escHtml(pin.label)}</td>
        <td>${escHtml(pin.func || '—')}</td>
        <td style="font-size:0.8rem;">${escHtml(connText)}</td>
        <td>
          <button class="btn btn-sm" data-action="edit-pin">Edit</button>
          <button class="btn btn-sm btn-danger" data-action="delete-pin">&times;</button>
        </td>
      `;

      tr.querySelector('[data-action="edit-pin"]').addEventListener('click', () => editPin(conn.id, pin.id));
      tr.querySelector('[data-action="delete-pin"]').addEventListener('click', () => deletePin(conn.id, pin.id));
      tbody.appendChild(tr);
    }
  }

  function renderWireSchedule() {
    const tbody = document.getElementById('wire-schedule-tbody');
    tbody.innerHTML = '';

    // Build set of duplicate wire pairs (same two pins, regardless of direction)
    const duplicateIds = new Set();
    const pairMap = {};  // "connA::pinA<>connB::pinB" -> [wireId, ...]
    for (const wire of state.wires) {
      const a = wire.fromConnector + '::' + wire.fromPin;
      const b = wire.toConnector + '::' + wire.toPin;
      const key = a < b ? a + '<>' + b : b + '<>' + a;
      if (!pairMap[key]) pairMap[key] = [];
      pairMap[key].push(wire.id);
    }
    for (const ids of Object.values(pairMap)) {
      if (ids.length > 1) ids.forEach(id => duplicateIds.add(id));
    }

    for (const wire of state.wires) {
      const fromLabel = getPinLabel(wire.fromConnector, wire.fromPin);
      const toLabel = getPinLabel(wire.toConnector, wire.toPin);
      const ampacity = Utils.getAWGAmpacity(wire.gauge);
      const ampText = ampacity !== null ? ampacity + ' A' : '?';
      const isDup = duplicateIds.has(wire.id);

      const tr = document.createElement('tr');
      if (isDup) {
        tr.style.background = 'rgba(220, 38, 38, 0.15)';
        tr.style.borderLeft = '3px solid #dc2626';
      }
      const dupBadge = isDup ? ' <span style="background:#dc2626;color:#fff;font-size:0.65rem;padding:1px 5px;border-radius:3px;margin-left:4px;vertical-align:middle;">DUPLICATE</span>' : '';
      tr.innerHTML = `
        <td><strong>${escHtml(wire.wireId)}</strong>${dupBadge}</td>
        <td>${escHtml(fromLabel)}</td>
        <td>${escHtml(toLabel)}</td>
        <td>${wire.gauge} AWG</td>
        <td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${cssColor(wire.color)};margin-right:6px;vertical-align:middle;border:1px solid #555;"></span>${escHtml(wire.color)}</td>
        <td>${wire.length} m</td>
        <td>${ampText}</td>
        <td style="font-size:0.8rem;">${escHtml(wire.notes || '—')}</td>
        <td>
          <button class="btn btn-sm" data-action="edit-wire">Edit</button>
          <button class="btn btn-sm btn-danger" data-action="delete-wire">&times;</button>
        </td>
      `;

      tr.querySelector('[data-action="edit-wire"]').addEventListener('click', () => editWire(wire.id));
      tr.querySelector('[data-action="delete-wire"]').addEventListener('click', () => deleteWire(wire.id));
      tbody.appendChild(tr);
    }
  }

  /* ---- Color mapping for display ---- */
  function cssColor(colorName) {
    // If it's already a hex value, use it directly
    if (colorName && colorName.startsWith('#')) return colorName;
    // Legacy named colors
    const map = {
      'Black': '#222', 'Red': '#dc2626', 'White': '#e8e8e8', 'Green': '#16a34a',
      'Blue': '#2563eb', 'Yellow': '#eab308', 'Orange': '#ea580c', 'Brown': '#92400e',
      'Pink': '#ec4899', 'Purple': '#9333ea', 'Grey': '#6b7280', 'Violet': '#7c3aed',
    };
    const base = (colorName || '').split('/')[0];
    return map[base] || '#888';
  }

  /* ---- Diagram constants ---- */
  const PIN_H_SPACING = 24;    // horizontal spacing between pin dots
  const PIN_RADIUS = 5;
  const CONN_BOX_HEIGHT = 40;  // fixed box height (name + type inside)
  const CONN_H_PADDING = 16;   // left/right padding inside box for pins
  const PIN_STUB_LEN = 12;     // stub line from box bottom to dot
  const DIAGRAM_MARGIN = 50;
  const DIAGRAM_TOP = 50;

  /* ---- Connector box width (adapts to pin count) ---- */
  function connBoxWidth(conn) {
    const pinsW = Math.max(1, conn.pins.length) * PIN_H_SPACING;
    return Math.max(100, pinsW + CONN_H_PADDING * 2);
  }

  /* ---- Bottom of connector (below pin dots) ---- */
  function connTotalHeight() {
    return CONN_BOX_HEIGHT + PIN_STUB_LEN + PIN_RADIUS * 2 + 14; // box + stub + dot + pin number
  }

  /* ---- Get the x position of a pin dot (bottom of connector) ---- */
  function pinDotPos(conn, pinIdx) {
    const pos = connectorPositions[conn.id];
    if (!pos) return null;
    const boxW = connBoxWidth(conn);
    const pinsW = (conn.pins.length - 1) * PIN_H_SPACING;
    const startX = pos.x - pinsW / 2;
    return {
      x: startX + pinIdx * PIN_H_SPACING,
      y: pos.y + CONN_BOX_HEIGHT + PIN_STUB_LEN + PIN_RADIUS
    };
  }

  /* ---- Hit-test a pin dot ---- */
  function hitTestPin(mx, my) {
    const hitRadius = PIN_RADIUS + 4; // slightly generous
    for (const conn of state.connectors) {
      for (let pi = 0; pi < conn.pins.length; pi++) {
        const dp = pinDotPos(conn, pi);
        if (!dp) continue;
        const dist = Math.sqrt((mx - dp.x) ** 2 + (my - dp.y) ** 2);
        if (dist <= hitRadius) {
          return { connId: conn.id, pinId: conn.pins[pi].id, pinIdx: pi, x: dp.x, y: dp.y };
        }
      }
    }
    return null;
  }

  /* ---- Assign default positions if missing ---- */
  function ensurePositions() {
    const canvas = document.getElementById('wiring-diagram-canvas');
    const W = canvas ? canvas.clientWidth : 900;

    const unpositioned = state.connectors.filter(c => !connectorPositions[c.id]);
    if (unpositioned.length === 0) return;

    // Space connectors evenly across the canvas width
    const totalConns = state.connectors.length;
    const spacing = (W - DIAGRAM_MARGIN * 2) / Math.max(1, totalConns);

    unpositioned.forEach((conn) => {
      const idx = state.connectors.indexOf(conn);
      connectorPositions[conn.id] = {
        x: DIAGRAM_MARGIN + spacing * idx + spacing / 2,
        y: DIAGRAM_TOP
      };
    });

    // Clean up positions for deleted connectors
    const ids = new Set(state.connectors.map(c => c.id));
    for (const key of Object.keys(connectorPositions)) {
      if (!ids.has(key)) delete connectorPositions[key];
    }
  }

  /* ---- Auto-size canvas height ---- */
  function calcCanvasHeight() {
    if (state.connectors.length === 0) return 200;
    let maxBottom = 200;
    for (const conn of state.connectors) {
      const pos = connectorPositions[conn.id];
      if (!pos) continue;
      const bottom = pos.y + connTotalHeight() + 120; // extra space for wire routing below
      if (bottom > maxBottom) maxBottom = bottom;
    }
    return Math.max(300, maxBottom);
  }

  /* ---- Wiring Diagram ---- */
  function drawWiringDiagram() {
    const canvas = document.getElementById('wiring-diagram-canvas');
    if (!canvas) return;

    // Skip drawing if the canvas is in a hidden tab (0 width)
    if (canvas.clientWidth === 0) {
      canvasReady = false;
      return;
    }
    canvasReady = true;

    ensurePositions();

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const W = canvas.clientWidth;
    const H = calcCanvasHeight();

    canvas.style.height = H + 'px';
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const connectors = state.connectors;
    if (connectors.length === 0) {
      ctx.fillStyle = '#8890a8';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Add connectors and wires to see the diagram', W / 2, H / 2);
      return;
    }

    // Build duplicate wire set for diagram highlighting
    const diagramDupIds = new Set();
    const diagramPairMap = {};
    for (const wire of state.wires) {
      const a = wire.fromConnector + '::' + wire.fromPin;
      const b = wire.toConnector + '::' + wire.toPin;
      const key = a < b ? a + '<>' + b : b + '<>' + a;
      if (!diagramPairMap[key]) diagramPairMap[key] = [];
      diagramPairMap[key].push(wire.id);
    }
    for (const ids of Object.values(diagramPairMap)) {
      if (ids.length > 1) ids.forEach(id => diagramDupIds.add(id));
    }

    // Draw wires first (behind connectors)
    for (const wire of state.wires) {
      drawWire(ctx, wire, diagramDupIds.has(wire.id));
    }

    // Draw connectors on top
    connectors.forEach((conn) => {
      drawConnector(ctx, conn);
    });

    // Draw connection preview line when connecting pins
    if (connectingFrom && mousePos) {
      const fromConn = state.connectors.find(c => c.id === connectingFrom.connId);
      if (fromConn) {
        const fromPinIdx = fromConn.pins.findIndex(p => p.id === connectingFrom.pinId);
        if (fromPinIdx !== -1) {
          const fp = pinDotPos(fromConn, fromPinIdx);
          if (fp) {
            ctx.strokeStyle = '#4a9eff';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(fp.x, fp.y + PIN_RADIUS + 1);
            ctx.lineTo(mousePos.x, mousePos.y);
            ctx.stroke();
            ctx.setLineDash([]);

            // Highlight the source pin
            ctx.strokeStyle = '#4a9eff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(fp.x, fp.y, PIN_RADIUS + 3, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
    }

    // Highlight hovered pin
    if (hoveredPin && !dragState) {
      const hConn = state.connectors.find(c => c.id === hoveredPin.connId);
      if (hConn) {
        const dp = pinDotPos(hConn, hoveredPin.pinIdx);
        if (dp) {
          ctx.strokeStyle = connectingFrom ? '#22c55e' : '#4a9eff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(dp.x, dp.y, PIN_RADIUS + 3, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
  }

  function drawConnector(ctx, conn) {
    const pos = connectorPositions[conn.id];
    if (!pos) return;

    const boxW = connBoxWidth(conn);
    const boxH = CONN_BOX_HEIGHT;
    const x = pos.x - boxW / 2;
    const y = pos.y;

    const isSelected = selectedConnectorId === conn.id;
    const isDragging = dragState && dragState.connId === conn.id;

    // Shadow when dragging
    if (isDragging) {
      ctx.save();
      ctx.shadowColor = 'rgba(74,158,255,0.3)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 4;
    }

    // Connector box
    ctx.fillStyle = isSelected ? '#2a3a5a' : '#1a1d27';
    ctx.strokeStyle = isSelected ? '#4a9eff' : '#444870';
    ctx.lineWidth = isSelected ? 2 : 1.5;
    roundRect(ctx, x, y, boxW, boxH, 6);
    ctx.fill();
    ctx.stroke();

    if (isDragging) ctx.restore();

    // Connector name (inside box, top)
    ctx.fillStyle = '#e0e4f0';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(truncate(conn.name, 18), pos.x, y + 8);

    // Connector type (inside box, below name)
    ctx.fillStyle = '#8890a8';
    ctx.font = '9px monospace';
    ctx.fillText(conn.type, pos.x, y + 24);

    // Pins — dots along the bottom edge
    conn.pins.forEach((pin, pi) => {
      const dp = pinDotPos(conn, pi);
      if (!dp) return;

      // Stub line from box bottom to dot
      ctx.strokeStyle = '#444870';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(dp.x, y + boxH);
      ctx.lineTo(dp.x, dp.y);
      ctx.stroke();

      // Pin dot
      ctx.fillStyle = '#4a9eff';
      ctx.beginPath();
      ctx.arc(dp.x, dp.y, PIN_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // Pin number below dot
      ctx.fillStyle = '#c0c8d8';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(String(pin.number), dp.x, dp.y + PIN_RADIUS + 2);
    });
  }

  function drawWire(ctx, wire, isDuplicate) {
    const fromConn = state.connectors.find(c => c.id === wire.fromConnector);
    const toConn = state.connectors.find(c => c.id === wire.toConnector);
    if (!fromConn || !toConn) return;

    const fromPinIdx = fromConn.pins.findIndex(p => p.id === wire.fromPin);
    const toPinIdx = toConn.pins.findIndex(p => p.id === wire.toPin);
    if (fromPinIdx === -1 || toPinIdx === -1) return;

    const fp = pinDotPos(fromConn, fromPinIdx);
    const tp = pinDotPos(toConn, toPinIdx);
    if (!fp || !tp) return;

    // Start below the pin dot
    const x1 = fp.x;
    const y1 = fp.y + PIN_RADIUS + 1;
    const x2 = tp.x;
    const y2 = tp.y + PIN_RADIUS + 1;

    // Duplicate wires get a red dashed underline
    if (isDuplicate) {
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 4;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.strokeStyle = cssColor(wire.color);
    ctx.lineWidth = hoveredWireId === wire.id ? 3 : 1.8;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Wire label at the midpoint
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    drawWireLabel(ctx, wire, midX, midY, isDuplicate);
  }

  function drawWireLabel(ctx, wire, x, y, isDuplicate) {
    const isHovered = hoveredWireId === wire.id;
    const text = isDuplicate ? '\u26A0 ' + wire.wireId : wire.wireId;

    ctx.font = (isHovered ? 'bold ' : '') + '9px monospace';
    const metrics = ctx.measureText(text);
    const pad = 4;

    // Background pill — red tint for duplicates
    if (isDuplicate) {
      ctx.fillStyle = 'rgba(220, 38, 38, 0.25)';
    } else {
      ctx.fillStyle = isHovered ? 'rgba(74,158,255,0.15)' : 'rgba(15,17,23,0.85)';
    }
    roundRect(ctx, x - metrics.width / 2 - pad, y - 7, metrics.width + pad * 2, 14, 3);
    ctx.fill();

    // Text — red for duplicates
    if (isDuplicate) {
      ctx.fillStyle = '#f87171';
    } else {
      ctx.fillStyle = isHovered ? '#4a9eff' : '#a0a8c0';
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }

  /* ---- Mouse interaction on canvas ---- */
  function setupCanvasInteraction() {
    const canvas = document.getElementById('wiring-diagram-canvas');
    if (!canvas) return;

    canvas.addEventListener('mousedown', onCanvasMouseDown);
    canvas.addEventListener('mousemove', onCanvasMouseMove);
    canvas.addEventListener('mouseup', onCanvasMouseUp);
    canvas.addEventListener('mouseleave', onCanvasMouseUp);
    canvas.addEventListener('dblclick', onCanvasDblClick);
    canvas.style.cursor = 'default';
  }

  function canvasCoords(e) {
    const canvas = document.getElementById('wiring-diagram-canvas');
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  function hitTestConnector(mx, my) {
    // Hit test includes the box and the pin area below it
    for (const conn of state.connectors) {
      const pos = connectorPositions[conn.id];
      if (!pos) continue;
      const boxW = connBoxWidth(conn);
      const x = pos.x - boxW / 2;
      const y = pos.y;
      const totalH = connTotalHeight();
      if (mx >= x && mx <= x + boxW && my >= y && my <= y + totalH) {
        return conn.id;
      }
    }
    return null;
  }

  function onCanvasMouseDown(e) {
    const { x, y } = canvasCoords(e);

    // Check if clicking a pin dot
    const pinHit = hitTestPin(x, y);

    if (pinHit) {
      if (connectingFrom) {
        // Second click — complete the connection
        const fromKey = connectingFrom.connId + '::' + connectingFrom.pinId;
        const toKey = pinHit.connId + '::' + pinHit.pinId;
        connectingFrom = null;
        mousePos = null;
        hoveredPin = null;
        drawWiringDiagram();
        addWire(fromKey, toKey);
        return;
      }
      // First click — start connecting
      connectingFrom = { connId: pinHit.connId, pinId: pinHit.pinId };
      mousePos = { x: pinHit.x, y: pinHit.y + PIN_RADIUS + 1 };
      drawWiringDiagram();
      return;
    }

    // Clicking on empty space while connecting — cancel
    if (connectingFrom) {
      connectingFrom = null;
      mousePos = null;
      hoveredPin = null;
      drawWiringDiagram();
      return;
    }

    // Normal connector drag
    const hitId = hitTestConnector(x, y);
    if (hitId) {
      const pos = connectorPositions[hitId];
      dragState = {
        connId: hitId,
        offsetX: x - pos.x,
        offsetY: y - pos.y
      };
      selectedConnectorId = hitId;
      renderConnectorList();
      renderConnectorDetail();
      e.target.style.cursor = 'grabbing';
    }
  }

  function onCanvasMouseMove(e) {
    const { x, y } = canvasCoords(e);

    // Update preview line while connecting
    if (connectingFrom) {
      mousePos = { x, y };
      const pinHit = hitTestPin(x, y);
      const newHovered = pinHit ? { connId: pinHit.connId, pinIdx: pinHit.pinIdx } : null;
      const changed = (newHovered ? newHovered.connId + newHovered.pinIdx : null) !== (hoveredPin ? hoveredPin.connId + hoveredPin.pinIdx : null);
      hoveredPin = newHovered;
      e.target.style.cursor = pinHit ? 'pointer' : 'crosshair';
      drawWiringDiagram();
      return;
    }

    if (dragState) {
      const conn = state.connectors.find(c => c.id === dragState.connId);
      const minX = conn ? connBoxWidth(conn) / 2 + 10 : 70;
      connectorPositions[dragState.connId] = {
        x: Math.max(minX, x - dragState.offsetX),
        y: Math.max(20, y - dragState.offsetY)
      };
      drawWiringDiagram();
      return;
    }

    // Check pin hover
    const pinHit = hitTestPin(x, y);
    if (pinHit) {
      const newHovered = { connId: pinHit.connId, pinIdx: pinHit.pinIdx };
      if (!hoveredPin || hoveredPin.connId !== newHovered.connId || hoveredPin.pinIdx !== newHovered.pinIdx) {
        hoveredPin = newHovered;
        drawWiringDiagram();
      }
      e.target.style.cursor = 'pointer';
      return;
    }
    if (hoveredPin) {
      hoveredPin = null;
      drawWiringDiagram();
    }

    // Hover cursor for connectors
    const hitId = hitTestConnector(x, y);
    e.target.style.cursor = hitId ? 'grab' : 'default';

    // Hover detection for wire labels
    let newHoveredWire = null;
    for (const wire of state.wires) {
      const fromConn = state.connectors.find(c => c.id === wire.fromConnector);
      const toConn = state.connectors.find(c => c.id === wire.toConnector);
      if (!fromConn || !toConn) continue;

      const fIdx = fromConn.pins.findIndex(p => p.id === wire.fromPin);
      const tIdx = toConn.pins.findIndex(p => p.id === wire.toPin);
      if (fIdx === -1 || tIdx === -1) continue;

      const fp = pinDotPos(fromConn, fIdx);
      const tp = pinDotPos(toConn, tIdx);
      if (!fp || !tp) continue;

      const y1 = fp.y + PIN_RADIUS + 1;
      const y2 = tp.y + PIN_RADIUS + 1;
      const midX = (fp.x + tp.x) / 2;
      const midY = (y1 + y2) / 2;

      const dist = Math.sqrt((x - midX) ** 2 + (y - midY) ** 2);
      if (dist < 20) {
        newHoveredWire = wire.id;
        break;
      }
    }

    if (newHoveredWire !== hoveredWireId) {
      hoveredWireId = newHoveredWire;
      drawWiringDiagram();
    }
  }

  function onCanvasMouseUp(e) {
    if (dragState) {
      dragState = null;
      e.target.style.cursor = 'default';
      drawWiringDiagram();
    }
  }

  function onCanvasDblClick(e) {
    const { x, y } = canvasCoords(e);
    // Don't double-click edit while connecting
    if (connectingFrom) return;
    const hitId = hitTestConnector(x, y);
    if (hitId) {
      editConnector(hitId);
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function truncate(str, len) {
    return str.length > len ? str.slice(0, len - 1) + '…' : str;
  }

  function escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  /* ---- Reset positions (e.g. after import or when user wants auto-layout) ---- */
  function resetPositions() {
    connectorPositions = {};
    ensurePositions();
    drawWiringDiagram();
  }

  /* ---- Init ---- */
  function init() {
    document.getElementById('wire-add-connector').addEventListener('click', addConnector);
    document.getElementById('wire-add-wire').addEventListener('click', addWire);
    document.getElementById('wire-add-pin').addEventListener('click', addPin);
    document.getElementById('wire-import').addEventListener('click', importJSON);
    document.getElementById('wire-export').addEventListener('click', exportJSON);
    document.getElementById('wire-export-bom').addEventListener('click', exportBOM);
    document.getElementById('wire-reset-layout').addEventListener('click', resetPositions);

    setupCanvasInteraction();
    window.addEventListener('resize', () => {
      if (canvasReady) drawWiringDiagram();
    });
    render();
  }

  return { init, getState, setState, render, drawWiringDiagram, resetPositions };
})();
