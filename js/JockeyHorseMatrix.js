// =============================================================================
// JockeyHorseMatrix.js — Jockey → Trainer partnership analysis (Market Intelligence)
// =============================================================================
window.DarkHorse = window.DarkHorse || {};

window.DarkHorse.JockeyHorseMatrix = (function () {
  const State = () => window.DarkHorse.GlobalState;
  let container, _allData = [];

  function init(selector) {
    container = d3.select(selector);
    _render();
    State().on('allData', data => { _allData = data; _populateJockeySelect(); });
  }

  // ---- Shell ---------------------------------------------------------------
  function _render() {
    container.html('');
    container.append('div').attr('class', 'panel-header')
      .html('<span>Jockey &amp; Trainer Analysis</span>');

    // Jockey autocomplete search
    const ctrl = container.append('div').attr('class', 'synergy-controls').attr('id', 'jht-controls')
      .style('flex-direction', 'column').style('gap', '5px').style('align-items', 'stretch');
    ctrl.append('input').attr('type', 'text').attr('id', 'jht-jockey-filter')
      .attr('placeholder', 'Search jockey…')
      .style('background', 'var(--bg-input)').style('border', '1px solid var(--border)')
      .style('border-radius', 'var(--radius-sm)').style('color', 'var(--text-primary)')
      .style('font-size', '.80rem').style('padding', '4px 8px').style('box-sizing', 'border-box');
    ctrl.append('div').attr('id', 'jht-ac-list').attr('class', 'pg-ac-list');
    ctrl.append('div').attr('id', 'jht-selected').attr('class', 'pg-selected-horse').style('display', 'none');

    container.append('div').attr('id', 'jht-content').attr('class', 'panel-body')
      .html('<div class="empty-state">Search and select a jockey above</div>');
  }

  // ---- Populate jockey autocomplete from allData --------------------------
  let _allJockeys = [];

  function _populateJockeySelect() {
    _allJockeys = [...new Set(_allData.map(d => d.Jockey))].filter(Boolean).sort();

    const filterInput = container.select('#jht-jockey-filter');
    _renderJockeyAcList(_allJockeys);

    filterInput.on('input', function () {
      const q = this.value.toLowerCase().trim();
      const matches = q ? _allJockeys.filter(j => j.toLowerCase().includes(q)) : _allJockeys;
      _renderJockeyAcList(matches);
      // Clear selected badge if user types again
      container.select('#jht-selected').style('display', 'none');
    });
  }

  function _renderJockeyAcList(jockeys) {
    const list = container.select('#jht-ac-list');
    list.html('');
    if (!jockeys.length) {
      list.append('div').attr('class', 'pg-ac-empty').text('No matching jockeys');
      return;
    }
    jockeys.forEach(j => {
      list.append('div').attr('class', 'pg-ac-row')
        .on('click', () => _selectJockey(j))
        .append('span').attr('class', 'pg-ac-name').text(j);
    });
  }

  function _selectJockey(jockey) {
    container.select('#jht-jockey-filter').property('value', jockey);
    container.select('#jht-ac-list').html('');
    const badge = container.select('#jht-selected').style('display', '');
    badge.html('');
    badge.append('span').attr('class', 'pg-sel-label').text(jockey);
    _renderJockeyTrainer(jockey);
  }

  // ---- Render jockey overview + trainer partnership table ------------------
  function _renderJockeyTrainer(jockey) {
    const Tips = window.DarkHorse.Tooltips;
    const content = container.select('#jht-content');
    content.html('');

    const jockeyRecs = _allData.filter(d => d.Jockey === jockey);
    if (!jockeyRecs.length) {
      content.html('<div class="empty-state">No data for this jockey</div>');
      return;
    }

    // Overall stats header
    const total  = jockeyRecs.length;
    const wins   = jockeyRecs.filter(r => r._place === 1).length;
    const places = jockeyRecs.filter(r => r._place <= 3).length;
    const avgPos = d3.mean(jockeyRecs, r => r._place);
    const avgFS  = d3.mean(jockeyRecs, r => r.FSpeed);

    content.append('div')
      .style('font-weight', '600').style('font-size', '.84rem')
      .style('padding', '4px 0 6px').style('color', 'var(--accent-blue)')
      .text(`${jockey} — Overview`);

    const stats = content.append('div').attr('class', 'synergy-stats');
    [
      { val: total,                                   lbl: 'Races',    tipKey: 'Races'        },
      { val: (wins / total * 100).toFixed(0) + '%',  lbl: 'Win%',     tipKey: 'Win%'         },
      { val: (places / total * 100).toFixed(0) + '%',lbl: 'Place%',   tipKey: 'Place%'       },
      { val: avgPos.toFixed(1),                       lbl: 'Avg Pos',  tipKey: 'Avg Position' },
      { val: avgFS.toFixed(2) + 's',                  lbl: 'Avg FSpd', tipKey: 'Avg FSpeed'   },
    ].forEach(s => {
      const box = stats.append('div').attr('class', 'synergy-stat');
      box.append('div').attr('class', 'val').text(s.val);
      const lbl = box.append('div').attr('class', 'lbl').text(s.lbl);
      if (Tips && s.tipKey) Tips.attach(lbl.node(), s.tipKey);
    });

    // Trainer partnership table
    content.append('div')
      .style('font-weight', '600').style('font-size', '.82rem')
      .style('padding', '10px 0 4px').style('color', 'var(--accent-blue)')
      .text('Trainer Partnerships');

    const trainerGroups = d3.group(jockeyRecs, d => d.Trainer);
    const trainerData = Array.from(trainerGroups, ([trainer, recs]) => {
      const w = recs.filter(r => r._place === 1).length;
      const t = recs.length;
      return {
        trainer,
        winPct : (w / t * 100),
        total  : t,
        wins   : w,
        avgPos : d3.mean(recs, r => r._place),
      };
    });

    const TCOLS = [
      { label: 'Trainer', key: 'trainer', num: false },
      { label: 'Win%',    key: 'winPct',  num: true  },
      { label: 'Wo.',     key: 'total',   num: true  },
      { label: 'Avg.P.',  key: 'avgPos',  num: true  },
    ];

    let tSortKey = 'wins', tSortAsc = false;

    const tTableWrap = content.append('div');
    const renderTTable = () => {
      tTableWrap.html('');
      const sorted = trainerData.slice().sort((a, b) => {
        const va = a[tSortKey], vb = b[tSortKey];
        const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
        return tSortAsc ? cmp : -cmp;
      });
      const table = tTableWrap.append('table').attr('class', 'synergy-table sortable-table');
      const thead = table.append('thead').append('tr');
      TCOLS.forEach(col => {
        const active = col.key === tSortKey;
        const th = thead.append('th')
          .attr('class', 'sortable-th' + (active ? ' sort-active' : ''))
          .html(col.label + `<span class="sort-arrow">${active ? (tSortAsc ? ' ▲' : ' ▼') : ' ⇅'}</span>`)
          .on('click', () => {
            if (tSortKey === col.key) tSortAsc = !tSortAsc;
            else { tSortKey = col.key; tSortAsc = col.num ? false : true; }
            renderTTable();
          });
        if (Tips && col.tipKey) Tips.attach(th.node(), col.tipKey);
      });
      const tbody = table.append('tbody');
      sorted.forEach(ts => {
        const tr = tbody.append('tr');
        tr.append('td').text(ts.trainer);
        tr.append('td').text(ts.winPct.toFixed(1) + '%');
        tr.append('td').text(ts.wins + '/' + ts.total);
        tr.append('td').text(ts.avgPos.toFixed(1));
      });
    };
    renderTTable();
  }

  return { init };
})();
