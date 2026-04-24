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

    // Normalize each record's gear into a canonical sorted full-name key
    // so "B TT" and "TT B" (or other ordering variants) collapse into one group.
    const normalizeGear = (rawGear) => {
      if (!rawGear || rawGear === '--') return 'NO GEAR';
      const parts = Loader().parseGearString(rawGear);
      if (!parts.length) return 'NO GEAR';
      return parts.map(g => Loader().getGearFullName(g)).sort().join(' + ');
    };

    const gearGroups = d3.group(records, d => normalizeGear(d.Gear));
    const noGearKey = 'NO GEAR';
    const baselineFSpeed = gearGroups.has(noGearKey)
      ? d3.mean(gearGroups.get(noGearKey), d => d.FSpeed)
      : d3.mean(records, d => d.FSpeed);

    // Compute impact for each gear config
    const impacts = [];
    gearGroups.forEach((recs, gearName) => {
      const avgFSpeed = d3.mean(recs, d => d.FSpeed);
      const delta = avgFSpeed - baselineFSpeed;

      impacts.push({
        gearName,
        count: recs.length,
        avgFSpeed,
        delta,
        winPct: recs.filter(r => r._place === 1).length / recs.length * 100,
      });
    });

    impacts.sort((a, b) => a.delta - b.delta); // lower FSpeed = faster = better

    body.html('');

    const Tips = window.DarkHorse.Tooltips;

    // Column definitions: key, label, tipKey
    const COLS = [
      { label: 'Gear',       tipKey: 'Gear'      },
      { label: 'Races',      tipKey: 'Races'     },
      { label: 'Avg FSpeed', tipKey: 'Avg FSpeed'},
      { label: 'Win %',      tipKey: 'Win %'     },
      { label: 'Δ FSpeed',   tipKey: 'Δ FSpeed'  },
    ];

    const tableDiv = body.append('div').style('padding', '4px');
    const table = tableDiv.append('table').attr('class', 'synergy-table');
    const thead = table.append('thead').append('tr');
    COLS.forEach(col => {
      const th = thead.append('th').text(col.label);
      if (Tips) Tips.attach(th.node(), col.tipKey);
    });

    const tbody = table.append('tbody');

    impacts.forEach(imp => {
      const tr = tbody.append('tr');

      // Gear name (truncated with title for long combos)
      tr.append('td')
        .attr('title', imp.gearName)
        .style('max-width', '120px')
        .style('white-space', 'nowrap')
        .style('overflow', 'hidden')
        .style('text-overflow', 'ellipsis')
        .text(imp.gearName);

      // Races
      tr.append('td').text(imp.count);

      // Avg FSpeed
      tr.append('td').text(imp.avgFSpeed.toFixed(2) + 's');

      // Win %
      tr.append('td').text(imp.winPct.toFixed(1) + '%');

      // Δ FSpeed — green if negative (faster), red if positive (slower)
      const faster = imp.delta < 0;
      const neutral = Math.abs(imp.delta) < 0.001;
      const deltaColor = neutral
        ? 'var(--text-secondary)'
        : faster ? 'var(--accent-green)' : 'var(--accent-red)';
      tr.append('td')
        .style('font-weight', '600')
        .style('font-family', 'var(--font-mono)')
        .style('color', deltaColor)
        .text(neutral ? '—'
          : (faster ? '▼ ' : '▲ ') + Math.abs(imp.delta).toFixed(2) + 's');
    });
  }

  return { init };
})();
