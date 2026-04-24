// =============================================================================
// PerformanceGrid.js — Race-centric runner table: pick any race, see all horses
// =============================================================================
window.DarkHorse = window.DarkHorse || {};

window.DarkHorse.PerformanceGrid = (function () {
  const State = () => window.DarkHorse.GlobalState;
  const Tips  = () => window.DarkHorse.Tooltips;
  let container, allData = [], _availableDates = [], _validDateSet = new Set(), _currentDateISO = '';
  let _calYear = 0, _calMonth = 0;

  // Columns shown in the "all runners" table
  const COLUMNS = [
    { key: '_place',    label: 'Pos',       tipKey: null,        fmt: null /* badge */ },
    { key: 'Name',      label: 'Horse',     tipKey: null,        fmt: d => d.Name },
    { key: 'Jockey',    label: 'Jockey',    tipKey: null,        fmt: d => d.Jockey },
    { key: 'Dr.',       label: 'Dr.',       tipKey: 'Dr.',       fmt: d => d['Dr.'] },
    { key: 'Rtg.',      label: 'Rtg.',      tipKey: 'Rtg.',      fmt: d => d['Rtg.'] },
    { key: 'LBW',       label: 'LBW',       tipKey: 'LBW',       fmt: d => (+d.LBW || 0).toFixed(1) },
    { key: 'Win Odds',  label: 'Odds',      tipKey: 'Win Odds',  fmt: d => (+d['Win Odds'] || 0).toFixed(1) },
    { key: 'FSpeed',    label: 'FSpd',      tipKey: 'FSpd',      fmt: d => d.FSpeed.toFixed(2) },
    { key: 'Gear',      label: 'Gear',      tipKey: 'Gear',      fmt: d => d.Gear || '—' },
  ];

  // ---- Date format helpers (dataset uses dd/mm/yyyy; input[type=date] needs yyyy-mm-dd)
  function _toInputDate(s) {
    const [d, m, y] = s.split('/');
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  function _fromInputDate(s) {
    if (!s) return '';
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  }

  // ---- Step to prev/next race day -----------------------------------------
  function _findNearest(isoDate) {
    if (!_availableDates.length) return isoDate;
    const ts = new Date(isoDate).getTime();
    return _availableDates.reduce((best, d) =>
      Math.abs(new Date(d) - ts) < Math.abs(new Date(best) - ts) ? d : best);
  }

  function _stepDate(dir) {
    const cur  = _currentDateISO;
    const idx  = _availableDates.indexOf(cur);
    const base = idx === -1 ? _availableDates.indexOf(_findNearest(cur)) : idx;
    const next = Math.max(0, Math.min(_availableDates.length - 1, base + dir));
    const newDate = _availableDates[next];
    _setPickedDate(newDate);
    _populateRaceIndex(_fromInputDate(newDate));
    _loadRace();
  }

  function init(selector) {
    container = d3.select(selector);
    _render();
    State().on('allData', data => { allData = data; _populateDatePicker(); });
    State().on('activeRace', _highlightRow);
    // Toggle for the slide-in drawer
    document.getElementById('ra-panel-toggle').addEventListener('click', () => {
      document.getElementById('page-race-analysis').classList.toggle('ra-panel-open');
    });
    // Close calendar on outside click
    document.addEventListener('click', () => {
      const popup = document.getElementById('rp-cal-popup');
      if (popup) popup.style.display = 'none';
    });
  }

  function _render() {
    container.html('');
    container.append('div').attr('class', 'panel-header').html('<span>Race Runner Table</span>');

    // Race picker
    const picker = container.append('div').attr('class', 'race-picker');
    const row1 = picker.append('div').attr('class', 'race-picker-row');
    row1.append('label').text('Date');
    row1.append('button').attr('class', 'race-nav-btn').attr('id', 'rp-prev').text('◄')
      .on('click', () => _stepDate(-1));

    // Custom calendar button + popup
    const calWrap = row1.append('div').attr('class', 'cal-wrap');
    calWrap.append('button').attr('class', 'cal-btn').attr('id', 'rp-date-btn').text('—')
      .on('click', function (event) {
        event.stopPropagation();
        _toggleCalPopup();
      });
    calWrap.append('div').attr('class', 'cal-popup').attr('id', 'rp-cal-popup')
      .style('display', 'none');

    row1.append('button').attr('class', 'race-nav-btn').attr('id', 'rp-next').text('►')
      .on('click', () => _stepDate(1));

    const row2 = picker.append('div').attr('class', 'race-picker-row');
    row2.append('label').text('Race');
    row2.append('select').attr('id', 'rp-race').on('change', _loadRace);

    container.append('div').attr('class', 'panel-body').attr('id', 'perf-table-wrap')
      .html('<div class="empty-state">Select a date and race above</div>');
  }

  // ---- Populate calendar date input from unique race dates -----------------
  function _populateDatePicker() {
    const dates = Array.from(new Set(allData.map(d => d.Date)))
      .sort((a, b) => {
        // dd/mm/yyyy — sort ascending for min/max
        const [da, ma, ya] = a.split('/').map(Number);
        const [db, mb, yb] = b.split('/').map(Number);
        return new Date(ya, ma - 1, da) - new Date(yb, mb - 1, db);
      });

    if (!dates.length) return;
    const oldest  = dates[0];
    const newest  = dates[dates.length - 1];

    _availableDates = dates.map(d => _toInputDate(d)); // sorted ascending (oldest→newest)
    _validDateSet = new Set(_availableDates);

    _setPickedDate(_toInputDate(newest));
    _populateRaceIndex(newest);
    _loadRace();
  }

  // ---- Populate race index dropdown for selected date ----------------------
  function _populateRaceIndex(date) {
    const races = Array.from(new Set(
      allData.filter(d => d.Date === date).map(d => +d.RaceIndex)
    )).sort((a, b) => a - b);

    const sel = container.select('#rp-race');
    sel.selectAll('option').remove();
    races.forEach(r => sel.append('option').attr('value', r).text(`Race ${r}`));
  }

  // ---- Render runner table for a given date + raceIndex (no State side-effects) ----
  function _renderRunnerTable(date, raceIndex) {
    const runners = allData
      .filter(d => {
        if (d.Date !== date || +d.RaceIndex !== raceIndex) return false;
        // Exclude withdrawn horses (WV): _runPos is all NaN or empty, and FSpeed is 0/NaN
        const hasRunPos = d._runPos && d._runPos.length > 0 && d._runPos.some(p => !isNaN(p));
        return hasRunPos;
      })
      .slice()
      .sort((a, b) => a._place - b._place);

    const wrap = container.select('#perf-table-wrap');
    wrap.html('');

    if (!runners.length) {
      wrap.html('<div class="empty-state">No data for this race</div>');
      return;
    }

    const sample = runners[0];
    wrap.append('div')
      .style('font-size', '.78rem')
      .style('color', 'var(--text-secondary)')
      .style('padding', '4px 8px 6px')
      .text(`${sample._track ? sample._track.venue : '—'} · ${sample['Dist.']}m · ${sample.G} · ${sample.RaceClass}`);

    const table = wrap.append('table').attr('class', 'perf-table');
    const thead = table.append('thead').append('tr');
    COLUMNS.forEach(col => {
      const th = thead.append('th').text(col.label);
      if (col.tipKey && Tips()) Tips().attach(th.node(), col.tipKey);
    });

    const tbody = table.append('tbody');
    runners.forEach(d => {
      const tr = tbody.append('tr')
        .datum(d)
        .classed('selected-race', _isActiveHorse(d))
        .on('click', () => {
          State().batch({
            activeRace   : { Date: d.Date, RaceIndex: d.RaceIndex },
            activeHorseID: d.HorseID,
          });
        });
      COLUMNS.forEach(col => {
        const td = tr.append('td');
        if (col.key === '_place') {
          const p   = d._place;
          const cls = p === 1 ? 'place-1' : p === 2 ? 'place-2' : p === 3 ? 'place-3' : 'place-other';
          td.append('span').attr('class', `place-badge ${cls}`).text(p >= 99 ? 'X' : p);
        } else {
          td.text(col.fmt(d));
        }
      });
    });
  }

  // ---- Load and render runners for selected Date + RaceIndex ---------------
  function _loadRace() {
    const rawDate = _currentDateISO;      // yyyy-mm-dd
    const date    = _fromInputDate(rawDate); // dd/mm/yyyy
    const raceIndex  = +(container.select('#rp-race').node().value);
    if (!date || !raceIndex) return;

    // Sync global activeRace state (this also triggers RaceReplay + BumpChart)
    State().set('activeRace', { Date: date, RaceIndex: raceIndex });
    _renderRunnerTable(date, raceIndex);
  }

  function _highlightRow() {
    // Re-render when activeRace changes externally (e.g. from app boot or BumpChart click)
    const ar = State().get('activeRace');
    if (!ar) return;

    const currentDate    = _fromInputDate(_currentDateISO);
    const currentRaceIdx = +(container.select('#rp-race').node()?.value || 0);

    // Sync the date picker if date changed
    if (currentDate !== ar.Date) {
      _setPickedDate(_toInputDate(ar.Date));
      _populateRaceIndex(ar.Date);
    }
    // Sync the race dropdown if raceIndex changed (even on same date)
    if (currentRaceIdx !== ar.RaceIndex) {
      container.select('#rp-race').property('value', +ar.RaceIndex);
    }
    // Re-render the runner table whenever activeRace changes externally
    _renderRunnerTable(ar.Date, ar.RaceIndex);
  }

  function _isActiveHorse(d) {
    const aid = State().get('activeHorseID');
    return aid && d.HorseID === aid;
  }

  // ---- Custom calendar popup -----------------------------------------------
  function _setPickedDate(iso) {
    _currentDateISO = iso || '';
    if (!iso) { container.select('#rp-date-btn').text('—'); return; }
    const [y, m, d] = iso.split('-');
    container.select('#rp-date-btn').text(`${d}/${m}/${y}`);
    _calYear = +y; _calMonth = +m - 1;
  }

  function _toggleCalPopup() {
    const popup = document.getElementById('rp-cal-popup');
    if (!popup) return;
    if (popup.style.display === 'none') {
      if (!_calYear) { // initialise to current month if unset
        const now = new Date();
        _calYear = now.getFullYear(); _calMonth = now.getMonth();
      }
      _renderCalGrid();
      popup.style.display = '';
    } else {
      popup.style.display = 'none';
    }
  }

  function _renderCalGrid() {
    const popup = d3.select('#rp-cal-popup');
    popup.html('');
    const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];
    const MONTHS = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];

    const hdr = popup.append('div').attr('class', 'cal-header');
    hdr.append('button').attr('class', 'cal-nav-btn').text('◀')
      .on('click', e => { e.stopPropagation(); _navCal(-1); });
    hdr.append('span').text(`${MONTHS[_calMonth]} ${_calYear}`);
    hdr.append('button').attr('class', 'cal-nav-btn').text('▶')
      .on('click', e => { e.stopPropagation(); _navCal(1); });

    const grid = popup.append('div').attr('class', 'cal-grid');
    DAYS.forEach(d => grid.append('div').attr('class', 'cal-weekday').text(d));

    const firstDay   = new Date(_calYear, _calMonth, 1).getDay();
    const daysInMonth = new Date(_calYear, _calMonth + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) {
      grid.append('div').attr('class', 'cal-day empty-day');
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const iso  = `${_calYear}-${String(_calMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const isRace = _validDateSet.has(iso);
      const isSel  = iso === _currentDateISO;
      const cell = grid.append('div')
        .attr('class', `cal-day${isRace ? ' race-day' : ' no-race'}${isSel ? ' selected' : ''}`)
        .text(day);
      if (isRace) {
        cell.on('click', e => {
          e.stopPropagation();
          _setPickedDate(iso);
          _populateRaceIndex(_fromInputDate(iso));
          _loadRace();
          document.getElementById('rp-cal-popup').style.display = 'none';
        });
      }
    }
  }

  function _navCal(dir) {
    _calMonth += dir;
    if (_calMonth > 11) { _calMonth = 0; _calYear++; }
    if (_calMonth < 0)  { _calMonth = 11; _calYear--; }
    _renderCalGrid();
  }

  return { init };
})();

