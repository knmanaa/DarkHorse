// =============================================================================
// app.js — Main orchestrator: loads data, initializes all components
// =============================================================================
(function () {
  const { GlobalState, DataLoader, SidebarSelector, PerformanceGrid,
          RaceReplay, SpeedAnalytics, BumpChart,
          SynergyMatrix, GearImpactAnalyzer,
          JockeyHorseMatrix, TrainerSeasonality,
          OddsCalibration, BlindSpotMatrix, Tutorial } = window.DarkHorse;

  // ---- Shared: make a floating popup draggable by its title bar -----------
  function makeDraggable(popup, bar) {
    let startX, startY, startL, startT;
    bar.addEventListener('mousedown', e => {
      // Don't hijack clicks on interactive elements inside the bar (inputs, buttons)
      if (e.target.closest('input, button, select, textarea')) return;
      e.preventDefault();
      const rect = popup.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startL = rect.left;
      startT = rect.top;
      // Anchor to left/top so right-based positioning doesn't interfere
      popup.style.right = 'auto';
      popup.style.left  = startL + 'px';
      popup.style.top   = startT + 'px';

      function onMove(ev) {
        popup.style.left = (startL + ev.clientX - startX) + 'px';
        popup.style.top  = (startT + ev.clientY - startY) + 'px';
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    });
  }

  // ---- Replay floating popup -----------------------------------------------
  function initReplayPopup() {
    const popup   = document.getElementById('replay-popup');
    const openBtn = document.getElementById('btn-replay');
    const closeBtn= document.getElementById('replay-close');
    if (!popup || !openBtn) return;
    openBtn.addEventListener('click', () => { popup.style.display = 'flex'; });
    closeBtn.addEventListener('click', () => { popup.style.display = 'none'; });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && popup.style.display !== 'none') popup.style.display = 'none';
    });
    makeDraggable(popup, document.getElementById('replay-bar'));
  }

  // ---- Tab Switching -------------------------------------------------------
  function initTabs() {
    document.querySelectorAll('.nav-tab[data-tab]').forEach(btn => {
      btn.addEventListener('click', function () {
        const target = this.dataset.tab;
        document.querySelectorAll('.tab-page').forEach(p => {
          p.style.display = p.id === target ? '' : 'none';
        });
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
      });
    });
  }

  // ---- Dictionary ----------------------------------------------------------
  function initGlossary() {
    const defs    = window.DarkHorse.Tooltips.DEFINITIONS;
    const overlay = document.getElementById('glossary-overlay');
    const bodyEl  = document.getElementById('glossary-body');
    const searchEl= document.getElementById('glossary-search');
    const openBtn = document.getElementById('btn-glossary');
    const closeBtn= document.getElementById('glossary-close');

    // Deduplicate by definition text, prefer shorter/cleaner key
    const byDef = new Map();
    Object.entries(defs).forEach(([key, def]) => {
      if (!byDef.has(def) || key.length < byDef.get(def).key.length) {
        byDef.set(def, { key, def });
      }
    });

    // Categorize
    const CATEGORIES = [
      { label: 'Performance', keys: ['FSpeed','LBW','Win Rate','Place Rate','Avg FSpeed','Avg Finish','Rtg.','Act.Wt.','Declar.Horse Wt.','RunningPosition'] },
      { label: 'Race & Track', keys: ['Dist.','G','RaceClass','Dr.','Win Odds'] },
      { label: 'Gear',         keys: ['Gear'] },
      { label: 'Horse Info',   keys: ['Sire','Dam','ImportType'] },
      { label: 'Combined Stats', keys: ['Win %','Wo.','Avg.P.','Avg Position','Avg LBW','Place%','Common Races','Races','Δ FSpeed'] },
    ];

    // Build ordered list: categorized first, then any remainder alphabetically
    const ordered = [];
    const used = new Set();
    CATEGORIES.forEach(cat => {
      const items = cat.keys
        .map(k => {
          // find matching entry by key or by definition lookup
          const direct = byDef.get(defs[k]);
          return direct || null;
        })
        .filter(Boolean)
        .filter(item => !used.has(item.key));
      if (items.length) {
        ordered.push({ type: 'category', label: cat.label });
        items.forEach(item => { ordered.push({ type: 'term', ...item }); used.add(item.key); });
      }
    });
    // Remaining entries alphabetically
    Array.from(byDef.values())
      .filter(item => !used.has(item.key))
      .sort((a, b) => a.key.localeCompare(b.key))
      .forEach(item => ordered.push({ type: 'term', ...item }));

    function render(q) {
      bodyEl.innerHTML = '';
      const lower = (q || '').toLowerCase();
      let lastCat = null;
      ordered.forEach(entry => {
        if (entry.type === 'category') {
          lastCat = entry.label;
          return; // wait until we know there's at least one visible term in this cat
        }
        if (lower && !entry.key.toLowerCase().includes(lower) && !entry.def.toLowerCase().includes(lower)) return;
        // Inject category heading before first visible term in a group
        if (lastCat) {
          const catEl = document.createElement('div');
          catEl.className = 'gloss-category';
          catEl.textContent = lastCat;
          bodyEl.appendChild(catEl);
          lastCat = null;
        }
        const el = document.createElement('div');
        el.className = 'gloss-term';
        el.innerHTML = `<span class="gloss-key">${entry.key}</span><span class="gloss-def">${entry.def}</span>`;
        bodyEl.appendChild(el);
      });
      if (!bodyEl.childElementCount) {
        bodyEl.innerHTML = '<div class="gloss-empty">No matching terms.</div>';
      }
    }

    render();
    searchEl.addEventListener('input', () => render(searchEl.value));
    openBtn.addEventListener('click', () => { overlay.style.display = 'flex'; setTimeout(() => searchEl.focus(), 50); });
    closeBtn.addEventListener('click', () => { overlay.style.display = 'none'; searchEl.value = ''; render(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay.style.display !== 'none') { overlay.style.display = 'none'; searchEl.value = ''; render(); } });
    makeDraggable(overlay, document.getElementById('glossary-bar'));
  }

  // ---- Application Boot ---------------------------------------------------
  function boot() {
    initTabs();
    initGlossary();
    initReplayPopup();
    Tutorial.init();

    // Show loading state while data loads
    d3.select('#race-replay').html(
      '<div class="loading-state"><div class="loading-spinner"></div>Loading race data…</div>'
    );

    DataLoader.load('dataset/20242025HongKongHorseRacingRawData.csv')
      .then(data => {
        console.log(
          `[DarkHorse] Loaded ${data.length} records, ` +
          `${new Set(data.map(d => d.HorseID)).size} unique horses`
        );

        // Init components (registers listeners) BEFORE setting data
        SidebarSelector.init('#horse-panel');
        SpeedAnalytics.init('#speed-analytics');
        SynergyMatrix.init('#synergy-matrix');
        GearImpactAnalyzer.init('#gear-impact');
        PerformanceGrid.init('#performance-grid');
        RaceReplay.init('#race-replay');
        BumpChart.init('#bump-chart');
        JockeyHorseMatrix.init('#jockey-perf');
        TrainerSeasonality.init('#trainer-seasonality');
        OddsCalibration.init('#odds-calibration');
        BlindSpotMatrix.init('#blind-spot-matrix');

        // Publish data to all listeners
        GlobalState.set('allData', data);

        // Auto-select first horse + their most recent race
        const horses = GlobalState.getUniqueHorses();
        if (horses.length > 0) {
          GlobalState.set('activeHorseID', horses[0].HorseID);
          const horseData = GlobalState.getHorseData(horses[0].HorseID);
          if (horseData.length > 0) {
            const lastRace = horseData[horseData.length - 1];
            GlobalState.set('activeRace', {
              Date      : lastRace.Date,
              RaceIndex : lastRace.RaceIndex,
            });
          }
        }
      })
      .catch(err => {
        console.error('[DarkHorse] Failed to load data:', err);
        d3.select('#race-replay').html(
          `<div class="empty-state">Error loading data. Serve from an HTTP server.<br>
           <code style="font-size:.75rem;color:var(--accent-red)">${err.message}</code></div>`
        );
      });
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

