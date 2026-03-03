/* ===== Main Application ===== */

document.addEventListener('DOMContentLoaded', () => {
  // Tab navigation
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;

      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(target + '-tab').classList.add('active');

      // Redraw diagrams when switching tabs (canvas sizing)
      if (target === 'canbus') CANBus.drawTopology();
      if (target === 'wiring') Wiring.drawWiringDiagram();
    });
  });

  // Initialize modules
  CANBus.init();
  Wiring.init();

  // Persist state to localStorage
  const STORAGE_KEY_CAN = 'canbus_planner_state';
  const STORAGE_KEY_WIRE = 'wiring_planner_state';

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY_CAN, JSON.stringify(CANBus.getState()));
      localStorage.setItem(STORAGE_KEY_WIRE, JSON.stringify(Wiring.getState()));
    } catch (e) {
      // Storage full or unavailable
    }
  }

  function loadState() {
    try {
      const canData = localStorage.getItem(STORAGE_KEY_CAN);
      if (canData) CANBus.setState(JSON.parse(canData));

      const wireData = localStorage.getItem(STORAGE_KEY_WIRE);
      if (wireData) Wiring.setState(JSON.parse(wireData));
    } catch (e) {
      // Corrupted data, start fresh
    }
  }

  loadState();

  // Auto-save on any click (debounced)
  let saveTimer;
  document.addEventListener('click', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveState, 500);
  });

  // Save before unload
  window.addEventListener('beforeunload', saveState);
});
