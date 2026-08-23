/* =============================================================
   TheRacingData — Fuel & Stint Calculator
   The stint chart.

   One horizontal bar per stint, on a shared lap axis, so two
   candidates can be read against each other by eye rather than by
   arithmetic. Signal Red as fill, hatching where the tyre is what
   binds the stint rather than the fuel, Steel for an assumed
   safety car, and mandatory windows as rules across the plot.

   SVG built with attributes, not a style attribute anywhere: the
   page takes default-src 'none' and style-src 'self', and a chart
   that needs an exemption is a chart that has to be rebuilt.
   ============================================================= */

const NS = 'http://www.w3.org/2000/svg';

const ROW = 34;
const GAP = 8;
const PAD = { top: 30, right: 18, bottom: 30, left: 60 };

function el(tag, attrs = {}, text) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  if (text != null) n.textContent = text;
  return n;
}

export function render(host, computed, candidate) {
  host.replaceChildren();
  if (!candidate || !candidate.stints.length) return;

  const raceLaps = computed.derived.raceLaps || 1;
  const rows = candidate.stints.length;
  const width = Math.max(320, host.clientWidth || 420);
  const plotW = width - PAD.left - PAD.right;
  const height = PAD.top + rows * (ROW + GAP) + PAD.bottom;

  const svg = el('svg', {
    width: '100%', height,
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    'aria-label': `Stint plan: ${candidate.stops} stop, ` +
                  candidate.stints.map(s => `${s.laps} laps`).join(', '),
  });

  const x = lap => PAD.left + (lap / raceLaps) * plotW;

  const defs = el('defs');
  // Hatching marks a tyre-limited stint. Fuel-limited and tyre-limited
  // call for opposite decisions, so they cannot look the same.
  const hatch = el('pattern', {
    id: 'trd-fs-hatch', width: 6, height: 6,
    patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)',
  });
  hatch.append(el('rect', { width: 6, height: 6, fill: '#970000' }));
  hatch.append(el('rect', { width: 2, height: 6, fill: '#6E0000' }));
  defs.append(hatch);
  svg.append(defs);

  /* ---- assumed safety car windows, behind everything ---- */
  for (const sc of computed.sc?.assumed || []) {
    const from = Number(sc.startLap), laps = Number(sc.laps);
    if (!Number.isFinite(from) || !Number.isFinite(laps) || laps <= 0) continue;
    svg.append(el('rect', {
      x: x(from - 1), y: PAD.top - 8, width: Math.max(1, x(from - 1 + laps) - x(from - 1)),
      height: rows * (ROW + GAP) + 8, fill: '#6F6F78', 'fill-opacity': '0.22',
    }));
  }

  /* ---- mandatory windows, as rules ---- */
  for (const w of computed.rules?.mandatoryWindow || []) {
    const open = Number(w.openLap), close = Number(w.closeLap);
    if (!Number.isFinite(open) || !Number.isFinite(close)) continue;
    for (const [lap, label] of [[open, `open ${open}`], [close, `close ${close}`]]) {
      svg.append(el('line', {
        x1: x(lap), x2: x(lap), y1: PAD.top - 10, y2: PAD.top + rows * (ROW + GAP),
        stroke: '#232327', 'stroke-width': 1, 'stroke-dasharray': '3 3',
      }));
      svg.append(el('text', {
        x: x(lap) + 3, y: PAD.top - 14, fill: '#74747A',
        'font-size': 9, 'letter-spacing': '0.12em',
      }, label.toUpperCase()));
    }
  }

  /* ---- the stints ---- */
  candidate.stints.forEach((s, i) => {
    const y = PAD.top + i * (ROW + GAP);
    const x0 = x(s.fromLap - 1);
    const w = Math.max(2, x(s.toLap) - x0);
    const tyreBound = s.binding === 'tyre';

    svg.append(el('rect', {
      x: x0, y, width: w, height: ROW,
      fill: tyreBound ? 'url(#trd-fs-hatch)' : '#970000',
    }));

    svg.append(el('text', {
      x: PAD.left - 10, y: y + ROW / 2 + 4, fill: '#8E8E95',
      'font-size': 11, 'text-anchor': 'end', 'letter-spacing': '0.1em',
    }, `S${s.n}`));

    // Paper on Signal Red clears 8:1. The label goes outside the bar
    // when the bar is too narrow to hold it.
    const label = `${s.laps} laps · ${s.load_l.toFixed(1)} l`;
    const inside = w > 128;
    svg.append(el('text', {
      x: inside ? x0 + 10 : x0 + w + 8,
      y: y + ROW / 2 + 4,
      fill: inside ? '#F2F0EC' : '#A6A6AD',
      'font-size': 12, 'font-weight': 600,
    }, label));

    if (i < candidate.stints.length - 1) {
      svg.append(el('line', {
        x1: x(s.toLap), x2: x(s.toLap), y1: y, y2: y + ROW + GAP,
        stroke: '#CC0000', 'stroke-width': 2,
      }));
    }
  });

  /* ---- lap axis ---- */
  const axisY = PAD.top + rows * (ROW + GAP) + 6;
  svg.append(el('line', {
    x1: PAD.left, x2: PAD.left + plotW, y1: axisY, y2: axisY,
    stroke: '#232327', 'stroke-width': 1,
  }));
  const step = tickStep(raceLaps);
  for (let lap = 0; lap <= raceLaps; lap += step) {
    svg.append(el('line', {
      x1: x(lap), x2: x(lap), y1: axisY, y2: axisY + 4,
      stroke: '#232327', 'stroke-width': 1,
    }));
    svg.append(el('text', {
      x: x(lap), y: axisY + 16, fill: '#74747A',
      'font-size': 10, 'text-anchor': 'middle',
    }, String(lap)));
  }
  svg.append(el('text', {
    x: PAD.left + plotW, y: PAD.top - 14, fill: '#74747A',
    'font-size': 9, 'text-anchor': 'end', 'letter-spacing': '0.18em',
  }, 'LAP'));

  host.append(svg);
}

function tickStep(laps) {
  if (laps <= 20) return 5;
  if (laps <= 60) return 10;
  if (laps <= 150) return 25;
  return 50;
}
