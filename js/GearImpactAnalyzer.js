// =============================================================================
// GearImpactAnalyzer.js — Before/After gear impact on FSpeed
// =============================================================================
window.DarkHorse = window.DarkHorse || {};

window.DarkHorse.GearImpactAnalyzer = (function () {
  const State = () => window.DarkHorse.GlobalState;
  const Loader = () => window.DarkHorse.DataLoader;
  let container, tooltip;

  function init(selector) {
    container = d3.select(selector);
    _render();
    State().on('activeHorseID', _update);
  }

  function _render() {
    container.html('');
    const header = container.append('div').attr('class', 'panel-header');
    header.append('span').text('Gear Impact Analysis');
    header.append('div').attr('class', 'header-actions');

    // Filters
    const controls = container.append('div').attr('class', 'synergy-controls');
    controls.append('label').text('Distance:');
    const distSel = controls.append('select').attr('id', 'gear-dist-filter');
    distSel.append('option').attr('value', 'all').text('All');
    [1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400].forEach(d => {
      distSel.append('option').attr('value', d).text(d + 'm');
    });
    distSel.on('change', _update);

    container.append('div').attr('class', 'panel-body').attr('id', 'gear-impact-body');

    tooltip = d3.select('body').selectAll('.d3-tooltip.gear-tt').data([0])
      .join('div').attr('class', 'd3-tooltip gear-tt').style('display', 'none');
  }

  function _update() {
    const hid = State().get('activeHorseID');
    const body = container.select('#gear-impact-body');

    if (!hid) {
      body.html('<div class="empty-state">Select a horse to analyze gear impact</div>');
      return;
    }

    let records = State().getHorseData(hid);
    const distFilter = container.select('#gear-dist-filter').node().value;
    if (distFilter !== 'all') {
      records = records.filter(r => r['Dist.'] === +distFilter);
    }

    if (records.length < 2) {
      body.html('<div class="empty-state">Not enough data for analysis</div>');
      return;
    }

    // Group races by gear configuration
    const gearGroups = d3.group(records, d => d.Gear);
    const noGearKey = '--';
    const baselineFSpeed = gearGroups.has(noGearKey)
      ? d3.mean(gearGroups.get(noGearKey), d => d.FSpeed)
      : d3.mean(records, d => d.FSpeed);

    // Compute impact for each gear config
    const impacts = [];
    gearGroups.forEach((recs, gear) => {
      const avgFSpeed = d3.mean(recs, d => d.FSpeed);
      const delta = avgFSpeed - baselineFSpeed;
      const gearParts = Loader().parseGearString(gear);
      const gearName = gearParts.length > 0
        ? gearParts.map(g => Loader().getGearFullName(g)).join(' + ')
        : (gear === noGearKey ? 'NO GEAR' : gear);

      impacts.push({
        gear,
        gearName,
        count: recs.length,
        avgFSpeed,
        delta,
        winPct: recs.filter(r => r._place === 1).length / recs.length * 100,
      });
    });

    impacts.sort((a, b) => a.delta - b.delta); // lower FSpeed = faster = better

    body.html('');

    // Table header
    const tableDiv = body.append('div').style('padding', '4px');
    const table = tableDiv.append('table').attr('class', 'synergy-table');
    const thead = table.append('thead').append('tr');
    ['Gear', 'Impact', 'Avg. FSpeed'].forEach(h => thead.append('th').text(h));

    const tbody = table.append('tbody');
    const maxAbsDelta = d3.max(impacts, d => Math.abs(d.delta)) || 1;

    impacts.forEach(imp => {
      const tr = tbody.append('tr')
        .on('mouseenter', (event) => {
          tooltip.style('display', null)
            .html(`<div class="tt-title">${imp.gearName}</div>
                   <div class="tt-row"><span class="tt-label">Races:</span><span>${imp.count}</span></div>
                   <div class="tt-row"><span class="tt-label">Avg FSpeed:</span><span>${imp.avgFSpeed.toFixed(2)}s</span></div>
                   <div class="tt-row"><span class="tt-label">Win%:</span><span>${imp.winPct.toFixed(0)}%</span></div>
                   <div class="tt-row"><span class="tt-label">Δ FSpeed:</span><span>${imp.delta > 0 ? '+' : ''}${imp.delta.toFixed(2)}s</span></div>`)
            .style('left', (event.pageX + 10) + 'px').style('top', (event.pageY - 20) + 'px');
        })
        .on('mouseleave', () => tooltip.style('display', 'none'));

      tr.append('td').text(imp.gearName);

      // Impact bar
      const barTd = tr.append('td').style('width', '140px');
      const barWrap = barTd.append('div').attr('class', 'gear-bar-track');
      const pctWidth = Math.abs(imp.delta) / maxAbsDelta * 100;
      const isPositive = imp.delta <= 0; // lower FSpeed = faster = positive impact
      barWrap.append('div')
        .attr('class', `gear-bar-fill ${isPositive ? 'positive' : 'negative'}`)
        .style('width', Math.max(pctWidth, 8) + '%')
        .text((isPositive ? '↓' : '↑') + Math.abs(imp.delta).toFixed(2));

      tr.append('td').attr('class', 'gear-avg-fspeed').text(imp.avgFSpeed.toFixed(2) + 's');
    });
  }

  return { init };
})();
