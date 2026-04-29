// =============================================================================
// SynergyMatrix.js — Jockey & Horse panel (trainer fixed display + jockey table)
// =============================================================================
window.DarkHorse = window.DarkHorse || {};

window.DarkHorse.SynergyMatrix = (function () {
  const State = () => window.DarkHorse.GlobalState;
  let container;

  function init(selector) {
    container = d3.select(selector);
    _render();
    State().on('activeHorseID', _update);
  }

  function _render() {
    container.html('');
    container.append('div').attr('class', 'panel-header')
      .html('<span>Jockey &amp; Horse</span>');

    // Fixed display label (no dropdown)
    container.append('div').attr('class', 'synergy-controls').attr('id', 'synergy-selectors');
    container.append('div').attr('id', 'synergy-content').attr('class', 'panel-body');
  }

  function _update() {
    const hid = State().get('activeHorseID');
    const content   = container.select('#synergy-content');
    const selectors = container.select('#synergy-selectors');

    if (!hid) {
      content.html('<div class="empty-state">Select a horse to view trainer & jockey info</div>');
      selectors.html('');
      return;
    }

    const records = State().getHorseData(hid);
    if (!records.length) return;

    const latest  = records[records.length - 1];
    const trainer = latest.Trainer;

    // Fixed display: clearly labeled Trainer and Horse
    selectors.html('');
    const trainerGroup = selectors.append('span').style('display','inline-flex').style('align-items','center').style('gap','3px');
    trainerGroup.append('span').style('font-size','.73rem').style('color','var(--text-muted)').text('Trainer:');
    trainerGroup.append('span').style('font-weight','600').style('font-size','.82rem').text(trainer);
    selectors.append('span').style('color','var(--text-muted)').style('margin','0 10px').text('·');
    const horseGroup = selectors.append('span').style('display','inline-flex').style('align-items','center').style('gap','3px');
    horseGroup.append('span').style('font-size','.73rem').style('color','var(--text-muted)').text('Horse:');
    horseGroup.append('span').style('font-weight','600').style('font-size','.82rem').text(latest.Name);

    _renderTrainerData(records, content, latest);
  }

  function _renderTrainerData(records, content, latest) {
    const Tips = window.DarkHorse.Tooltips;
    content.html('');

    const currentJockey = latest.Jockey;

    content.append('div')
      .style('font-size', '.78rem').style('color', 'var(--text-muted)').style('padding', '2px 0 6px')
      .text(`Current Jockey: ${currentJockey}`);

    // Trainer × Horse stats (all time)
    content.append('div').style('font-weight', '600').style('font-size', '.82rem')
      .style('padding', '0 0 4px').style('color', 'var(--accent-blue)')
      .text('Trainer × Horse Performance');

    const stats   = content.append('div').attr('class', 'synergy-stats');
    const total   = records.length;
    const wins    = records.filter(r => r._place === 1).length;
    const places  = records.filter(r => r._place <= 3).length;
    const avgPos  = total ? d3.mean(records, r => r._place) : 0;
    const avgFS   = total ? d3.mean(records, r => r.FSpeed) : 0;

    [
      { val: total,                                                          lbl: 'Races',        tipKey: 'Races'       },
      { val: total > 0 ? (wins   / total * 100).toFixed(0) + '%' : '0%',   lbl: 'Win%',         tipKey: 'Win%'        },
      { val: total > 0 ? (places / total * 100).toFixed(0) + '%' : '0%',   lbl: 'Place%',       tipKey: 'Place%'      },
      { val: avgPos.toFixed(1),                                              lbl: 'Avg Position', tipKey: 'Avg Position'},
      { val: total > 0 ? avgFS.toFixed(2) + 's' : '--',                    lbl: 'Avg FSpeed',   tipKey: 'Avg FSpeed'  },
    ].forEach(s => {
      const box = stats.append('div').attr('class', 'synergy-stat');
      box.append('div').attr('class', 'val').text(s.val);
      const lbl = box.append('div').attr('class', 'lbl').text(s.lbl);
      if (Tips && s.tipKey) Tips.attach(lbl.node(), s.tipKey);
    });

    // Jockeys who have ridden this horse
    content.append('div').style('font-weight', '600').style('font-size', '.82rem')
      .style('padding', '10px 0 4px').style('color', 'var(--accent-blue)')
      .text('Jockeys on This Horse');

    const jockeyGroups = d3.group(records, d => d.Jockey);
    const jockeyData  = Array.from(jockeyGroups, ([jockey, recs]) => {
      const w = recs.filter(r => r._place === 1).length;
      const t = recs.length;
      return {
        jockey, wins: w, total: t,
        winPct : t > 0 ? (w / t * 100) : 0,
        avgPos : d3.mean(recs, r => r._place),
      };
    });

    const JCOLS = [
      { label: 'Jockey', key: 'jockey',  num: false },
      { label: 'Win %',  key: 'winPct',  num: true  },
      { label: 'Wo.',    key: 'total',   num: true  },
      { label: 'Avg.P.', key: 'avgPos',  num: true  },
    ];

    let jSortKey = 'total', jSortAsc = false;

    const jTableWrap = content.append('div');
    const renderJTable = () => {
      jTableWrap.html('');
      const sorted = jockeyData.slice().sort((a, b) => {
        const va = a[jSortKey], vb = b[jSortKey];
        const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
        return jSortAsc ? cmp : -cmp;
      });
      const table = jTableWrap.append('table').attr('class', 'synergy-table sortable-table');
      const thead = table.append('thead').append('tr');
      JCOLS.forEach(col => {
        const active = col.key === jSortKey;
        const th = thead.append('th')
          .attr('class', 'sortable-th' + (active ? ' sort-active' : ''))
          .html(col.label + `<span class="sort-arrow">${active ? (jSortAsc ? ' ▲' : ' ▼') : ' ⇅'}</span>`)
          .on('click', () => {
            if (jSortKey === col.key) jSortAsc = !jSortAsc;
            else { jSortKey = col.key; jSortAsc = col.num ? false : true; }
            renderJTable();
          });
        if (Tips) Tips.attach(th.node(), col.label);
      });
      const tbody = table.append('tbody');
      sorted.forEach(js => {
        const tr = tbody.append('tr');
        if (js.jockey === currentJockey) tr.style('color', 'var(--accent-blue)').style('font-weight', '600');
        tr.append('td').text(js.jockey);
        tr.append('td').text(js.winPct.toFixed(0) + '%');
        tr.append('td').text(js.wins + '/' + js.total);
        tr.append('td').text(js.avgPos.toFixed(1));
      });
    };
    renderJTable();
  }

  return { init };
})();
