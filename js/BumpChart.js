// =============================================================================
// BumpChart.js — Animated position bump chart synced with replayTime scrubber
// =============================================================================
window.DarkHorse = window.DarkHorse || {};

window.DarkHorse.BumpChart = (function () {
  const State  = () => window.DarkHorse.GlobalState;
  const COLORS = d3.schemeTableau10;

  let container, svg, raceData = [];
  const W = 580, H = 185, M = { top: 18, right: 52, bottom: 28, left: 90 };

  function init(selector) {
    container = d3.select(selector);
    _render();
    State().on('activeRace',   _onRaceChange);
    State().on('replayTime',   _onScrub);
    State().on('activeHorseID', _updateHighlight);
  }

  // ---- Shell ---------------------------------------------------------------
  function _render() {
    container.html('');
    container.append('div').attr('class', 'panel-header')
      .html('<span>Position Change (Bump Chart)</span><span style="font-size:.74rem;color:var(--text-muted)">hover for details</span>');

    svg = container.append('div').attr('class', 'panel-body').style('padding', '4px 0 0')
      .append('svg')
      .attr('class', 'bump-svg')
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('overflow', 'hidden');

    svg.append('g').attr('id', 'bc-lines');
    svg.append('g').attr('id', 'bc-dots');
    svg.append('line').attr('class', 'bump-now-line').attr('id', 'bc-now')
      .attr('y1', M.top).attr('y2', H - M.bottom)
      .style('display', 'none');
    svg.append('g').attr('id', 'bc-labels');

    container.select('.panel-body').append('div')
      .attr('class', 'empty-state').attr('id', 'bc-empty')
      .text('Select a race from the Race Analysis tab');
  }

  // ---- Handle race changes --------------------------------------------------
  function _onRaceChange() {
    const ar = State().get('activeRace');
    if (!ar) return;
    // Filter to only horses that actually ran (exclude WV/withdrawn: _runPos is [NaN] or empty)
    raceData = State().getRaceData(ar.Date, ar.RaceIndex)
      .filter(h => h._runPos && h._runPos.length > 0 && h._runPos.some(p => !isNaN(p)));
    _draw();
    _onScrub();
  }

  // ---- Main draw: lines + axes (static frame) ------------------------------
  function _draw() {
    const empty = container.select('#bc-empty');

    if (!raceData.length) {
      svg.style('display', 'none');
      empty.style('display', null);
      return;
    }
    svg.style('display', null);
    empty.style('display', 'none');

    // Determine how many checkpoints each horse has
    const maxCk = d3.max(raceData, d => d._runPos.length) || 1;
    const numRunners = raceData.length;

    const x = d3.scaleLinear().domain([0, maxCk - 1]).range([M.left, W - M.right]);
    const y = d3.scaleLinear().domain([1, numRunners]).range([M.top, H - M.bottom]);

    // ---- Axes ----
    svg.selectAll('.bc-axis').remove();

    // X axis — checkpoint labels: Start, check numbers, Finish
    svg.append('g').attr('class', 'bump-axis bc-axis')
      .attr('transform', `translate(0,${H - M.bottom})`)
      .call(d3.axisBottom(x)
        .tickValues(d3.range(0, maxCk))
        .tickFormat(i => i === 0 ? 'Start' : i === maxCk - 1 ? 'Fin.' : `C${i}`)
        .tickSize(3))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').attr('stroke', 'var(--border-light)'))
      .call(g => g.selectAll('text').style('font-size', '7px'));

    // X axis title
    svg.append('text').attr('class', 'bc-axis')
      .attr('x', (M.left + W - M.right) / 2)
      .attr('y', H - 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '8px')
      .style('fill', 'var(--text-muted)')
      .text('Race Checkpoint');

    // Y axis (left) — gridlines only, no tick labels
    svg.append('g').attr('class', 'bump-axis bc-axis')
      .attr('transform', `translate(${M.left},0)`)
      .call(d3.axisLeft(y)
        .tickValues(d3.range(1, numRunners + 1))
        .tickFormat('')
        .tickSize(-(W - M.left - M.right)))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').attr('stroke', 'var(--border-light)').attr('opacity', .4));

    // Y axis (right) — rank labels
    svg.append('g').attr('class', 'bump-axis bc-axis')
      .attr('transform', `translate(${W - M.right},0)`)
      .call(d3.axisRight(y)
        .tickValues(d3.range(1, numRunners + 1))
        .tickFormat(d => d === 1 ? '1st' : d === 2 ? '2nd' : d === 3 ? '3rd' : `${d}th`)
        .tickSize(0))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('text').style('font-size', '9px').attr('fill', 'var(--text-secondary)'));

    // ---- Lines per horse ----
    const activeID = State().get('activeHorseID');
    const linesG   = svg.select('#bc-lines');
    const dotsG    = svg.select('#bc-dots');
    const labelsG  = svg.select('#bc-labels');

    linesG.selectAll('*').remove();
    dotsG.selectAll('*').remove();
    labelsG.selectAll('*').remove();

    // Build tooltip
    let tt = d3.select('body').selectAll('.d3-tooltip.bc-tt').data([0])
      .join('div').attr('class', 'd3-tooltip bc-tt').style('display', 'none');

    raceData.forEach((horse, i) => {
      const color   = COLORS[i % COLORS.length];
      const isActive = horse.HorseID === activeID;
      const runPos  = horse._runPos; // array of ranks at each checkpoint
      if (!runPos || !runPos.length) return;

      // Build point array: [ {ck, pos}, ... ]
      const pts = runPos.map((pos, ck) => ({ ck, pos }));

      const lineGen = d3.line()
        .x(d => x(d.ck))
        .y(d => y(d.pos))
        .curve(d3.curveCatmullRom.alpha(0.5));

      // Draw line
      linesG.append('path')
        .datum(pts)
        .attr('class', `bump-line${isActive ? ' active' : ''}`)
        .attr('d', lineGen)
        .attr('stroke', color)
        .attr('stroke-width', isActive ? 3 : 1.5)
        .attr('opacity', isActive ? 1 : (activeID ? 0.35 : 0.65))
        .on('mouseenter', (event) => {
          tt.style('display', null)
            .html(`<div class="tt-title">${horse.Name}</div>
                   <div class="tt-row"><span class="tt-label">Position:</span><span>${runPos.join(' → ')}</span></div>
                   <div class="tt-row"><span class="tt-label">Finish:</span><span>${horse._place >= 99 ? 'DNF' : horse._place}</span></div>
                   <div class="tt-row"><span class="tt-label">FSpeed:</span><span>${horse.FSpeed.toFixed(2)}s</span></div>`)
            .style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 20) + 'px');
          State().set('hoveredHorseID', horse.HorseID);
        })
        .on('mousemove', (event) => {
          tt.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 20) + 'px');
        })
        .on('mouseleave', () => {
          tt.style('display', 'none');
          State().set('hoveredHorseID', null);
        })
        .on('click', () => State().set('activeHorseID', horse.HorseID));

      // Dots at each checkpoint
      pts.forEach(p => {
        dotsG.append('circle')
          .attr('class', 'bump-dot')
          .attr('cx', x(p.ck))
          .attr('cy', y(p.pos))
          .attr('r', isActive ? 5 : 3)
          .attr('fill', color)
          .attr('opacity', isActive ? 1 : (activeID ? 0.3 : 0.6));
      });

      // Horse name label at STARTING checkpoint (LEFT side)
      labelsG.append('text')
        .attr('x', M.left - 4)
        .attr('y', y(runPos[0]) + 3)
        .attr('text-anchor', 'end')
        .style('font-size', isActive ? '9px' : '7.5px')
        .style('fill', isActive ? color : 'var(--text-muted)')
        .style('font-weight', isActive ? '700' : '400')
        .text(horse.Name.split(' ').slice(0, 2).join(' '));
    });
  }

  // ---- Move "now" line with replayTime -------------------------------------
  function _onScrub() {
    if (!raceData.length) return;
    const t      = State().get('replayTime') || 0;
    const maxCk  = d3.max(raceData, d => d._runPos.length) || 1;
    const x      = d3.scaleLinear().domain([0, maxCk - 1]).range([M.left, W - M.right]);
    const nowCk  = t * (maxCk - 1);
    const nowX   = x(nowCk);

    svg.select('#bc-now')
      .style('display', null)
      .attr('x1', nowX).attr('x2', nowX);
  }

  // ---- Redraw to update active horse highlight on activeHorseID change -----
  function _updateHighlight() {
    if (raceData.length) _draw();
  }

  return { init };
})();
