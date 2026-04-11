// =============================================================================
// PerformanceGrid.js — Sortable historical race table for the active horse
// =============================================================================
window.DarkHorse = window.DarkHorse || {};

window.DarkHorse.PerformanceGrid = (function () {
  const State = () => window.DarkHorse.GlobalState;
  let container, sortKey = '_parsedDate', sortAsc = false;

  const COLUMNS = [
    { key: '_place', label: 'Pos', fmt: _fmtPlace, width: '36px' },
    { key: 'Date', label: 'Date', fmt: d => d.Date },
    { key: 'Jockey', label: 'Jockey', fmt: d => d.Jockey },
    { key: '_track', label: 'Track', fmt: d => d._track.venue },
    { key: 'Dist.', label: 'Dist', fmt: d => d['Dist.'] },
    { key: 'G', label: 'G', fmt: d => d.G },
    { key: 'Finish Time', label: 'Time', fmt: d => d['Finish Time'].toFixed(2) },
    { key: 'Gear', label: 'Gear', fmt: d => d.Gear },
    { key: 'FSpeed', label: 'FSpd', fmt: d => d.FSpeed.toFixed(2) },
  ];

  function init(selector) {
    container = d3.select(selector);
    _render();
    State().on('activeHorseID', _update);
    State().on('activeRace', _update);
  }

  function _render() {
    container.html('');
    container.append('div').attr('class', 'panel-header')
      .html('<span>Detailed Historical Race Performance</span>');

    const controls = container.append('div').attr('class', 'perf-controls');
    controls.append('span').style('font-size', '.78rem').style('color', 'var(--text-secondary)').text('Period:');
    const sel = controls.append('select').attr('id', 'perf-period');
    sel.append('option').attr('value', '0').text('All Races');
    sel.append('option').attr('value', '365').text('Last 1 Year');
    sel.append('option').attr('value', '730').attr('selected', true).text('Last 2 Years');
    sel.on('change', _update);

    controls.append('button').text('Search').on('click', _update);

    container.append('div').attr('class', 'panel-body').attr('id', 'perf-table-wrap');
    _update();
  }

  function _update() {
    const hid = State().get('activeHorseID');
    const wrap = container.select('#perf-table-wrap');
    if (!hid) {
      wrap.html('<div class="empty-state">Select a horse to view history</div>');
      return;
    }

    let records = State().getHorseData(hid);
    const period = +container.select('#perf-period').node().value;
    if (period > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - period);
      records = records.filter(r => r._parsedDate >= cutoff);
    }

    // Sort
    records.sort((a, b) => {
      let va = _sortVal(a, sortKey), vb = _sortVal(b, sortKey);
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });

    wrap.html('');
    const table = wrap.append('table').attr('class', 'perf-table');
    const thead = table.append('thead').append('tr');

    COLUMNS.forEach(col => {
      thead.append('th')
        .style('width', col.width || 'auto')
        .text(col.label + (sortKey === col.key ? (sortAsc ? ' ▲' : ' ▼') : ''))
        .on('click', () => {
          if (sortKey === col.key) sortAsc = !sortAsc;
          else { sortKey = col.key; sortAsc = true; }
          _update();
        });
    });

    const tbody = table.append('tbody');
    records.forEach((d, i) => {
      const tr = tbody.append('tr')
        .datum(d)
        .classed('selected-race', _isSelectedRace(d))
        .on('click', () => {
          State().set('activeRace', { Date: d.Date, RaceIndex: d.RaceIndex });
        });

      COLUMNS.forEach(col => {
        const td = tr.append('td');
        if (col.key === '_place') {
          const p = d._place;
          const cls = p === 1 ? 'place-1' : p === 2 ? 'place-2' : p === 3 ? 'place-3' : 'place-other';
          td.append('span').attr('class', `place-badge ${cls}`).text(p >= 99 ? 'X' : p);
        } else {
          td.text(col.fmt(d));
        }
      });
    });
  }

  function _fmtPlace(d) { return d._place; }

  function _sortVal(d, key) {
    if (key === '_parsedDate') return d._parsedDate;
    if (key === '_place') return d._place;
    if (key === '_track') return d._track.venue;
    return d[key];
  }

  function _isSelectedRace(d) {
    const ar = State().get('activeRace');
    return ar && ar.Date === d.Date && ar.RaceIndex === d.RaceIndex;
  }

  return { init };
})();
