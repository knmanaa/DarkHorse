// =============================================================================
// SynergyMatrix.js — Jockey × Horse combination analysis
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
      .html('<span>Jockey &amp; Trainers</span>');

    // Controls
    const controls = container.append('div').attr('class', 'synergy-controls');
    controls.append('label').text("Jockey's Name and Horse Combination");

    container.append('div').attr('class', 'synergy-controls').attr('id', 'synergy-selectors');
    container.append('div').attr('id', 'synergy-content').attr('class', 'panel-body');
  }

  function _update() {
    const hid = State().get('activeHorseID');
    const content = container.select('#synergy-content');
    const selectors = container.select('#synergy-selectors');

    if (!hid) {
      content.html('<div class="empty-state">Select a horse to view jockey synergy</div>');
      selectors.html('');
      return;
    }

    const records = State().getHorseData(hid);
    if (!records.length) return;

    const latest = records[records.length - 1];

    // Get unique jockeys for this horse
    const jockeys = [...new Set(records.map(r => r.Jockey))].sort();

    // Selectors
    selectors.html('');
    const jSel = selectors.append('select').attr('id', 'synergy-jockey-select');
    jockeys.forEach(j => {
      jSel.append('option').attr('value', j)
        .property('selected', j === latest.Jockey)
        .text(j);
    });
    selectors.append('span').style('color', 'var(--text-secondary)').style('margin', '0 4px').text('&');
    selectors.append('span').style('font-weight', '600').text(latest.Name);
    selectors.append('button').text('Select').on('click', () => _renderCombo(records));

    _renderCombo(records);
  }

  function _renderCombo(records) {
    const content = container.select('#synergy-content');
    content.html('');

    const selJockey = container.select('#synergy-jockey-select').node();
    const jockey = selJockey ? selJockey.value : records[records.length - 1].Jockey;

    const comboRecords = records.filter(r => r.Jockey === jockey);
    const allJockeyRecords = State().get('allData').filter(r => r.Jockey === jockey);

    // Joint Performance Overview
    content.append('div').style('font-weight', '600').style('font-size', '.82rem')
      .style('padding', '4px 0').style('color', 'var(--accent-blue)').text('Joint Performance Overview');

    const stats = content.append('div').attr('class', 'synergy-stats');
    const total = comboRecords.length;
    const wins = comboRecords.filter(r => r._place === 1).length;
    const places = comboRecords.filter(r => r._place <= 3).length;
    const avgPos = total ? d3.mean(comboRecords, r => r._place) : 0;
    const avgLBW = total ? d3.mean(comboRecords, r => r.LBW) : 0;

    [
      { val: total, lbl: 'Common Races' },
      { val: total > 0 ? (wins / total * 100).toFixed(0) + '%' : '0%', lbl: 'Win%' },
      { val: total > 0 ? (places / total * 100).toFixed(0) + '%' : '0%', lbl: 'Place%' },
      { val: avgPos.toFixed(1), lbl: 'Avg Position' },
      { val: avgLBW.toFixed(1) + 'L', lbl: 'Avg LBW' },
      { val: total > 0 ? d3.mean(comboRecords, r => r.FSpeed).toFixed(2) : '--', lbl: 'Avg FSpeed' },
    ].forEach(s => {
      const box = stats.append('div').attr('class', 'synergy-stat');
      box.append('div').attr('class', 'val').text(s.val);
      box.append('div').attr('class', 'lbl').text(s.lbl);
    });

    // Trainer Performance Table
    content.append('div').style('font-weight', '600').style('font-size', '.82rem')
      .style('padding', '8px 0 4px').style('color', 'var(--accent-blue)').text('Trainer Performance');

    const trainers = d3.group(allJockeyRecords, d => d.Trainer);
    const trainerStats = Array.from(trainers, ([trainer, recs]) => {
      const w = recs.filter(r => r._place === 1).length;
      const t = recs.length;
      return {
        trainer,
        winPct: t > 0 ? (w / t * 100).toFixed(1) : '0',
        total: t,
        wins: w,
        avgPos: d3.mean(recs, r => r._place).toFixed(1),
        avgRenumeration: '0.0',
      };
    }).sort((a, b) => b.wins - a.wins).slice(0, 8);

    const table = content.append('table').attr('class', 'synergy-table');
    const thead = table.append('thead').append('tr');
    ['Trainer', 'Win %', 'Wo.', 'Avg.P.'].forEach(h => {
      thead.append('th').text(h);
    });

    const tbody = table.append('tbody');
    trainerStats.forEach(ts => {
      const tr = tbody.append('tr');
      tr.append('td').text(ts.trainer);
      tr.append('td').text(ts.winPct + '%');
      tr.append('td').text(ts.wins + '/' + ts.total);
      tr.append('td').text(ts.avgPos);
    });
  }

  return { init };
})();
