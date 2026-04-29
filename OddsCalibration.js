// =============================================================================
// OddsCalibration.js — Odds vs. Actual Win Rate Calibration Curve
// Purpose: Evaluate betting value — where is the market wrong?
// =============================================================================
window.DarkHorse = window.DarkHorse || {};

window.DarkHorse.OddsCalibration = (function () {
  const State = () => window.DarkHorse.GlobalState;
  let container, svg, tooltip, insightEl;
  let viewMode = 'bars';

  const W = 460, H = 330;
  const M = { top: 34, right: 30, bottom: 64, left: 68 };

  // Odds bins: [low, high) — representative mid-odds for implied prob
  const BINS = [
    { low: 1,  high: 2,        label: '1–2',   mid: 1.5  },
    { low: 2,  high: 5,        label: '2–5',   mid: 3.0  },
    { low: 5,  high: 10,       label: '5–10',  mid: 7.0  },
    { low: 10, high: 20,       label: '10–20', mid: 14.0 },
    { low: 20, high: Infinity, label: '20+',   mid: 30.0 },
  ];

  function init(selector) {
    container = d3.select(selector);
    _render();
    State().on('allData', _update);
  }

  // ---- Shell --------------------------------------------------------------
  function _render() {
    container.html('');
    const header = container.append('div').attr('class', 'panel-header');
    header.html('<span>Market Bias by Odds Bucket <span class="chart-info-icon" id="oc-info-icon">i</span></span>');

    const body = container.append('div').attr('class', 'panel-body').style('padding', '10px 12px');
    const controls = body.append('div').attr('class', 'chart-switch');
    controls.append('button').attr('class', 'chart-switch-btn active').attr('id', 'oc-view-bars').text('Bias bars')
      .on('click', () => { viewMode = 'bars'; _updateSwitchUI(); _update(); });
    controls.append('button').attr('class', 'chart-switch-btn').attr('id', 'oc-view-scatter').text('View as scatter')
      .on('click', () => { viewMode = 'scatter'; _updateSwitchUI(); _update(); });

    insightEl = body.append('div').attr('class', 'chart-headline').text('Loading market bias insight...');

    svg = body.append('svg')
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .style('width', '100%').style('height', 'auto').style('overflow', 'visible');

    // Layer groups
    svg.append('g').attr('id', 'oc-ci');
    svg.append('g').attr('id', 'oc-ref');
    svg.append('g').attr('id', 'oc-link');
    svg.append('g').attr('id', 'oc-dots');
    svg.append('g').attr('id', 'oc-axes');
    svg.append('g').attr('id', 'oc-labels');

    body.append('div')
      .attr('class', 'oc-note')
      .html('Tip: hover a bar/dot for details. Cyan accents mark interactivity; red/green only indicate market bias direction.');

    tooltip = d3.select('body').selectAll('.d3-tooltip.oc-tt').data([0])
      .join('div').attr('class', 'd3-tooltip oc-tt').style('display', 'none');

    body.select('#oc-info-icon')
      .on('mouseenter', event => {
        tooltip.style('display', null)
          .html('<div class="tt-title">How to read this</div><div class="tt-row">Bias bars: right/green = value zone, left/red = trap zone based on Edge % (Actual − Implied).</div><div class="tt-row">Use "View as scatter" for detailed calibration diagnostics and confidence context.</div>')
          .style('left', (event.pageX + 12) + 'px')
          .style('top', (event.pageY - 26) + 'px');
      })
      .on('mousemove', event => {
        tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 26) + 'px');
      })
      .on('mouseleave', () => tooltip.style('display', 'none'));
  }

  // ---- Data update ---------------------------------------------------------
  function _update() {
    const data = State().get('allData');
    if (!data || !data.length) return;

    // Only include records with valid odds and a real finishing place
    const valid = data.filter(d => +d['Win Odds'] > 0 && d._place && d._place < 99);

    const binStats = BINS.map(bin => {
      const recs = valid.filter(d => {
        const o = +d['Win Odds'];
        return o >= bin.low && o < bin.high;
      });
      const n = recs.length;
      const wins = recs.filter(r => r._place === 1).length;
      const actualWinRate = n > 0 ? wins / n : 0;
      const impliedProb   = 1 / bin.mid;

      // Wilson 95% confidence interval for binomial proportion
      const z = 1.96;
      const p = actualWinRate;
      const denom = 1 + z * z / n;
      const center = n > 0 ? (p + z * z / (2 * n)) / denom : 0;
      const halfW  = n > 0 ? (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / denom : 0;
      const ciLow  = Math.max(0, center - halfW);
      const ciHigh = Math.min(1, center + halfW);

      // Kelly Criterion fraction: f* = (b·p − q) / b, b = decimal odds − 1
      const b = bin.mid - 1;
      const kelly = b > 0 ? ((b * actualWinRate - (1 - actualWinRate)) / b) : 0;

      const edge = actualWinRate - impliedProb;
      return { ...bin, n, wins, actualWinRate, impliedProb, ciLow, ciHigh, kelly, edge };
    }).filter(b => b.n > 0);

    _draw(binStats);
  }

  // ---- Draw ---------------------------------------------------------------
  function _draw(binStats) {
    ['#oc-ci', '#oc-ref', '#oc-link', '#oc-dots', '#oc-axes', '#oc-labels'].forEach(id => svg.select(id).selectAll('*').remove());
    if (!binStats.length) return;

    const biggest = binStats.slice().sort((a, b) => Math.abs(b.edge) - Math.abs(a.edge))[0];
    if (insightEl && biggest) {
      const direction = biggest.edge < 0 ? 'over-backed' : 'undervalued';
      insightEl.text(`${biggest.label}× runners are ${direction} by ${(Math.abs(biggest.edge) * 100).toFixed(1)}% — biggest market inefficiency.`);
    }

    const ciG     = svg.select('#oc-ci');
    const refG    = svg.select('#oc-ref');
    const linkG   = svg.select('#oc-link');
    const dotsG   = svg.select('#oc-dots');
    const axesG   = svg.select('#oc-axes');
    const labelsG = svg.select('#oc-labels');

    if (viewMode === 'bars') {
      _drawBiasBars(binStats, { ciG, refG, linkG, dotsG, axesG, labelsG });
      return;
    }

    const xMax = Math.min(0.8, Math.max(0.25, d3.max(binStats, d => d.impliedProb) * 1.1 || 0.7));
    const yMax = Math.min(0.8, Math.max(0.25, d3.max(binStats, d => d.actualWinRate) * 1.1 || 0.7));
    const domMax = Math.max(xMax, yMax);
    const x = d3.scaleLinear().domain([0, domMax]).range([M.left, W - M.right]);
    const y = d3.scaleLinear().domain([0, domMax]).range([H - M.bottom, M.top]);

    // ---- Reference diagonal y = x (perfect calibration) ------------------
    refG.append('line')
      .attr('x1', x(0)).attr('y1', y(0))
      .attr('x2', x(domMax)).attr('y2', y(domMax))
      .attr('stroke', 'var(--text-muted)').attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '6 4').attr('opacity', 0.6);

    refG.append('text')
      .attr('x', x(domMax) - 4).attr('y', y(domMax) - 6)
      .attr('text-anchor', 'end')
      .style('font-size', '9px').attr('fill', 'var(--text-muted)')
      .text('Perfect calibration (y = x)');

    // ---- Confidence interval band ----------------------------------------
    if (binStats.length >= 2) {
      const sorted = binStats.slice().sort((a, b) => a.impliedProb - b.impliedProb);
      ciG.append('path')
        .datum(sorted)
        .attr('d', d3.area()
          .x(d => x(d.impliedProb))
          .y0(d => y(d.ciLow))
          .y1(d => y(d.ciHigh))
          .curve(d3.curveMonotoneX))
        .attr('fill', 'var(--accent-blue)').attr('opacity', 0.12);
    }

    // ---- Link line through actual-win-rate points ------------------------
    if (binStats.length >= 2) {
      const sorted = binStats.slice().sort((a, b) => a.impliedProb - b.impliedProb);
      linkG.append('path')
        .datum(sorted)
        .attr('d', d3.line()
          .x(d => x(d.impliedProb))
          .y(d => y(d.actualWinRate))
          .curve(d3.curveMonotoneX))
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-blue)').attr('stroke-width', 1.8).attr('opacity', 0.6);
    }

    // ---- Axes ------------------------------------------------------------
    const gridLineColor = '#21262d';
    axesG.append('g')
      .attr('transform', `translate(0, ${H - M.bottom})`)
      .call(d3.axisBottom(x).ticks(7).tickFormat(d3.format('.0%'))
        .tickSize(-(H - M.top - M.bottom)))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').attr('stroke', gridLineColor).attr('opacity', 0.5))
      .call(g => g.selectAll('text').style('font-size', '9px').attr('fill', 'var(--text-secondary)'));

    axesG.append('g')
      .attr('transform', `translate(${M.left}, 0)`)
      .call(d3.axisLeft(y).ticks(7).tickFormat(d3.format('.0%'))
        .tickSize(-(W - M.left - M.right)))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').attr('stroke', gridLineColor).attr('opacity', 0.5))
      .call(g => g.selectAll('text').style('font-size', '9px').attr('fill', 'var(--text-secondary)'));

    // Axis labels
    axesG.append('text')
      .attr('x', (M.left + W - M.right) / 2).attr('y', H - 10)
      .attr('text-anchor', 'middle').style('font-size', '10px').attr('fill', 'var(--text-secondary)')
      .text('Implied Win Probability  (1 ÷ Odds)');

    axesG.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -(M.top + H - M.bottom) / 2).attr('y', 16)
      .attr('text-anchor', 'middle').style('font-size', '10px').attr('fill', 'var(--text-secondary)')
      .text('Actual Win Rate');

    // ---- Data points (circles sized by sample size) ----------------------
    const rScale = d3.scaleSqrt()
      .domain([0, d3.max(binStats, d => d.n) || 1])
      .range([5, 11]);

    const dotColor = d => Math.abs(d.edge) < 0.015 ? 'var(--accent-blue)' : (d.edge > 0 ? 'var(--accent-green)' : 'var(--accent-red)');

    dotsG.selectAll('.oc-dot').data(binStats).enter()
      .append('circle').attr('class', 'oc-dot')
      .attr('cx', d => x(d.impliedProb))
      .attr('cy', d => y(d.actualWinRate))
      .attr('r',  d => rScale(d.n))
      .attr('fill', dotColor)
      .attr('stroke', 'var(--bg-primary)').attr('stroke-width', 2)
      .attr('opacity', 0.88)
      .style('cursor', 'pointer')
      .on('mouseenter', function (event, d) {
        d3.select(this).attr('opacity', 1).attr('stroke', 'var(--text-primary)');
        const kellyPct = (d.kelly * 100).toFixed(1);
        const direction = d.actualWinRate > d.impliedProb
          ? `<span style="color:var(--accent-green)">↑ Market underestimates — potential value</span>`
          : `<span style="color:var(--accent-red)">↓ Market overestimates — avoid</span>`;
        tooltip.style('display', null)
          .html(`<div class="tt-title">Odds Range: ${d.label}×</div>
                 <div class="tt-row"><span class="tt-label">Observations:</span><span>${d.n} (${d.wins} wins)</span></div>
                 <div class="tt-row"><span class="tt-label">Implied prob.:</span><span>${(d.impliedProb*100).toFixed(1)}%</span></div>
                 <div class="tt-row"><span class="tt-label">Actual win rate:</span><span>${(d.actualWinRate*100).toFixed(1)}%</span></div>
                 <div class="tt-row"><span class="tt-label">95% CI:</span><span>[${(d.ciLow*100).toFixed(1)}%, ${(d.ciHigh*100).toFixed(1)}%]</span></div>
                 <div class="tt-row"><span class="tt-label">Kelly criterion:</span><span>${d.kelly > 0 ? kellyPct + '% of bankroll' : 'No bet (negative edge)'}</span></div>
                 <div class="tt-row" style="margin-top:4px">${direction}</div>`)
          .style('left', (event.pageX + 14) + 'px').style('top', (event.pageY - 28) + 'px');
      })
      .on('mousemove', event => {
        tooltip.style('left', (event.pageX + 14) + 'px').style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseleave', function () {
        d3.select(this).attr('opacity', 0.88).attr('stroke', 'var(--bg-primary)');
        tooltip.style('display', 'none');
      });

    // Bin labels above each dot
    labelsG.selectAll('.oc-lbl').data(binStats).enter()
      .append('text').attr('class', 'oc-lbl')
      .attr('x', d => x(d.impliedProb))
      .attr('y', d => y(d.actualWinRate) - rScale(d.n) - 5)
      .attr('text-anchor', 'middle')
      .style('font-size', '9px').attr('fill', dotColor)
      .style('font-weight', '600')
      .text(d => `${d.label}×`);

    // ---- Legend at top-left to avoid axis/title overlap -----------------
    const legendItems = [
      { color: 'var(--accent-green)', label: 'Above diagonal — value bet' },
      { color: 'var(--accent-red)',   label: 'Below diagonal — over-backed' },
      { color: 'var(--accent-blue)',  label: 'Near diagonal — well calibrated' },
    ];
    legendItems.forEach((item, i) => {
      labelsG.append('circle')
        .attr('cx', M.left + 6).attr('cy', M.top + 8 + i * 11).attr('r', 3.5)
        .attr('fill', item.color);
      labelsG.append('text')
        .attr('x', M.left + 13).attr('y', M.top + 11 + i * 11)
        .style('font-size', '8px').attr('fill', 'var(--text-secondary)')
        .text(item.label);
    });
    labelsG.append('text')
      .attr('x', W - M.right - 4).attr('y', M.top - 22)
      .attr('text-anchor', 'end')
      .style('font-size', '9px').attr('fill', 'var(--text-muted)')
      .text('Circle size ∝ sample size');
  }

  function _drawBiasBars(binStats, layers) {
    const { axesG, dotsG, labelsG, refG } = layers;
    const maxAbs = Math.max(0.05, d3.max(binStats, d => Math.abs(d.edge)) || 0.05);
    const domMax = Math.min(0.3, maxAbs * 1.25);
    const x = d3.scaleLinear().domain([-domMax, domMax]).range([M.left, W - M.right]);
    const y = d3.scaleBand().domain(binStats.map(d => `${d.label}×`)).range([M.top + 6, H - M.bottom - 10]).padding(0.26);
    const barH = y.bandwidth();
    const nMax = d3.max(binStats, d => d.n) || 1;

    refG.append('line')
      .attr('x1', x(0)).attr('x2', x(0)).attr('y1', M.top).attr('y2', H - M.bottom)
      .attr('stroke', 'var(--text-muted)').attr('stroke-width', 1.2).attr('stroke-dasharray', '4 4').attr('opacity', 0.8);

    axesG.append('g')
      .attr('transform', `translate(0,${H - M.bottom})`)
      .call(d3.axisBottom(x).ticks(7).tickFormat(d => `${d > 0 ? '+' : ''}${(d * 100).toFixed(0)}%`))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').attr('stroke', '#21262d').attr('opacity', 0.6))
      .call(g => g.selectAll('text').style('font-size', '9px').attr('fill', 'var(--text-secondary)'));

    axesG.append('g')
      .attr('transform', `translate(${M.left},0)`)
      .call(d3.axisLeft(y))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').remove())
      .call(g => g.selectAll('text').style('font-size', '10px').attr('fill', 'var(--text-secondary)'));

    axesG.append('text')
      .attr('x', (M.left + W - M.right) / 2).attr('y', H - 12)
      .attr('text-anchor', 'middle').style('font-size', '10px').attr('fill', 'var(--text-secondary)')
      .text('Edge % = Actual Win Rate − Implied Probability');

    dotsG.selectAll('.oc-bar').data(binStats).enter().append('rect')
      .attr('class', 'oc-bar')
      .attr('x', d => x(Math.min(0, d.edge)))
      .attr('y', d => y(`${d.label}×`))
      .attr('width', d => Math.max(2, Math.abs(x(d.edge) - x(0))))
      .attr('height', barH)
      .attr('fill', d => d.edge >= 0 ? 'var(--accent-green)' : 'var(--accent-red)')
      .attr('opacity', d => 0.35 + 0.55 * (d.n / nMax))
      .style('cursor', 'pointer')
      .on('mouseenter', function (event, d) {
        d3.select(this).attr('opacity', 1);
        tooltip.style('display', null)
          .html(`<div class="tt-title">${d.label}× bucket</div>
                 <div class="tt-row"><span class="tt-label">Edge:</span><span>${d.edge >= 0 ? '+' : ''}${(d.edge * 100).toFixed(1)}%</span></div>
                 <div class="tt-row"><span class="tt-label">Implied:</span><span>${(d.impliedProb * 100).toFixed(1)}%</span></div>
                 <div class="tt-row"><span class="tt-label">Actual:</span><span>${(d.actualWinRate * 100).toFixed(1)}%</span></div>
                 <div class="tt-row"><span class="tt-label">Sample:</span><span>n=${d.n}</span></div>`)
          .style('left', (event.pageX + 14) + 'px').style('top', (event.pageY - 28) + 'px');
      })
      .on('mousemove', event => tooltip.style('left', (event.pageX + 14) + 'px').style('top', (event.pageY - 28) + 'px'))
      .on('mouseleave', function (event, d) {
        d3.select(this).attr('opacity', 0.35 + 0.55 * (d.n / nMax));
        tooltip.style('display', 'none');
      });

    labelsG.selectAll('.oc-bar-n').data(binStats).enter().append('text')
      .attr('class', 'oc-bar-n')
      .attr('x', d => d.edge >= 0 ? x(d.edge) + 4 : x(d.edge) - 4)
      .attr('y', d => (y(`${d.label}×`) || 0) + barH / 2 + 3)
      .attr('text-anchor', d => d.edge >= 0 ? 'start' : 'end')
      .attr('fill', 'var(--text-secondary)')
      .style('font-size', '9px')
      .text(d => `n=${d.n}`);

    labelsG.append('text').attr('x', x(0) + 5).attr('y', M.top + 10).attr('fill', 'var(--accent-green)').style('font-size', '9px').text('Value zone');
    labelsG.append('text').attr('x', x(0) - 5).attr('y', M.top + 10).attr('text-anchor', 'end').attr('fill', 'var(--accent-red)').style('font-size', '9px').text('Trap zone');
  }

  function _updateSwitchUI() {
    container.select('#oc-view-bars').classed('active', viewMode === 'bars');
    container.select('#oc-view-scatter').classed('active', viewMode === 'scatter');
  }

  return { init };
})();
