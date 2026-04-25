// =============================================================================
// OddsCalibration.js — Odds vs. Actual Win Rate Calibration Curve
// Purpose: Evaluate betting value — where is the market wrong?
// =============================================================================
window.DarkHorse = window.DarkHorse || {};

window.DarkHorse.OddsCalibration = (function () {
  const State = () => window.DarkHorse.GlobalState;
  let container, svg, tooltip;

  const W = 520, H = 340;
  const M = { top: 44, right: 44, bottom: 72, left: 72 };

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
    container.append('div').attr('class', 'panel-header')
      .html('<span>Odds Calibration Curve</span>'
          + '<span style="font-size:.74rem;color:var(--text-muted)">Implied probability vs. actual win rate by odds range</span>');

    const body = container.append('div').attr('class', 'panel-body').style('padding', '10px 12px');

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

    // Instruction text
    body.append('div')
      .attr('class', 'oc-note')
      .html('Points <span style="color:var(--accent-green);font-weight:600">above</span> the diagonal → market <em>underestimates</em> these horses '
          + '(potential value bets). Points <span style="color:var(--accent-red);font-weight:600">below</span> → market <em>overestimates</em> '
          + '(over-backed favourites). Circle size reflects sample size. Hover for Kelly Criterion.');

    body.append('div')
      .attr('class', 'oc-note')
      .style('margin-top', '4px')
      .html('<strong style="color:var(--text-secondary)">Favourite–Longshot Bias:</strong> '
          + 'Favourites (low odds) tend to win more often than their odds imply; longshots are systematically over-backed by casual bettors.');

    tooltip = d3.select('body').selectAll('.d3-tooltip.oc-tt').data([0])
      .join('div').attr('class', 'd3-tooltip oc-tt').style('display', 'none');
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

      return { ...bin, n, wins, actualWinRate, impliedProb, ciLow, ciHigh, kelly };
    }).filter(b => b.n > 0);

    _draw(binStats);
  }

  // ---- Draw ---------------------------------------------------------------
  function _draw(binStats) {
    ['#oc-ci', '#oc-ref', '#oc-link', '#oc-dots', '#oc-axes', '#oc-labels']
      .forEach(id => svg.select(id).selectAll('*').remove());

    const ciG     = svg.select('#oc-ci');
    const refG    = svg.select('#oc-ref');
    const linkG   = svg.select('#oc-link');
    const dotsG   = svg.select('#oc-dots');
    const axesG   = svg.select('#oc-axes');
    const labelsG = svg.select('#oc-labels');

    // Fixed axis domain 0–0.7 so diagonal fills nicely
    const domMax = 0.70;
    const x = d3.scaleLinear().domain([0, domMax]).range([M.left, W - M.right]);
    const y = d3.scaleLinear().domain([0, domMax]).range([H - M.bottom, M.top]);

    // ---- Reference diagonal y = x (perfect calibration) ------------------
    refG.append('line')
      .attr('x1', x(0)).attr('y1', y(0))
      .attr('x2', x(domMax)).attr('y2', y(domMax))
      .attr('stroke', 'var(--text-muted)').attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '6 4').attr('opacity', 0.6);

    refG.append('text')
      .attr('x', x(0.44)).attr('y', y(0.47))
      .attr('text-anchor', 'middle')
      .attr('transform', `rotate(-45, ${x(0.44)}, ${y(0.47)})`)
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
      .call(g => g.selectAll('text').style('font-size', '10px').attr('fill', 'var(--text-secondary)'));

    axesG.append('g')
      .attr('transform', `translate(${M.left}, 0)`)
      .call(d3.axisLeft(y).ticks(7).tickFormat(d3.format('.0%'))
        .tickSize(-(W - M.left - M.right)))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').attr('stroke', gridLineColor).attr('opacity', 0.5))
      .call(g => g.selectAll('text').style('font-size', '10px').attr('fill', 'var(--text-secondary)'));

    // Axis labels
    axesG.append('text')
      .attr('x', (M.left + W - M.right) / 2).attr('y', H - 10)
      .attr('text-anchor', 'middle').style('font-size', '11px').attr('fill', 'var(--text-secondary)')
      .text('Implied Win Probability  (1 ÷ Odds)');

    axesG.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -(M.top + H - M.bottom) / 2).attr('y', 16)
      .attr('text-anchor', 'middle').style('font-size', '11px').attr('fill', 'var(--text-secondary)')
      .text('Actual Win Rate');

    // ---- Data points (circles sized by sample size) ----------------------
    const rScale = d3.scaleSqrt()
      .domain([0, d3.max(binStats, d => d.n) || 1])
      .range([6, 22]);

    const dotColor = d => {
      const diff = d.actualWinRate - d.impliedProb;
      if (Math.abs(diff) < 0.015) return 'var(--accent-blue)';
      return diff > 0 ? 'var(--accent-green)' : 'var(--accent-red)';
    };

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

    // ---- Legend ----------------------------------------------------------
    const legendItems = [
      { color: 'var(--accent-green)', label: 'Above diagonal — value bet' },
      { color: 'var(--accent-red)',   label: 'Below diagonal — over-backed' },
      { color: 'var(--accent-blue)',  label: 'Near diagonal — well calibrated' },
    ];
    legendItems.forEach((item, i) => {
      labelsG.append('circle')
        .attr('cx', M.left + 8).attr('cy', M.top - 26 + i * 14).attr('r', 5)
        .attr('fill', item.color);
      labelsG.append('text')
        .attr('x', M.left + 17).attr('y', M.top - 22 + i * 14)
        .style('font-size', '9px').attr('fill', 'var(--text-secondary)')
        .text(item.label);
    });
    labelsG.append('text')
      .attr('x', W - M.right - 4).attr('y', M.top - 22)
      .attr('text-anchor', 'end')
      .style('font-size', '9px').attr('fill', 'var(--text-muted)')
      .text('Circle size ∝ sample size');
  }

  return { init };
})();
