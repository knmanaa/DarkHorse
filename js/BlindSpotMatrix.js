// =============================================================================
// BlindSpotMatrix.js — Quadrant bubble chart for market blind spots
// =============================================================================
window.DarkHorse = window.DarkHorse || {};

window.DarkHorse.BlindSpotMatrix = (function () {
  const State = () => window.DarkHorse.GlobalState;
  let container, svg, tooltip;

  const W = 460, H = 360;
  const M = { top: 34, right: 20, bottom: 50, left: 56 };
  const MAX_BUBBLES = 140;
  let minRuns = 5;
  let classFilter = 'ALL';
  let distFilter = 'ALL';

  function init(selector) {
    container = d3.select(selector);
    _render();
    State().on('allData', _update);
  }

  function _render() {
    container.html('');
    container.append('div').attr('class', 'panel-header')
      .html('<span>Public Blind Spot Matrix</span>'
          + '<span style="font-size:.74rem;color:var(--text-muted)">Implied probability vs actual win rate by horse</span>');

    const body = container.append('div').attr('class', 'panel-body').style('padding', '10px 12px');
    const filters = body.append('div').attr('class', 'bs-filters');
    const minRunsWrap = filters.append('label').attr('class', 'bs-filter-item').text('Min races');
    minRunsWrap.append('input')
      .attr('type', 'range')
      .attr('class', 'bs-range')
      .attr('min', 3).attr('max', 20).attr('step', 1).attr('value', minRuns)
      .on('input', function () {
        minRuns = +this.value;
        filters.select('#bs-min-runs-value').text(`>= ${minRuns}`);
        _update();
      });
    minRunsWrap.append('span').attr('id', 'bs-min-runs-value').attr('class', 'bs-filter-value').text(`>= ${minRuns}`);

    const classSel = filters.append('label').attr('class', 'bs-filter-item').text('Class');
    classSel.append('select').attr('id', 'bs-class-filter').attr('class', 'bs-select')
      .on('change', function () { classFilter = this.value; _update(); });

    const distSel = filters.append('label').attr('class', 'bs-filter-item').text('Distance');
    distSel.append('select').attr('id', 'bs-dist-filter').attr('class', 'bs-select')
      .html('<option value="ALL">All</option><option value="SPRINT">Sprint (<=1200m)</option><option value="MILE">Mile (1201-1800m)</option><option value="STAYING">Staying (>1800m)</option>')
      .on('change', function () { distFilter = this.value; _update(); });

    svg = body.append('svg')
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .style('width', '100%')
      .style('height', 'auto')
      .style('overflow', 'visible');

    body.append('div').attr('class', 'oc-note')
      .html('Hover bubbles for details, click a bubble to jump that horse into analysis context.');

    body.append('div').attr('class', 'oc-note')
      .style('margin-top', '6px')
      .html('<strong>How Market Implied Probability is calculated:</strong> For each race row, we use <code>Win Odds</code> from the dataset and compute <code>1 / Win Odds</code>. For each horse bubble, we then average those per-race implied probabilities across its filtered races.');

    tooltip = d3.select('body').selectAll('.d3-tooltip.bs-tt').data([0])
      .join('div').attr('class', 'd3-tooltip bs-tt').style('display', 'none');

  }

  function _update() {
    const data = State().get('allData');
    if (!data || !data.length) return;

    const valid = data.filter(d => +d['Win Odds'] > 0 && d._place && d._place < 99 && d.HorseID && d.Name);

    const classes = Array.from(new Set(valid.map(d => String(d.RaceClass || '').trim()).filter(Boolean))).sort((a, b) => +a - +b);
    const classSelect = container.select('#bs-class-filter');
    if (!classSelect.selectAll('option').size()) {
      classSelect.html('<option value="ALL">All</option>' + classes.map(c => `<option value="${c}">Class ${c}</option>`).join(''));
    } else {
      const current = classSelect.property('value') || classFilter;
      classSelect.html('<option value="ALL">All</option>' + classes.map(c => `<option value="${c}">Class ${c}</option>`).join(''));
      classSelect.property('value', classes.includes(current) || current === 'ALL' ? current : 'ALL');
      classFilter = classSelect.property('value');
    }

    const byHorse = d3.group(valid, d => d.HorseID);
    const horseStats = [];
    byHorse.forEach((rows, horseID) => {
      const scoped = rows.filter(r => {
        if (classFilter !== 'ALL' && String(r.RaceClass || '') !== classFilter) return false;
        const dist = +r['Dist.'] || 0;
        if (distFilter === 'SPRINT') return dist <= 1200;
        if (distFilter === 'MILE') return dist > 1200 && dist <= 1800;
        if (distFilter === 'STAYING') return dist > 1800;
        return true;
      });
      if (!scoped.length) return;
      const races = scoped.length;
      if (races < minRuns) return;
      const wins = scoped.filter(r => r._place === 1).length;
      const implied = d3.mean(scoped, r => 1 / (+r['Win Odds'])) || 0;
      const actual = wins / races;
      const roi = d3.mean(scoped, r => (r._place === 1 ? (+r['Win Odds'] - 1) : -1)) || 0;
      const name = scoped[scoped.length - 1].Name;
      horseStats.push({ horseID, name, races, wins, implied, actual, roi });
    });

    const plotData = horseStats
      .sort((a, b) => b.races - a.races)
      .slice(0, MAX_BUBBLES);

    _draw(plotData);
  }

  function _draw(data) {
    svg.selectAll('*').remove();
    if (!data.length) return;

    const xMax = Math.max(0.45, d3.max(data, d => d.implied) || 0.45);
    const yMax = Math.max(0.45, d3.max(data, d => d.actual) || 0.45);
    const x = d3.scaleLinear().domain([0, xMax]).range([M.left, W - M.right]);
    const y = d3.scaleLinear().domain([0, yMax]).range([H - M.bottom, M.top]);
    const xMidValue = Math.min(0.2, xMax * 0.5);
    const yMidValue = Math.min(0.2, yMax * 0.5);
    const xMid = x(xMidValue);
    const yMid = y(yMidValue);

    const r = d3.scaleSqrt()
      .domain([minRuns, d3.max(data, d => d.races) || minRuns])
      .range([2.8, 9.5]);
    const c = d3.scaleLinear()
      .domain([-0.5, 0, 0.5])
      .range(['#f85149', '#8b949e', '#3fb950']);
    const bg = svg.append('g');
    bg.append('rect').attr('x', M.left).attr('y', M.top).attr('width', xMid - M.left).attr('height', yMid - M.top).attr('fill', '#2f6d3a').attr('opacity', 0.08);
    bg.append('rect').attr('x', xMid).attr('y', M.top).attr('width', W - M.right - xMid).attr('height', yMid - M.top).attr('fill', '#6f3a39').attr('opacity', 0.08);
    bg.append('rect').attr('x', M.left).attr('y', yMid).attr('width', xMid - M.left).attr('height', H - M.bottom - yMid).attr('fill', '#2f3742').attr('opacity', 0.08);
    bg.append('rect').attr('x', xMid).attr('y', yMid).attr('width', W - M.right - xMid).attr('height', H - M.bottom - yMid).attr('fill', '#2f3742').attr('opacity', 0.08);

    // Grid + axes

    // Grid + axes
    svg.append('g')
      .attr('transform', `translate(0,${H - M.bottom})`)
      .call(d3.axisBottom(x).ticks(7).tickFormat(d3.format('.0%')).tickSize(-(H - M.top - M.bottom)))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').attr('stroke', '#21262d').attr('opacity', 0.5))
      .call(g => g.selectAll('text').attr('fill', 'var(--text-secondary)').style('font-size', '9px'));

    svg.append('g')
      .attr('transform', `translate(${M.left},0)`)
      .call(d3.axisLeft(y).ticks(7).tickFormat(d3.format('.0%')).tickSize(-(W - M.left - M.right)))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').attr('stroke', '#21262d').attr('opacity', 0.5))
      .call(g => g.selectAll('text').attr('fill', 'var(--text-secondary)').style('font-size', '9px'));

    // quadrant separators
    svg.append('line')
      .attr('x1', xMid).attr('x2', xMid).attr('y1', M.top).attr('y2', H - M.bottom)
      .attr('stroke', 'var(--text-muted)').attr('stroke-width', 1.1).attr('stroke-dasharray', '6 4').attr('opacity', 0.7);
    svg.append('line')
      .attr('x1', M.left).attr('x2', W - M.right).attr('y1', yMid).attr('y2', yMid)
      .attr('stroke', 'var(--text-muted)').attr('stroke-width', 1.1).attr('stroke-dasharray', '6 4').attr('opacity', 0.7);

    // quadrant labels (outside crowded center zone)
    const qStyle = { fill: 'var(--text-secondary)', size: '9px' };
    svg.append('text').attr('x', M.left + 4).attr('y', M.top - 6).attr('fill', qStyle.fill).style('font-size', qStyle.size).text('Hidden Gems');
    svg.append('text').attr('x', W - M.right - 4).attr('y', M.top - 6).attr('text-anchor', 'end').attr('fill', qStyle.fill).style('font-size', qStyle.size).text('Trap Favourites');
    svg.append('text').attr('x', M.left + 4).attr('y', H - M.bottom + 20).attr('fill', qStyle.fill).style('font-size', qStyle.size).text('Ignored Duds');
    svg.append('text').attr('x', W - M.right - 4).attr('y', H - M.bottom + 20).attr('text-anchor', 'end').attr('fill', qStyle.fill).style('font-size', qStyle.size).text('Fairly Priced');

    // bubbles with jitter in crowded low-probability zone
    const jittered = data.map(d => {
      const jitterAmp = d.implied <= 0.2 ? 5 : 0;
      const jitterSeed = _stableHash(d.horseID);
      const jx = jitterAmp ? ((jitterSeed % 11) - 5) : 0;
      const jy = jitterAmp ? ((((jitterSeed / 13) | 0) % 11) - 5) : 0;
      return { ...d, jx, jy };
    });

    svg.append('g')
      .selectAll('.bs-bubble')
      .data(jittered)
      .enter()
      .append('circle')
      .attr('class', 'bs-bubble')
      .attr('cx', d => x(d.implied) + d.jx)
      .attr('cy', d => y(d.actual) + d.jy)
      .attr('r', d => r(d.races))
      .attr('fill', d => c(d.roi))
      .attr('fill-opacity', 0.76)
      .attr('stroke', '#0d1117')
      .attr('stroke-width', 1.3)
      .on('mouseenter', function (event, d) {
        d3.select(this).attr('fill-opacity', 0.98).attr('stroke', 'var(--text-primary)');
        tooltip.style('display', null)
          .html(
            `<div class="tt-title">${d.name} (${d.horseID})</div>
             <div class="tt-row"><span class="tt-label">Races:</span><span>${d.races}</span></div>
             <div class="tt-row"><span class="tt-label">Wins:</span><span>${d.wins}</span></div>
             <div class="tt-row"><span class="tt-label">Market implied:</span><span>${(d.implied * 100).toFixed(1)}%</span></div>
             <div class="tt-row"><span class="tt-label">Actual win rate:</span><span>${(d.actual * 100).toFixed(1)}%</span></div>
             <div class="tt-row"><span class="tt-label">ROI / race:</span><span>${(d.roi * 100).toFixed(1)}%</span></div>
             <div class="tt-row"><span class="tt-label">Show races:</span><span style="color:var(--accent-cyan)">Click bubble</span></div>`
          )
          .style('left', (event.pageX + 14) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mousemove', event => {
        tooltip.style('left', (event.pageX + 14) + 'px').style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseleave', function () {
        d3.select(this).attr('fill-opacity', 0.76).attr('stroke', '#0d1117');
        tooltip.style('display', 'none');
      })
      .on('click', (_, d) => {
        State().set('activeHorseID', d.horseID);

        // Jump to Horse Analysis tab so the selected horse context is visible.
        document.querySelectorAll('.tab-page').forEach(p => {
          p.style.display = p.id === 'page-dashboard' ? '' : 'none';
        });
        document.querySelectorAll('.nav-tab[data-tab]').forEach(t => {
          t.classList.toggle('active', t.dataset.tab === 'page-dashboard');
        });
      });

    svg.append('text')
      .attr('x', (M.left + W - M.right) / 2).attr('y', H - 6)
      .attr('text-anchor', 'middle').attr('fill', 'var(--text-secondary)').style('font-size', '10px')
      .text('Market Implied Probability');

    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -(M.top + H - M.bottom) / 2).attr('y', 18)
      .attr('text-anchor', 'middle').attr('fill', 'var(--text-secondary)').style('font-size', '10px')
      .text('Actual Win Rate');

    const roiLegend = svg.append('g').attr('transform', `translate(${W - M.right - 120}, ${M.top - 40})`);
    const gradId = 'bs-roi-grad';
    const defs = svg.append('defs');
    const grad = defs.append('linearGradient').attr('id', gradId).attr('x1', '0%').attr('x2', '100%').attr('y1', '0%').attr('y2', '0%');
    grad.append('stop').attr('offset', '0%').attr('stop-color', '#f85149');
    grad.append('stop').attr('offset', '50%').attr('stop-color', '#8b949e');
    grad.append('stop').attr('offset', '100%').attr('stop-color', '#3fb950');
    roiLegend.append('rect').attr('width', 110).attr('height', 8).attr('rx', 3).attr('fill', `url(#${gradId})`);
    roiLegend.append('text').attr('x', 0).attr('y', -3).attr('fill', 'var(--text-secondary)').style('font-size', '8px').text('ROI');
    roiLegend.append('text').attr('x', 0).attr('y', 18).attr('fill', 'var(--text-muted)').style('font-size', '8px').text('-50%');
    roiLegend.append('text').attr('x', 55).attr('y', 18).attr('text-anchor', 'middle').attr('fill', 'var(--text-muted)').style('font-size', '8px').text('0%');
    roiLegend.append('text').attr('x', 110).attr('y', 18).attr('text-anchor', 'end').attr('fill', 'var(--text-muted)').style('font-size', '8px').text('+50%');
  }

  function _stableHash(s) {
    let h = 0;
    const str = String(s || '');
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  return { init };
})();
