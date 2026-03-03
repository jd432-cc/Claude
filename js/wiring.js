/* ===== Wiring Loom Planner Module ===== */

const Wiring = (() => {
  let state = {
    connectors: [],  // { id, name, type, pins: [{ id, number, label, func }] }
    wires: []        // { id, wireId, fromConnector, fromPin, toConnector, toPin, gauge, color, length, notes }
  };

  let selectedConnectorId = null;

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

  function addWire() {
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

    const html = Utils.formField('wireId', 'Wire ID / Label', 'text', { value: 'W' + nextWireNum }) +
      Utils.formField('from', 'From (Connector:Pin)', 'select', { options: pinOpts, value: pinOpts[0].value }) +
      Utils.formField('to', 'To (Connector:Pin)', 'select', { options: pinOpts, value: pinOpts.length > 1 ? pinOpts[1].value : pinOpts[0].value }) +
      '<div class="form-row-inline">' +
        Utils.formField('gauge', 'Wire Gauge', 'select', { value: '18', options: Utils.getAWGOptions() }) +
        Utils.formField('color', 'Wire Color', 'select', { value: 'Red', options: Utils.getWireColorOptions() }) +
      '</div>' +
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
    });
  }

  function editWire(wireInternalId) {
    const wire = state.wires.find(w => w.id === wireInternalId);
    if (!wire) return;

    const pinOpts = buildPinOptions();

    const html = Utils.formField('wireId', 'Wire ID / Label', 'text', { value: wire.wireId }) +
      Utils.formField('from', 'From (Connector:Pin)', 'select', { options: pinOpts, value: wire.fromConnector + '::' + wire.fromPin }) +
      Utils.formField('to', 'To (Connector:Pin)', 'select', { options: pinOpts, value: wire.toConnector + '::' + wire.toPin }) +
      '<div class="form-row-inline">' +
        Utils.formField('gauge', 'Wire Gauge', 'select', { value: wire.gauge, options: Utils.getAWGOptions() }) +
        Utils.formField('color', 'Wire Color', 'select', { value: wire.color, options: Utils.getWireColorOptions() }) +
      '</div>' +
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

    for (const wire of state.wires) {
      const fromLabel = getPinLabel(wire.fromConnector, wire.fromPin);
      const toLabel = getPinLabel(wire.toConnector, wire.toPin);
      const ampacity = Utils.getAWGAmpacity(wire.gauge);
      const ampText = ampacity !== null ? ampacity + ' A' : '?';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escHtml(wire.wireId)}</strong></td>
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
    const map = {
      'Black': '#222', 'Red': '#dc2626', 'White': '#e8e8e8', 'Green': '#16a34a',
      'Blue': '#2563eb', 'Yellow': '#eab308', 'Orange': '#ea580c', 'Brown': '#92400e',
      'Pink': '#ec4899', 'Purple': '#9333ea', 'Grey': '#6b7280', 'Violet': '#7c3aed',
    };
    const base = colorName.split('/')[0];
    return map[base] || '#888';
  }

  /* ---- Wiring Diagram ---- */
  function drawWiringDiagram() {
    const canvas = document.getElementById('wiring-diagram-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.scale(dpr, dpr);

    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    ctx.clearRect(0, 0, W, H);

    const connectors = state.connectors;
    if (connectors.length === 0) {
      ctx.fillStyle = '#8890a8';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Add connectors and wires to see the diagram', W / 2, H / 2);
      return;
    }

    // Layout connectors in a row
    const margin = 40;
    const connWidth = 100;
    const connSpacing = (W - margin * 2) / connectors.length;
    const pinRadius = 4;
    const pinSpacing = 18;
    const connTopY = 60;

    const connPositions = {};

    connectors.forEach((conn, i) => {
      const cx = margin + connSpacing * i + connSpacing / 2;
      const maxPins = conn.pins.length;
      const boxH = Math.max(50, maxPins * pinSpacing + 20);

      // Connector box
      ctx.fillStyle = selectedConnectorId === conn.id ? '#2a3a5a' : '#1a1d27';
      ctx.strokeStyle = selectedConnectorId === conn.id ? '#4a9eff' : '#333750';
      ctx.lineWidth = 1.5;
      roundRect(ctx, cx - connWidth / 2, connTopY, connWidth, boxH, 6);
      ctx.fill();
      ctx.stroke();

      // Connector label
      ctx.fillStyle = '#e0e4f0';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(truncate(conn.name, 14), cx, connTopY - 10);

      ctx.fillStyle = '#8890a8';
      ctx.font = '9px monospace';
      ctx.fillText(conn.type, cx, connTopY - 1);

      // Pins
      connPositions[conn.id] = {};
      conn.pins.forEach((pin, pi) => {
        const py = connTopY + 16 + pi * pinSpacing;
        const px = cx;

        connPositions[conn.id][pin.id] = { x: px, y: py };

        // Pin dot
        ctx.fillStyle = '#4a9eff';
        ctx.beginPath();
        ctx.arc(px - connWidth / 2 + 12, py, pinRadius, 0, Math.PI * 2);
        ctx.fill();

        // Pin label
        ctx.fillStyle = '#c0c4d0';
        ctx.font = '9px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(pin.number + ': ' + truncate(pin.label, 10), px - connWidth / 2 + 20, py + 3);
      });
    });

    // Draw wires
    for (const wire of state.wires) {
      const fromPos = connPositions[wire.fromConnector] && connPositions[wire.fromConnector][wire.fromPin];
      const toPos = connPositions[wire.toConnector] && connPositions[wire.toConnector][wire.toPin];
      if (!fromPos || !toPos) continue;

      const fromConn = state.connectors.find(c => c.id === wire.fromConnector);
      const toConn = state.connectors.find(c => c.id === wire.toConnector);
      if (!fromConn || !toConn) continue;

      const fromConnIdx = connectors.indexOf(fromConn);
      const toConnIdx = connectors.indexOf(toConn);

      const fromCx = margin + connSpacing * fromConnIdx + connSpacing / 2;
      const toCx = margin + connSpacing * toConnIdx + connSpacing / 2;

      const x1 = fromCx + connWidth / 2 + 2;
      const y1 = fromPos.y;
      const x2 = toCx - connWidth / 2 - 2;
      const y2 = toPos.y;

      // Use wire color
      ctx.strokeStyle = cssColor(wire.color);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);

      // Bezier curve for routing
      const cpOffset = Math.abs(x2 - x1) * 0.4;
      ctx.bezierCurveTo(x1 + cpOffset, y1, x2 - cpOffset, y2, x2, y2);
      ctx.stroke();

      // Wire label
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2 - 6;
      ctx.fillStyle = '#c0c4d0';
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(wire.wireId, midX, midY);
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

  /* ---- Init ---- */
  function init() {
    document.getElementById('wire-add-connector').addEventListener('click', addConnector);
    document.getElementById('wire-add-wire').addEventListener('click', addWire);
    document.getElementById('wire-add-pin').addEventListener('click', addPin);
    document.getElementById('wire-import').addEventListener('click', importJSON);
    document.getElementById('wire-export').addEventListener('click', exportJSON);
    document.getElementById('wire-export-bom').addEventListener('click', exportBOM);

    window.addEventListener('resize', drawWiringDiagram);
    render();
  }

  return { init, getState, setState, render, drawWiringDiagram };
})();
