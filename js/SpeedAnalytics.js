// =============================================================================
// SpeedAnalytics.js — FSpeed trend line + LBW/Odds bar chart
// =============================================================================
window.DarkHorse = window.DarkHorse || {};

window.DarkHorse.SpeedAnalytics = (function () {
  const State = () => window.DarkHorse.GlobalState;
  let container, svgLine, svgBar, tooltip;
  const W = 288, H_LINE = 110, H_BAR = 90;
  const M = { top: 16, right: 12, bottom: 22, left: 36 };

  function init(selector) {
    container = d3.select(selector);
    _render();
    State().on('activeHorseID', _update);
  }

  function _render() {
    container.html('');
    container.append('div').attr('class', 'panel-header').text('FSpeed Trend (Last 10 Races)');
    const body = container.append('div').attr('class', 'panel-body')
      .style('padding', '4px 8px');

    svgLine = body.append('svg').attr('class', 'speed-chart')
      .attr('viewBox', `0 0 ${W} ${H_LINE}`).attr('preserveAspectRatio', 'xMidYMid meet');

    body.append('div').style('margin-top', '6px').style('font-size', '.78rem')
      .style('color', 'var(--text-secondary)').style('font-weight', '600').text('LBW & Win Odds');
    svgBar = body.append('svg').attr('class', 'speed-chart')
      .attr('viewBox', `0 0 ${W} ${H_BAR}`).attr('preserveAspectRatio', 'xMidYMid meet');

    tooltip = d3.select('body').selectAll('.d3-tooltip.speed-tt').data([0])
      .join('div').attr('class', 'd3-tooltip speed-tt').style('display', 'none');
  }

  function _update() {
    const hid = State().get('activeHorseID');
    svgLine.selectAll('*').remove();
    svgBar.selectAll('*').remove();
    if (!hid) return;

    const records = State().getHorseData(hid).slice(-10);
    if (records.length < 2) return;

    _drawFSpeedLine(records);
    _drawLBWBars(records);
  }

  function _drawFSpeedLine(data) {
    const x = d3.scaleLinear().domain([0, data.length - 1]).range([M.left, W - M.right]);
    const y = d3.scaleLinear()
      .domain([d3.min(data, d => d.FSpeed) - 0.5, d3.max(data, d => d.FSpeed) + 0.5])
      .range([H_LINE - M.bottom, M.top]);

    // Axes
    svgLine.append('g').attr('class', 'speed-axis')
      .attr('transform', `translate(0,${H_LINE - M.bottom})`)
      .call(d3.axisBottom(x).ticks(data.length).tickFormat((d, i) => i + 1).tickSize(3))
      .select('.domain').remove();

    svgLine.append('g').attr('class', 'speed-axis')
      .attr('transform', `translate(${M.left},0)`)
      .call(d3.axisLeft(y).ticks(4).tickSize(-W + M.left + M.right).tickFormat(d => d.toFixed(1)))
      .select('.domain').remove();
    svgLine.selectAll('.speed-axis .tick line').attr('stroke', '#21262d');

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
                 <div class="tt-row"><span class="tt-label">Dist:</span><span>${d['Dist.']}m</span></div>`)
          .style('left', (event.pageX + 10) + 'px').style('top', (event.pageY - 30) + 'px');
      })
      .on('mouseleave', () => tooltip.style('display', 'none'));
  }

  function _drawLBWBars(data) {
    const x = d3.scaleBand().domain(data.map((d, i) => i)).range([M.left, W - M.right]).padding(0.25);
    const yLBW = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.LBW) || 5])
      .range([H_BAR - M.bottom, M.top]);

    // Axes
    svgBar.append('g').attr('class', 'speed-axis')
      .attr('transform', `translate(0,${H_BAR - M.bottom})`)
      .call(d3.axisBottom(x).tickFormat((d, i) => i + 1).tickSize(0))
      .select('.domain').remove();

    // LBW bars
    svgBar.selectAll('.lbw-bar').data(data).enter()
      .append('rect').attr('class', 'lbw-bar')
      .attr('x', (d, i) => x(i)).attr('y', d => yLBW(d.LBW))
      .attr('width', x.bandwidth() / 2)
      .attr('height', d => H_BAR - M.bottom - yLBW(d.LBW))
      .attr('fill', d => d._place === 1 ? 'var(--accent-green)' : d._place <= 3 ? 'var(--accent-orange)' : 'var(--accent-red)')
      .attr('rx', 2).attr('opacity', 0.8);

    // Win Odds bars (secondary)
    const yOdds = d3.scaleLinear()
      .domain([0, d3.max(data, d => d['Win Odds']) || 30])
      .range([H_BAR - M.bottom, M.top]);

    svgBar.selectAll('.odds-bar').data(data).enter()
      .append('rect').attr('class', 'odds-bar')
      .attr('x', (d, i) => x(i) + x.bandwidth() / 2).attr('y', d => yOdds(d['Win Odds']))
      .attr('width', x.bandwidth() / 2)
      .attr('height', d => H_BAR - M.bottom - yOdds(d['Win Odds']))
      .attr('fill', 'var(--accent-purple)').attr('rx', 2).attr('opacity', 0.5);

    // Legend
    svgBar.append('text').attr('x', M.left + 4).attr('y', 10)
      .attr('fill', 'var(--accent-green)').style('font-size', '8px').text('■ LBW');
    svgBar.append('text').attr('x', M.left + 44).attr('y', 10)
      .attr('fill', 'var(--accent-purple)').style('font-size', '8px').text('■ Win Odds');
  }

  return { init };
})();
