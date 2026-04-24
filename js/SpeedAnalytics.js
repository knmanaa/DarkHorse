// =============================================================================
// SpeedAnalytics.js — FSpeed trend line + LBW/Odds bar chart
// =============================================================================
window.DarkHorse = window.DarkHorse || {};

window.DarkHorse.SpeedAnalytics = (function () {
  const State = () => window.DarkHorse.GlobalState;
  let container, svgPos, svgLine, svgBar, tooltip;
  const W = 288, H_POS = 68, H_LINE = 96, H_BAR = 86;
  const M = { top: 14, right: 12, bottom: 30, left: 36 };

  function init(selector) {
    container = d3.select(selector);
    _render();
    State().on('activeHorseID', _update);
  }

  function _render() {
    const Tips = () => window.DarkHorse.Tooltips;
    container.html('');
    const header = container.append('div').attr('class', 'panel-header');
    header.append('span').text('Performance Trends');

    const body = container.append('div').attr('class', 'panel-body')
      .style('padding', '4px 8px');

    // ── 1. Finish Position sparkline ─────────────────────────────────────────
    body.append('div')
      .style('font-size', '.72rem').style('color', 'var(--text-secondary)')
      .style('font-weight', '600').style('margin', '2px 0')
      .html('Finish Position <span style="font-weight:400;font-size:.68rem;color:var(--text-muted)">— last 10 races &nbsp;·&nbsp; x-axis: DD/MM/YYYY, oldest→newest</span>');

    svgPos = body.append('svg').attr('class', 'speed-chart')
      .attr('viewBox', `0 0 ${W} ${H_POS}`).attr('preserveAspectRatio', 'xMidYMid meet');

    // ── 2. FSpeed trend chart ───────────────────────────────────────────
    const fspeedHead = body.append('div')
      .style('font-size', '.72rem').style('color', 'var(--text-secondary)')
      .style('font-weight', '600').style('margin', '2px 0');
    const fspeedSpan = fspeedHead.append('span').text('FSpeed Trend');
    fspeedHead.append('span')
      .style('font-weight', '400').style('font-size', '.68rem').style('color', 'var(--text-muted)')
      .text('  ·  x-axis: DD/MM/YYYY, oldest→newest');
    if (Tips()) Tips().attach(fspeedSpan.node(), 'FSpeed');

    svgLine = body.append('svg').attr('class', 'speed-chart')
      .attr('viewBox', `0 0 ${W} ${H_LINE}`).attr('preserveAspectRatio', 'xMidYMid meet');

    // ── 3. LBW & Win Odds ───────────────────────────────────────────────
    const subHead = body.append('div')
      .style('display', 'flex').style('gap', '6px')
      .style('margin-top', '6px').style('font-size', '.78rem')
      .style('color', 'var(--text-secondary)').style('font-weight', '600')
      .style('align-items', 'center');
    const lbwSpan = subHead.append('span').text('LBW');
    subHead.append('span').style('color', 'var(--text-muted)').text('&');
    const oddsSpan = subHead.append('span').text('Win Odds');
    if (Tips()) {
      Tips().attach(lbwSpan.node(), 'LBW');
      Tips().attach(oddsSpan.node(), 'Win Odds');
    }

    svgBar = body.append('svg').attr('class', 'speed-chart')
      .attr('viewBox', `0 0 ${W} ${H_BAR}`).attr('preserveAspectRatio', 'xMidYMid meet');

    body.append('div')
      .style('font-size', '.68rem').style('color', 'var(--text-muted)')
      .style('padding', '2px 4px 0').style('line-height', '1.4')
      .text('LBW bars (left) colored by finish pos. Win Odds (right, purple). Hover bars for details.');

    tooltip = d3.select('body').selectAll('.d3-tooltip.speed-tt').data([0])
      .join('div').attr('class', 'd3-tooltip speed-tt').style('display', 'none');
  }

  function _update() {
    const hid = State().get('activeHorseID');
    svgPos.selectAll('*').remove();
    svgLine.selectAll('*').remove();
    svgBar.selectAll('*').remove();
    if (!hid) return;

    // Sort chronologically: oldest on left, newest (latest) on right
    const allSorted = State().getHorseData(hid)
      .slice().sort((a, b) => a._parsedDate - b._parsedDate);
    const records = allSorted.slice(-10);
    if (records.length < 2) return;

    _drawPositionSpark(records);
    _drawFSpeedLine(records);
    _drawLBWBars(records);
  }

  // Boundary-aware tooltip positioning — flips to the left when near the right edge
  function _ttPos(event) {
    const pad = 10;
    const node = tooltip.node();
    const w = node ? (node.offsetWidth || 180) : 180;
    const x = event.pageX + pad + w > window.innerWidth - 8
      ? event.pageX - w - pad
      : event.pageX + pad;
    tooltip.style('left', x + 'px').style('top', (event.pageY - 30) + 'px');
  }

  function _drawPositionSpark(data) {
    const yMax = d3.max(data, d => Math.min(d._place, 14)) || 14;
    const x = d3.scaleLinear().domain([0, data.length - 1]).range([M.left, W - M.right]);
    const y = d3.scaleLinear().domain([1, yMax]).range([M.top, H_POS - M.bottom]);

    // 1st-place gridline
    svgPos.append('line')
      .attr('x1', M.left).attr('y1', y(1)).attr('x2', W - M.right).attr('y2', y(1))
      .attr('stroke', 'var(--accent-green)').attr('stroke-width', 0.8)
      .attr('stroke-dasharray', '3 2').attr('opacity', 0.5);

    // X axis — full date labels (DD/MM/YYYY), rotated to avoid overlap
    svgPos.append('g').attr('class', 'speed-axis')
      .attr('transform', `translate(0,${H_POS - M.bottom})`)
      .call(d3.axisBottom(x)
        .ticks(Math.min(data.length - 1, 4))
        .tickFormat(v => {
          const d = data[Math.round(v)];
          return d ? d.Date : '';
        }).tickSize(3))
      .select('.domain').remove();
    svgPos.selectAll('.speed-axis text')
      .style('font-size', '5.5px')
      .attr('transform', 'rotate(-40)')
      .style('text-anchor', 'end')
      .attr('dx', '-2').attr('dy', '2');

    // Y axis
    svgPos.append('g').attr('class', 'speed-axis y-axis')
      .attr('transform', `translate(${M.left},0)`)
      .call(d3.axisLeft(y).ticks(2).tickSize(-(W - M.left - M.right)).tickFormat(d => d))
      .select('.domain').remove();
    svgPos.selectAll('.y-axis text').style('font-size', '7px');
    svgPos.selectAll('.speed-axis .tick line').attr('stroke', '#21262d');

    // Y label
    svgPos.append('text')
      .attr('transform', 'rotate(-90)').attr('x', -(H_POS / 2)).attr('y', 11)
      .attr('text-anchor', 'middle').attr('fill', 'var(--text-muted)').style('font-size', '7px')
      .text('Pos.');

    // Area + line
    svgPos.append('path').datum(data)
      .attr('fill', 'var(--accent-cyan)').attr('opacity', 0.12)
      .attr('d', d3.area().x((_, i) => x(i)).y0(H_POS - M.bottom)
        .y1(d => y(Math.min(d._place, yMax))).curve(d3.curveMonotoneX));
    svgPos.append('path').datum(data)
      .attr('fill', 'none').attr('stroke', 'var(--accent-cyan)').attr('stroke-width', 1.6)
      .attr('d', d3.line().x((_, i) => x(i)).y(d => y(Math.min(d._place, yMax))).curve(d3.curveMonotoneX));

    // Dots
    svgPos.selectAll('.pos-dot').data(data).enter()
      .append('circle').attr('class', 'pos-dot')
      .attr('cx', (_, i) => x(i)).attr('cy', d => y(Math.min(d._place, yMax))).attr('r', 3)
      .attr('fill', d => d._place === 1 ? 'var(--accent-green)' : d._place <= 3 ? 'var(--accent-orange)' : 'var(--accent-red)')
      .attr('stroke', 'var(--bg-card)').attr('stroke-width', 1)
      .on('mouseenter', (event, d) => {
        tooltip.style('display', null)
          .html(`<div class="tt-title">${d.Date}</div>
                 <div class="tt-row"><span class="tt-label">Position:</span><span>${d._place >= 99 ? 'DNF' : d._place}</span></div>
                 <div class="tt-row"><span class="tt-label">FSpeed:</span><span>${d.FSpeed.toFixed(2)}s</span></div>
                 <div class="tt-row"><span class="tt-label">Dist:</span><span>${d['Dist.']}m</span></div>`);
        _ttPos(event);
      })
      .on('mouseleave', () => tooltip.style('display', 'none'));
  }

  function _drawFSpeedLine(data) {
    const x = d3.scaleLinear().domain([0, data.length - 1]).range([M.left, W - M.right]);
    const y = d3.scaleLinear()
      .domain([d3.min(data, d => d.FSpeed) - 0.5, d3.max(data, d => d.FSpeed) + 0.5])
      .range([H_LINE - M.bottom, M.top]);

    // Axes — X shows dates in DD/MM, oldest→newest, Y is FSpeed
    svgLine.append('g').attr('class', 'speed-axis')
      .attr('transform', `translate(0,${H_LINE - M.bottom})`)
      .call(d3.axisBottom(x)
        .ticks(Math.min(data.length - 1, 5))
        .tickFormat(v => {
          const d = data[Math.round(v)];
          return d ? d.Date : '';
        }).tickSize(3))
      .select('.domain').remove();
    svgLine.selectAll('.speed-axis text')
      .style('font-size', '5.5px')
      .attr('transform', 'rotate(-40)')
      .style('text-anchor', 'end')
      .attr('dx', '-2').attr('dy', '2');

    svgLine.append('g').attr('class', 'speed-axis y-axis')
      .attr('transform', `translate(${M.left},0)`)
      .call(d3.axisLeft(y).ticks(3).tickSize(-W + M.left + M.right).tickFormat(d => d.toFixed(1)))
      .select('.domain').remove();
    svgLine.selectAll('.y-axis text').style('font-size', '7px');
    svgLine.selectAll('.speed-axis .tick line').attr('stroke', '#21262d');

    // Y-axis label
    svgLine.append('text')
      .attr('transform', `rotate(-90)`).attr('x', -(H_LINE / 2)).attr('y', 10)
      .attr('text-anchor', 'middle').attr('fill', 'var(--text-muted)').style('font-size', '8px')
      .text('FSpeed (s)');

    // Area
    const area = d3.area()
      .x((d, i) => x(i)).y0(H_LINE - M.bottom).y1((d) => y(d.FSpeed))
      .curve(d3.curveMonotoneX);
    svgLine.append('path').datum(data).attr('class', 'speed-area').attr('d', area);

    // Line
    const line = d3.line().x((d, i) => x(i)).y(d => y(d.FSpeed)).curve(d3.curveMonotoneX);
    svgLine.append('path').datum(data).attr('class', 'speed-line').attr('d', line);

    // Dots
    svgLine.selectAll('.speed-dot').data(data).enter()
      .append('circle').attr('class', 'speed-dot')
      .attr('cx', (d, i) => x(i)).attr('cy', d => y(d.FSpeed)).attr('r', 3.5)
      .on('mouseenter', (event, d) => {
        tooltip.style('display', null)
          .html(`<div class="tt-title">${d.Date}</div>
                 <div class="tt-row"><span class="tt-label">FSpeed:</span><span>${d.FSpeed.toFixed(2)}s</span></div>
                 <div class="tt-row"><span class="tt-label">Pos:</span><span>${d['Pla.']}</span></div>
                 <div class="tt-row"><span class="tt-label">Dist:</span><span>${d['Dist.']}m</span></div>`);
        _ttPos(event);
      })
      .on('mouseleave', () => tooltip.style('display', 'none'));
  }

  function _drawLBWBars(data) {
    const x = d3.scaleBand().domain(data.map((d, i) => i)).range([M.left, W - M.right]).padding(0.25);
    const yLBW = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.LBW) || 5])
      .range([H_BAR - M.bottom, M.top]);

    // Axes — X uses full dates (DD/MM/YYYY) rotated, Y is LBW
    svgBar.append('g').attr('class', 'speed-axis')
      .attr('transform', `translate(0,${H_BAR - M.bottom})`)
      .call(d3.axisBottom(x)
        .tickFormat(i => data[i] ? data[i].Date : '')
        .tickSize(3))
      .select('.domain').remove();
    svgBar.selectAll('.speed-axis text')
      .style('font-size', '5.5px')
      .attr('transform', 'rotate(-40)')
      .style('text-anchor', 'end')
      .attr('dx', '-2').attr('dy', '2');

    // Left Y axis for LBW
    svgBar.append('g').attr('class', 'speed-axis y-axis')
      .attr('transform', `translate(${M.left},0)`)
      .call(d3.axisLeft(yLBW).ticks(2).tickSize(0).tickFormat(d => d.toFixed(0)))
      .select('.domain').remove();
    svgBar.selectAll('.y-axis text').style('font-size', '7px');

    // Y-axis label
    svgBar.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -(H_BAR / 2)).attr('y', 9)
      .attr('text-anchor', 'middle').attr('fill', 'var(--text-muted)').style('font-size', '8px')
      .text('LBW (lengths)');

    // LBW bars
    svgBar.selectAll('.lbw-bar').data(data).enter()
      .append('rect').attr('class', 'lbw-bar')
      .attr('x', (d, i) => x(i)).attr('y', d => yLBW(Math.max(d.LBW, 0)))
      .attr('width', x.bandwidth() / 2)
      .attr('height', d => H_BAR - M.bottom - yLBW(Math.max(d.LBW, 0)))
      .attr('fill', d => d._place === 1 ? 'var(--accent-green)' : d._place <= 3 ? 'var(--accent-orange)' : 'var(--accent-red)')
      .attr('rx', 2).attr('opacity', 0.8)
      .on('mouseenter', (event, d) => {
        tooltip.style('display', null)
          .html(`<div class="tt-title">${d.Date} · Race ${d.RaceIndex}</div>
                 <div class="tt-row"><span class="tt-label">Finish pos:</span><span>${d._place >= 99 ? 'DNF' : d._place}</span></div>
                 <div class="tt-row"><span class="tt-label">LBW:</span><span>${(+d.LBW || 0).toFixed(2)} lengths</span></div>
                 <div class="tt-row"><span class="tt-label">FSpeed:</span><span>${d.FSpeed.toFixed(2)}s</span></div>
                 <div class="tt-row"><span class="tt-label">Dist:</span><span>${d['Dist.']}m</span></div>`);
        _ttPos(event);
      })
      .on('mousemove', event => _ttPos(event))
      .on('mouseleave', () => tooltip.style('display', 'none'));

    // Win Odds bars (secondary)
    const yOdds = d3.scaleLinear()
      .domain([0, d3.max(data, d => d['Win Odds']) || 30])
      .range([H_BAR - M.bottom, M.top]);

    svgBar.selectAll('.odds-bar').data(data).enter()
      .append('rect').attr('class', 'odds-bar')
      .attr('x', (d, i) => x(i) + x.bandwidth() / 2).attr('y', d => yOdds(d['Win Odds']))
      .attr('width', x.bandwidth() / 2)
      .attr('height', d => H_BAR - M.bottom - yOdds(d['Win Odds']))
      .attr('fill', 'var(--accent-purple)').attr('rx', 2).attr('opacity', 0.5)
      .on('mouseenter', (event, d) => {
        tooltip.style('display', null)
          .html(`<div class="tt-title">${d.Date} · Race ${d.RaceIndex}</div>
                 <div class="tt-row"><span class="tt-label">Finish pos:</span><span>${d._place >= 99 ? 'DNF' : d._place}</span></div>
                 <div class="tt-row"><span class="tt-label">Win Odds:</span><span>${(+d['Win Odds'] || 0).toFixed(1)}×</span></div>
                 <div class="tt-row"><span class="tt-label">LBW:</span><span>${(+d.LBW || 0).toFixed(2)} lengths</span></div>
                 <div class="tt-row"><span class="tt-label">Jockey:</span><span>${d.Jockey}</span></div>`);
        _ttPos(event);
      })
      .on('mousemove', event => _ttPos(event))
      .on('mouseleave', () => tooltip.style('display', 'none'));

    // Legend — LBW bars are colored by finish position; Win Odds is purple
    [
      { x: M.left + 4,   color: 'var(--accent-green)',  label: '■ 1st (LBW)'  },
      { x: M.left + 62,  color: 'var(--accent-orange)', label: '■ Top 3'       },
      { x: M.left + 102, color: 'var(--accent-red)',     label: '■ Other'       },
      { x: M.left + 138, color: 'var(--accent-purple)', label: '■ W.Odds'      },
    ].forEach(({ x, color, label }) => {
      svgBar.append('text').attr('x', x).attr('y', 10)
        .attr('fill', color).style('font-size', '8px').text(label);
    });
  }

  return { init };
})();
