/* ===== CAN BUS Planner Module ===== */

const CANBus = (() => {
  let state = {
    bitrate: 500000,
    nodes: [],      // { id, name, address, messages: [{ id, msgId, name, dlc, cycleTime, direction, signals: [{ id, name, startBit, bitLength, byteOrder, valueType, factor, offset, min, max, unit }] }] }
  };

  let selectedNodeId = null;

  /* ---- State access ---- */
  function getState() { return state; }

  function setState(newState) {
    state = newState;
    selectedNodeId = null;
    render();
  }

  /* ---- Nodes ---- */
  function addNode() {
    const html = Utils.formField('name', 'Node Name', 'text', { value: '' }) +
                 Utils.formField('address', 'Node Address (hex)', 'text', { value: '0x00' });

    Utils.showModal('Add Node (ECU)', html, () => {
      const name = Utils.getModalValue('name').trim();
      const address = Utils.getModalValue('address').trim();
      if (!name) return;
      state.nodes.push({
        id: Utils.uid('node'),
        name,
        address,
        messages: []
      });
      render();
    });
  }

  function editNode(nodeId) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const html = Utils.formField('name', 'Node Name', 'text', { value: node.name }) +
                 Utils.formField('address', 'Node Address (hex)', 'text', { value: node.address });

    Utils.showModal('Edit Node', html, () => {
      node.name = Utils.getModalValue('name').trim() || node.name;
      node.address = Utils.getModalValue('address').trim() || node.address;
      render();
    });
  }

  function deleteNode(nodeId) {
    state.nodes = state.nodes.filter(n => n.id !== nodeId);
    if (selectedNodeId === nodeId) selectedNodeId = null;
    render();
  }

  function selectNode(nodeId) {
    selectedNodeId = nodeId;
    render();
  }

  /* ---- Messages ---- */
  function addMessage() {
    if (!selectedNodeId) return;
    const html = Utils.formField('name', 'Message Name', 'text', { value: '' }) +
      '<div class="form-row-inline">' +
        Utils.formField('msgId', 'Message ID (hex)', 'text', { value: '0x100' }) +
        Utils.formField('dlc', 'DLC (bytes)', 'number', { value: 8, min: 0, max: 8, step: 1 }) +
      '</div>' +
      '<div class="form-row-inline">' +
        Utils.formField('cycleTime', 'Cycle Time (ms)', 'number', { value: 100, min: 1, step: 1 }) +
        Utils.formField('direction', 'Direction', 'select', {
          value: 'TX',
          options: [{ value: 'TX', label: 'TX (Transmit)' }, { value: 'RX', label: 'RX (Receive)' }]
        }) +
      '</div>';

    Utils.showModal('Add Message', html, () => {
      const node = state.nodes.find(n => n.id === selectedNodeId);
      if (!node) return;
      const name = Utils.getModalValue('name').trim();
      if (!name) return;
      node.messages.push({
        id: Utils.uid('msg'),
        msgId: Utils.getModalValue('msgId').trim(),
        name,
        dlc: parseInt(Utils.getModalValue('dlc')) || 8,
        cycleTime: parseInt(Utils.getModalValue('cycleTime')) || 100,
        direction: Utils.getModalValue('direction'),
        signals: []
      });
      render();
    });
  }

  function editMessage(nodeId, msgId) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node) return;
    const msg = node.messages.find(m => m.id === msgId);
    if (!msg) return;

    const html = Utils.formField('name', 'Message Name', 'text', { value: msg.name }) +
      '<div class="form-row-inline">' +
        Utils.formField('msgId', 'Message ID (hex)', 'text', { value: msg.msgId }) +
        Utils.formField('dlc', 'DLC (bytes)', 'number', { value: msg.dlc, min: 0, max: 8, step: 1 }) +
      '</div>' +
      '<div class="form-row-inline">' +
        Utils.formField('cycleTime', 'Cycle Time (ms)', 'number', { value: msg.cycleTime, min: 1, step: 1 }) +
        Utils.formField('direction', 'Direction', 'select', {
          value: msg.direction,
          options: [{ value: 'TX', label: 'TX (Transmit)' }, { value: 'RX', label: 'RX (Receive)' }]
        }) +
      '</div>';

    Utils.showModal('Edit Message', html, () => {
      msg.name = Utils.getModalValue('name').trim() || msg.name;
      msg.msgId = Utils.getModalValue('msgId').trim() || msg.msgId;
      msg.dlc = parseInt(Utils.getModalValue('dlc')) || 8;
      msg.cycleTime = parseInt(Utils.getModalValue('cycleTime')) || 100;
      msg.direction = Utils.getModalValue('direction');
      render();
    });
  }

  function deleteMessage(nodeId, msgId) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node) return;
    node.messages = node.messages.filter(m => m.id !== msgId);
    render();
  }

  /* ---- Signals ---- */
  function addSignal(nodeId, msgId) {
    const html = Utils.formField('name', 'Signal Name', 'text', { value: '' }) +
      '<div class="form-row-inline">' +
        Utils.formField('startBit', 'Start Bit', 'number', { value: 0, min: 0, max: 63, step: 1 }) +
        Utils.formField('bitLength', 'Bit Length', 'number', { value: 8, min: 1, max: 64, step: 1 }) +
      '</div>' +
      '<div class="form-row-inline">' +
        Utils.formField('byteOrder', 'Byte Order', 'select', {
          value: 'little_endian',
          options: [
            { value: 'little_endian', label: 'Little Endian (Intel)' },
            { value: 'big_endian', label: 'Big Endian (Motorola)' }
          ]
        }) +
        Utils.formField('valueType', 'Value Type', 'select', {
          value: 'unsigned',
          options: [
            { value: 'unsigned', label: 'Unsigned' },
            { value: 'signed', label: 'Signed' }
          ]
        }) +
      '</div>' +
      '<div class="form-row-inline">' +
        Utils.formField('factor', 'Factor', 'number', { value: 1, step: 'any' }) +
        Utils.formField('offset', 'Offset', 'number', { value: 0, step: 'any' }) +
      '</div>' +
      '<div class="form-row-inline">' +
        Utils.formField('min', 'Min Value', 'number', { value: 0, step: 'any' }) +
        Utils.formField('max', 'Max Value', 'number', { value: 255, step: 'any' }) +
      '</div>' +
      Utils.formField('unit', 'Unit', 'text', { value: '' });

    Utils.showModal('Add Signal', html, () => {
      const node = state.nodes.find(n => n.id === nodeId);
      if (!node) return;
      const msg = node.messages.find(m => m.id === msgId);
      if (!msg) return;
      const name = Utils.getModalValue('name').trim();
      if (!name) return;

      msg.signals.push({
        id: Utils.uid('sig'),
        name,
        startBit: parseInt(Utils.getModalValue('startBit')) || 0,
        bitLength: parseInt(Utils.getModalValue('bitLength')) || 8,
        byteOrder: Utils.getModalValue('byteOrder'),
        valueType: Utils.getModalValue('valueType'),
        factor: parseFloat(Utils.getModalValue('factor')) || 1,
        offset: parseFloat(Utils.getModalValue('offset')) || 0,
        min: parseFloat(Utils.getModalValue('min')) || 0,
        max: parseFloat(Utils.getModalValue('max')) || 255,
        unit: Utils.getModalValue('unit').trim()
      });
      render();
    });
  }

  function editSignal(nodeId, msgId, sigId) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node) return;
    const msg = node.messages.find(m => m.id === msgId);
    if (!msg) return;
    const sig = msg.signals.find(s => s.id === sigId);
    if (!sig) return;

    const html = Utils.formField('name', 'Signal Name', 'text', { value: sig.name }) +
      '<div class="form-row-inline">' +
        Utils.formField('startBit', 'Start Bit', 'number', { value: sig.startBit, min: 0, max: 63, step: 1 }) +
        Utils.formField('bitLength', 'Bit Length', 'number', { value: sig.bitLength, min: 1, max: 64, step: 1 }) +
      '</div>' +
      '<div class="form-row-inline">' +
        Utils.formField('byteOrder', 'Byte Order', 'select', {
          value: sig.byteOrder,
          options: [
            { value: 'little_endian', label: 'Little Endian (Intel)' },
            { value: 'big_endian', label: 'Big Endian (Motorola)' }
          ]
        }) +
        Utils.formField('valueType', 'Value Type', 'select', {
          value: sig.valueType,
          options: [
            { value: 'unsigned', label: 'Unsigned' },
            { value: 'signed', label: 'Signed' }
          ]
        }) +
      '</div>' +
      '<div class="form-row-inline">' +
        Utils.formField('factor', 'Factor', 'number', { value: sig.factor, step: 'any' }) +
        Utils.formField('offset', 'Offset', 'number', { value: sig.offset, step: 'any' }) +
      '</div>' +
      '<div class="form-row-inline">' +
        Utils.formField('min', 'Min Value', 'number', { value: sig.min, step: 'any' }) +
        Utils.formField('max', 'Max Value', 'number', { value: sig.max, step: 'any' }) +
      '</div>' +
      Utils.formField('unit', 'Unit', 'text', { value: sig.unit });

    Utils.showModal('Edit Signal', html, () => {
      sig.name = Utils.getModalValue('name').trim() || sig.name;
      sig.startBit = parseInt(Utils.getModalValue('startBit')) || 0;
      sig.bitLength = parseInt(Utils.getModalValue('bitLength')) || 8;
      sig.byteOrder = Utils.getModalValue('byteOrder');
      sig.valueType = Utils.getModalValue('valueType');
      sig.factor = parseFloat(Utils.getModalValue('factor')) || 1;
      sig.offset = parseFloat(Utils.getModalValue('offset')) || 0;
      sig.min = parseFloat(Utils.getModalValue('min')) || 0;
      sig.max = parseFloat(Utils.getModalValue('max')) || 255;
      sig.unit = Utils.getModalValue('unit').trim();
      render();
    });
  }

  function deleteSignal(nodeId, msgId, sigId) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node) return;
    const msg = node.messages.find(m => m.id === msgId);
    if (!msg) return;
    msg.signals = msg.signals.filter(s => s.id !== sigId);
    render();
  }

  /* ---- Export DBC ---- */
  function exportDBC() {
    let dbc = 'VERSION ""\n\nNS_ :\n\nBS_:\n\n';

    // BU_ section
    dbc += 'BU_: ' + state.nodes.map(n => n.name.replace(/\s+/g, '_')).join(' ') + '\n\n';

    // BO_ and SG_ sections
    for (const node of state.nodes) {
      for (const msg of node.messages) {
        if (msg.direction !== 'TX') continue;
        const msgIdNum = parseInt(msg.msgId, 16) || parseInt(msg.msgId);
        const nodeName = node.name.replace(/\s+/g, '_');
        dbc += `BO_ ${msgIdNum} ${msg.name.replace(/\s+/g, '_')}: ${msg.dlc} ${nodeName}\n`;

        for (const sig of msg.signals) {
          const byteOrder = sig.byteOrder === 'big_endian' ? '0' : '1';
          const valueType = sig.valueType === 'signed' ? '-' : '+';
          dbc += ` SG_ ${sig.name.replace(/\s+/g, '_')} : ${sig.startBit}|${sig.bitLength}@${byteOrder}${valueType} (${sig.factor},${sig.offset}) [${sig.min}|${sig.max}] "${sig.unit || ''}" Vector__XXX\n`;
        }
        dbc += '\n';
      }
    }

    Utils.downloadFile('canbus_network.dbc', dbc, 'text/plain');
  }

  /* ---- Export / Import JSON ---- */
  function exportJSON() {
    const data = JSON.stringify(state, null, 2);
    Utils.downloadFile('canbus_config.json', data);
  }

  function importJSON() {
    Utils.importFile('.json', (content) => {
      try {
        const data = JSON.parse(content);
        if (data.nodes && Array.isArray(data.nodes)) {
          setState(data);
        }
      } catch (e) {
        alert('Invalid JSON file: ' + e.message);
      }
    });
  }

  /* ---- Bus Load ---- */
  function getAllMessages() {
    const msgs = [];
    for (const node of state.nodes) {
      for (const msg of node.messages) {
        if (msg.direction === 'TX') msgs.push(msg);
      }
    }
    return msgs;
  }

  function updateBusLoad() {
    const load = Utils.calcBusLoad(getAllMessages(), state.bitrate);
    const display = document.getElementById('bus-load-display');
    const pct = load.toFixed(1);
    display.textContent = `Bus Load: ${pct}%`;
    display.className = 'stat-badge';
    if (load > 70) display.classList.add('danger-text');
    else if (load > 40) display.classList.add('warn-text');
    else display.classList.add('success-text');
  }

  /* ---- Render ---- */
  function render() {
    renderNodeList();
    renderDetail();
    updateBusLoad();
    drawTopology();
  }

  function renderNodeList() {
    const container = document.getElementById('can-node-list');
    container.innerHTML = '';

    for (const node of state.nodes) {
      const card = document.createElement('div');
      card.className = 'item-card' + (selectedNodeId === node.id ? ' selected' : '');
      card.innerHTML = `
        <div>
          <div class="item-name">${escHtml(node.name)}</div>
          <div class="item-sub">${escHtml(node.address)} &middot; ${node.messages.length} msg</div>
        </div>
        <div class="item-actions">
          <button title="Edit" data-action="edit">&#9998;</button>
          <button title="Delete" data-action="delete">&times;</button>
        </div>
      `;
      card.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        if (action === 'edit') { e.stopPropagation(); editNode(node.id); }
        else if (action === 'delete') { e.stopPropagation(); deleteNode(node.id); }
        else selectNode(node.id);
      });
      container.appendChild(card);
    }
  }

  function renderDetail() {
    const placeholder = document.getElementById('can-detail-placeholder');
    const detail = document.getElementById('can-detail');

    if (!selectedNodeId) {
      placeholder.style.display = '';
      detail.style.display = 'none';
      return;
    }

    const node = state.nodes.find(n => n.id === selectedNodeId);
    if (!node) {
      placeholder.style.display = '';
      detail.style.display = 'none';
      return;
    }

    placeholder.style.display = 'none';
    detail.style.display = '';
    document.getElementById('can-detail-title').textContent = node.name + ' — Messages';

    const container = document.getElementById('can-messages-container');
    container.innerHTML = '';

    for (const msg of node.messages) {
      const block = document.createElement('div');
      block.className = 'message-block';

      const dirClass = msg.direction === 'TX' ? 'success-text' : 'warn-text';

      block.innerHTML = `
        <div class="message-header">
          <div>
            <span class="message-title">${escHtml(msg.name)}</span>
            <span class="message-meta">&nbsp; ID: ${escHtml(msg.msgId)} &middot; DLC: ${msg.dlc} &middot; ${msg.cycleTime}ms &middot; <span class="${dirClass}">${msg.direction}</span></span>
          </div>
          <div class="message-actions">
            <button class="btn btn-sm" data-action="add-signal">+ Signal</button>
            <button class="btn btn-sm" data-action="edit-msg">Edit</button>
            <button class="btn btn-sm btn-danger" data-action="delete-msg">&times;</button>
          </div>
        </div>
        <div class="message-body">
          ${renderSignalsTable(node.id, msg)}
        </div>
      `;

      block.querySelector('[data-action="add-signal"]').addEventListener('click', () => addSignal(node.id, msg.id));
      block.querySelector('[data-action="edit-msg"]').addEventListener('click', () => editMessage(node.id, msg.id));
      block.querySelector('[data-action="delete-msg"]').addEventListener('click', () => deleteMessage(node.id, msg.id));

      // Wire up signal edit/delete buttons
      block.querySelectorAll('[data-sig-edit]').forEach(btn => {
        btn.addEventListener('click', () => editSignal(node.id, msg.id, btn.dataset.sigEdit));
      });
      block.querySelectorAll('[data-sig-delete]').forEach(btn => {
        btn.addEventListener('click', () => deleteSignal(node.id, msg.id, btn.dataset.sigDelete));
      });

      container.appendChild(block);
    }
  }

  function renderSignalsTable(nodeId, msg) {
    if (msg.signals.length === 0) {
      return '<div style="color:var(--text-dim);font-size:0.82rem;padding:4px 0;">No signals defined.</div>';
    }

    let rows = '';
    for (const sig of msg.signals) {
      const byteOrderLabel = sig.byteOrder === 'big_endian' ? 'BE' : 'LE';
      const typeLabel = sig.valueType === 'signed' ? 'S' : 'U';
      rows += `<tr>
        <td>${escHtml(sig.name)}</td>
        <td>${sig.startBit}</td>
        <td>${sig.bitLength}</td>
        <td>${byteOrderLabel} / ${typeLabel}</td>
        <td>${sig.factor}, ${sig.offset}</td>
        <td>[${sig.min}, ${sig.max}]</td>
        <td>${escHtml(sig.unit || '-')}</td>
        <td>
          <button class="btn btn-sm" data-sig-edit="${sig.id}">Edit</button>
          <button class="btn btn-sm btn-danger" data-sig-delete="${sig.id}">&times;</button>
        </td>
      </tr>`;
    }

    return `<table class="data-table">
      <thead><tr>
        <th>Signal</th><th>Start Bit</th><th>Length</th><th>Order/Type</th><th>Factor, Offset</th><th>Range</th><th>Unit</th><th></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  /* ---- Topology Diagram ---- */
  function drawTopology() {
    const canvas = document.getElementById('can-topology-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.scale(dpr, dpr);

    const W = canvas.clientWidth;
    const H = canvas.clientHeight;

    ctx.clearRect(0, 0, W, H);

    const nodes = state.nodes;
    if (nodes.length === 0) {
      ctx.fillStyle = '#8088a8';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Add nodes to see the bus topology', W / 2, H / 2);
      return;
    }

    // Draw bus line
    const busY = H / 2;
    const busMargin = 60;
    const busLeft = busMargin;
    const busRight = W - busMargin;

    ctx.strokeStyle = '#d4a800';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(busLeft, busY);
    ctx.lineTo(busRight, busY);
    ctx.stroke();

    // Termination resistors
    drawResistor(ctx, busLeft, busY, 'left');
    drawResistor(ctx, busRight, busY, 'right');

    // Draw CAN-H / CAN-L labels
    ctx.fillStyle = '#d4a800';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CAN-H', W / 2, busY - 8);
    ctx.fillStyle = '#3a8ab0';
    ctx.fillText('CAN-L', W / 2, busY + 18);

    // Draw nodes
    const spacing = (busRight - busLeft) / (nodes.length + 1);
    const nodeW = 90;
    const nodeH = 40;

    nodes.forEach((node, i) => {
      const cx = busLeft + spacing * (i + 1);
      const aboveBelow = i % 2 === 0 ? -1 : 1;
      const ny = busY + aboveBelow * 60;

      // Stub line
      ctx.strokeStyle = '#3a4a70';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, busY);
      ctx.lineTo(cx, ny);
      ctx.stroke();

      // Node box
      ctx.fillStyle = selectedNodeId === node.id ? '#1a2550' : '#0f1535';
      ctx.strokeStyle = selectedNodeId === node.id ? '#d4a800' : '#283060';
      ctx.lineWidth = 1.5;
      roundRect(ctx, cx - nodeW / 2, ny - nodeH / 2, nodeW, nodeH, 6);
      ctx.fill();
      ctx.stroke();

      // Node label
      ctx.fillStyle = '#e8eaf0';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(truncate(node.name, 12), cx, ny - 6);

      ctx.fillStyle = '#8088a8';
      ctx.font = '10px monospace';
      ctx.fillText(node.address, cx, ny + 10);
    });
  }

  function drawResistor(ctx, x, y, side) {
    ctx.fillStyle = '#d4a800';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    const offset = side === 'left' ? -20 : 20;
    ctx.fillText('120Ω', x + offset, y - 12);

    ctx.strokeStyle = '#d4a800';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const dx = side === 'left' ? -1 : 1;
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x + dx * 8, y - 6);
    ctx.lineTo(x + dx * 4, y + 6);
    ctx.lineTo(x + dx * 12, y + 6);
    ctx.lineTo(x + dx * 8, y - 6);
    ctx.stroke();
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
    document.getElementById('can-add-node').addEventListener('click', addNode);
    document.getElementById('can-add-message').addEventListener('click', addMessage);
    document.getElementById('can-export').addEventListener('click', exportJSON);
    document.getElementById('can-import').addEventListener('click', importJSON);
    document.getElementById('can-export-dbc').addEventListener('click', exportDBC);

    document.getElementById('can-bitrate').addEventListener('change', (e) => {
      state.bitrate = parseInt(e.target.value);
      updateBusLoad();
    });

    window.addEventListener('resize', drawTopology);
    render();
  }

  return { init, getState, setState, render, drawTopology };
})();
