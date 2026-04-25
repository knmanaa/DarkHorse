// =============================================================================
// Tutorial.js — Step-by-step guided tour of the DarkHorse UI
// =============================================================================
window.DarkHorse = window.DarkHorse || {};

window.DarkHorse.Tutorial = (function () {

  // ---- Tour steps definition ----------------------------------------------
  const STEPS = [
    {
      tab       : 'page-dashboard',
      target    : '#horse-panel',
      title     : 'Horse Search & Profile',
      body      : 'Start here — type any horse name in the search box to load their full profile: career record, breeding lineage (sire & dam), import type, recent form at a glance, and weight history.',
      placement : 'right',
    },
    {
      tab       : 'page-dashboard',
      target    : '#speed-analytics',
      title     : 'Speed Analytics',
      body      : 'Tracks the selected horse\'s Finish Speed (FSpeed) and finishing position across recent races. An upward FSpeed trend often signals a horse coming into form.',
      placement : 'bottom',
    },
    {
      tab       : 'page-dashboard',
      target    : '#synergy-matrix',
      title     : 'Jockey & Horse',
      body      : 'Shows the trainer and every jockey who has ridden this horse — with win rates, wins/starts, and average finishing positions. The current jockey is highlighted in blue.',
      placement : 'top',
    },
    {
      tab       : 'page-dashboard',
      target    : '#gear-impact',
      title     : 'Gear Impact Analyzer',
      body      : 'Compares this horse\'s performance across different equipment configurations (blinkers, cheekpieces, nosebands…), measured by FSpeed and finishing position.',
      placement : 'top',
    },
    {
      tab        : 'page-race-analysis',
      target     : '#performance-grid',
      openDrawer : true,
      title      : 'Race Runner Table',
      body       : 'Click the "Runners" tab to open this drawer. Pick a race by date using the calendar picker, or switch to "Select Race by Horse" to find every race a specific horse has entered.',
      placement  : 'right',
    },
    {
      tab        : 'page-race-analysis',
      target     : '.ra-bump-wrap',
      openDrawer : false,
      title      : 'Bump Chart',
      body       : 'Visualises every runner\'s lane position at each furlong of the selected race. Hover a line to highlight a horse and trace their journey from the gates to the finish line.',
      placement  : 'bottom',
    },
    {
      tab        : 'page-race-analysis',
      target     : '#btn-replay',
      openDrawer : false,
      title      : 'Race Replay',
      body       : 'Opens a resizable, draggable animated replay of the selected race — watch each runner\'s position evolve in real time along the course. Press Escape or the × button to close.',
      placement  : 'bottom',
    },
    {
      tab       : 'page-market',
      target    : '#jockey-perf',
      title     : 'Jockey & Trainer Analysis',
      body      : 'Search any jockey to see their overall statistics and a ranked breakdown of every trainer they have partnered with — ideal for spotting high-performing jockey–trainer combinations before a race.',
      placement : 'right',
    },
    {
      tab       : 'page-market',
      target    : '#odds-calibration',
      title     : 'Odds Calibration Curve',
      body      : 'Charts implied win probability (from betting odds) against actual win rates, grouped by odds band. Points above the diagonal signal undervalued runners; below means the market overstates their chance.',
      placement : 'left',
    },
    {
      tab       : null,
      target    : '#btn-glossary',
      title     : 'Metric Dictionary',
      body      : 'Open the Dictionary at any time to look up every abbreviation, metric, and term used across DarkHorse — from FSpeed and LBW to RaceClass, Act.Wt., and Dr.',
      placement : 'bottom',
    },
  ];

  // ---- Module state -------------------------------------------------------
  let _step = 0, _active = false;
  let _overlay, _spotlight, _callout;
  let _calloutCounter, _calloutTitle, _calloutBody;
  let _prevBtn, _nextBtn, _exitBtn;

  // ---- Public API ---------------------------------------------------------
  function init() {
    _buildDOM();
    const openBtn = document.getElementById('btn-tutorial');
    if (openBtn) openBtn.addEventListener('click', start);
  }

  // ---- DOM construction ---------------------------------------------------
  function _buildDOM() {
    // Full-screen transparent overlay (pointer-events: none lets UI stay interactive)
    _overlay = document.createElement('div');
    _overlay.id = 'tut-overlay';
    _overlay.className = 'tut-overlay';
    _overlay.style.display = 'none';

    // Spotlight — gets big box-shadow to darken everything outside
    _spotlight = document.createElement('div');
    _spotlight.className = 'tut-spotlight';

    // Callout card
    _callout = document.createElement('div');
    _callout.className = 'tut-callout';
    _callout.setAttribute('role', 'dialog');
    _callout.setAttribute('aria-modal', 'true');
    _callout.setAttribute('aria-label', 'Guided Tour');

    _calloutCounter = document.createElement('div');
    _calloutCounter.className = 'tut-counter';

    _calloutTitle = document.createElement('div');
    _calloutTitle.className = 'tut-title';

    _calloutBody = document.createElement('p');
    _calloutBody.className = 'tut-body';

    // Progress bar
    const _progress = document.createElement('div');
    _progress.className = 'tut-progress';
    _progress.id = 'tut-progress-bar';

    const nav = document.createElement('div');
    nav.className = 'tut-nav';

    _exitBtn = document.createElement('button');
    _exitBtn.className = 'tut-btn tut-btn-ghost';
    _exitBtn.textContent = 'Exit tour';
    _exitBtn.addEventListener('click', stop);

    _prevBtn = document.createElement('button');
    _prevBtn.className = 'tut-btn tut-btn-secondary';
    _prevBtn.textContent = '← Back';
    _prevBtn.addEventListener('click', () => _go(_step - 1));

    _nextBtn = document.createElement('button');
    _nextBtn.className = 'tut-btn tut-btn-primary';
    _nextBtn.textContent = 'Next →';
    _nextBtn.addEventListener('click', () => {
      if (_step >= STEPS.length - 1) stop();
      else _go(_step + 1);
    });

    nav.appendChild(_exitBtn);
    nav.appendChild(_prevBtn);
    nav.appendChild(_nextBtn);

    _callout.appendChild(_calloutCounter);
    _callout.appendChild(_calloutTitle);
    _callout.appendChild(_calloutBody);
    _callout.appendChild(_progress);
    _callout.appendChild(nav);

    _overlay.appendChild(_spotlight);
    _overlay.appendChild(_callout);
    document.body.appendChild(_overlay);

    // Keyboard navigation
    document.addEventListener('keydown', e => {
      if (!_active) return;
      if (e.key === 'Escape')     stop();
      if (e.key === 'ArrowRight') _go(_step + 1);
      if (e.key === 'ArrowLeft')  _go(_step - 1);
    });
  }

  // ---- Tour control -------------------------------------------------------
  function start() {
    _active = true;
    _overlay.style.display = '';
    _go(0);
  }

  function stop() {
    _active = false;
    _overlay.style.display = 'none';
    // Clean up drawer state opened during the tour
    document.getElementById('page-race-analysis')?.classList.remove('ra-panel-open');
  }

  function _switchTab(tabId) {
    document.querySelectorAll('.tab-page').forEach(p => {
      p.style.display = p.id === tabId ? '' : 'none';
    });
    document.querySelectorAll('.nav-tab[data-tab]').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tabId);
    });
  }

  function _go(idx) {
    if (idx < 0 || idx >= STEPS.length) return;
    _step = idx;
    const step = STEPS[_step];

    // Switch tab if needed
    if (step.tab) _switchTab(step.tab);

    // Handle Race Analysis drawer
    if (step.tab === 'page-race-analysis') {
      const raPage = document.getElementById('page-race-analysis');
      if (raPage) {
        if (step.openDrawer === true)  raPage.classList.add('ra-panel-open');
        if (step.openDrawer === false) raPage.classList.remove('ra-panel-open');
      }
    }

    // Update callout content
    _calloutCounter.textContent = `Step ${_step + 1} of ${STEPS.length}`;
    _calloutTitle.textContent   = step.title;
    _calloutBody.textContent    = step.body;
    _prevBtn.disabled           = (_step === 0);
    _nextBtn.textContent        = (_step === STEPS.length - 1) ? 'Done ✓' : 'Next →';

    // Update progress bar
    const pct = ((_step + 1) / STEPS.length * 100).toFixed(1);
    const bar = document.getElementById('tut-progress-bar');
    if (bar) bar.style.setProperty('--tut-pct', pct + '%');

    // Position elements after the DOM reflows (tab switch + drawer animation)
    setTimeout(() => _updatePositions(step), 60);
  }

  // ---- Spotlight + callout positioning ------------------------------------
  const SPOT_PAD = 10; // extra px around the spotlit element
  const MARGIN   = 14; // min gap from viewport edges
  const GAP      = 14; // gap between spotlight edge and callout

  function _updatePositions(step) {
    const targetEl = document.querySelector(step.target);
    if (!targetEl) {
      _spotlight.style.opacity = '0';
      _positionCallout(null, step.placement);
      return;
    }
    _spotlight.style.opacity = '1';
    const rect = targetEl.getBoundingClientRect();
    _positionSpotlight(rect);
    _positionCallout(rect, step.placement);
  }

  function _positionSpotlight(rect) {
    _spotlight.style.left   = (rect.left   - SPOT_PAD) + 'px';
    _spotlight.style.top    = (rect.top    - SPOT_PAD) + 'px';
    _spotlight.style.width  = (rect.width  + SPOT_PAD * 2) + 'px';
    _spotlight.style.height = (rect.height + SPOT_PAD * 2) + 'px';
  }

  function _positionCallout(rect, preferredPlacement) {
    const CW = 340; // callout width (matches CSS max-width)
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    _callout.style.width = CW + 'px';

    // Measure callout height off-screen
    _callout.style.visibility = 'hidden';
    _callout.style.left = '-9999px';
    const ch = _callout.offsetHeight || 200;
    _callout.style.visibility = '';

    if (!rect) {
      // No target: centre the callout
      _callout.style.left = Math.round((vw - CW) / 2) + 'px';
      _callout.style.top  = Math.round(vh * 0.3) + 'px';
      return;
    }

    // tryPlacement sets module-level left/top and returns true if it fits
    let left, top;

    const tryPlacement = (p) => {
      if (p === 'right') {
        left = rect.right + SPOT_PAD + GAP;
        top  = rect.top + (rect.height - ch) / 2;
        return left + CW <= vw - MARGIN;
      }
      if (p === 'left') {
        left = rect.left - SPOT_PAD - GAP - CW;
        top  = rect.top + (rect.height - ch) / 2;
        return left >= MARGIN;
      }
      if (p === 'bottom') {
        top  = rect.bottom + SPOT_PAD + GAP;
        left = rect.left + (rect.width - CW) / 2;
        return top + ch <= vh - MARGIN;
      }
      if (p === 'top') {
        top  = rect.top - SPOT_PAD - GAP - ch;
        left = rect.left + (rect.width - CW) / 2;
        return top >= MARGIN;
      }
      return false;
    };

    const FALLBACKS = {
      right  : ['right', 'left',  'bottom', 'top'],
      left   : ['left',  'right', 'bottom', 'top'],
      bottom : ['bottom','top',   'right',  'left'],
      top    : ['top',   'bottom','right',  'left'],
    };

    let pl = preferredPlacement || 'bottom';
    const order = FALLBACKS[pl] || FALLBACKS.bottom;
    for (const p of order) {
      if (tryPlacement(p)) { pl = p; break; }
    }
    // Ensure left/top are set to the decided placement
    tryPlacement(pl);

    // Clamp within viewport
    left = Math.max(MARGIN, Math.min(left, vw - CW - MARGIN));
    top  = Math.max(MARGIN, Math.min(top,  vh - ch - MARGIN));

    _callout.style.left = Math.round(left) + 'px';
    _callout.style.top  = Math.round(top)  + 'px';
  }

  return { init };
})();
