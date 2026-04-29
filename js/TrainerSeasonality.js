// =============================================================================
// TrainerSeasonality.js — Stream graph of monthly trainer win peaks
// =============================================================================
window.DarkHorse = window.DarkHorse || {};

window.DarkHorse.TrainerSeasonality = (function () {
  const State = () => window.DarkHorse.GlobalState;
  let container, svg, tooltip;

  const W = 760, H = 390;
  const M = { top: 44, right: 20, bottom: 92, left: 56 };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function init(selector) {
    container = d3.select(selector);
    _render();
    State().on('allData', _update);
  }

  function _render() {
    container.html('');
    container.append('div').attr('class', 'panel-header')
      .html('<span>Trainer Seasonality Stream</span>'
        + '<span style="font-size:.74rem;color:var(--text-muted)">Top trainers monthly win flow</span>');

    const body = container.append('div').attr('class', 'panel-body').style('padding', '10px 12px');
    svg = body.append('svg')
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .style('width', '100%')
      .style('height', 'auto')
      .style('overflow', 'visible');

    body.append('div').attr('class', 'oc-note')
      .html('Stream width = monthly wins. This view highlights when each top trainer peaks during the season.');

    tooltip = d3.select('body').selectAll('.d3-tooltip.ts-tt').data([0])
      .join('div').attr('class', 'd3-tooltip ts-tt').style('display', 'none');
  }

  function _update() {
    const data = State().get('allData');
    if (!data || !data.length) return;

    const winners = data.filter(d => d._place === 1 && d.Trainer);
    if (!winners.length) return;

    const topTrainers = d3.rollups(
      winners,
      rows => rows.length,
      d => d.Trainer
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([trainer]) => trainer);

    const topSet = new Set(topTrainers);
    const monthTrainerWins = d3.rollup(
      winners.filter(d => topSet.has(d.Trainer)),
      rows => rows.length,
      d => {
        const dt = d._parsedDate;
        if (!dt) return 'unknown';
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      },
      d => d.Trainer
    );

    const monthKeys = Array.from(monthTrainerWins.keys())
      .filter(k => k !== 'unknown')
      .sort();
    if (!monthKeys.length) return;

    const monthMeta = monthKeys.map(key => {
      const [yearStr, monthStr] = key.split('-');
      const month = (+monthStr) - 1;
      const year = +yearStr;
      return {
        key,
        month,
        year,
        label: `${MONTHS[month]} ${year}`
      };
    });

    const monthlyRows = monthMeta.map(meta => {
      const row = { key: meta.key, month: meta.month, year: meta.year };
      topTrainers.forEach(trainer => {
        row[trainer] = monthTrainerWins.get(meta.key)?.get(trainer) || 0;
      });
      return row;
    });

    _draw(monthlyRows, topTrainers, monthMeta);
  }

  function _draw(monthlyRows, trainers, monthMeta) {
    svg.selectAll('*').remove();

    const x = d3.scalePoint()
      .domain(d3.range(monthMeta.length))
      .range([M.left, W - M.right])
      .padding(0.3);

    const stack = d3.stack()
      .keys(trainers)
      .offset(d3.stackOffsetSilhouette)
      .order(d3.stackOrderInsideOut);

    const series = stack(monthlyRows);
    const yMin = d3.min(series, s => d3.min(s, d => d[0])) || 0;
    const yMax = d3.max(series, s => d3.max(s, d => d[1])) || 1;

    const y = d3.scaleLinear()
      .domain([yMin, yMax])
      .range([H - M.bottom, M.top]);

    const color = d3.scaleOrdinal()
      .domain(trainers)
      .range(d3.schemeTableau10);

    // grid
    svg.append('g')
      .attr('transform', `translate(${M.left},0)`)
      .call(d3.axisLeft(y).ticks(5).tickSize(-(W - M.left - M.right)).tickFormat(() => ''))
      .call(g => g.selectAll('.tick line').attr('stroke', '#21262d').attr('opacity', 0.5))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('text').remove());

    const area = d3.area()
      .x((d, i) => x(i))
      .y0(d => y(d[0]))
      .y1(d => y(d[1]))
      .curve(d3.curveCatmullRom.alpha(0.5));

    svg.append('g')
      .selectAll('.ts-stream')
      .data(series)
      .enter()
      .append('path')
      .attr('class', 'ts-stream')
      .attr('d', area)
      .attr('fill', d => color(d.key))
      .attr('opacity', 0.86)
      .attr('stroke', '#0d1117')
      .attr('stroke-width', 0.8)
      .on('mouseenter', function (event, d) {
        d3.select(this).attr('opacity', 1).attr('stroke-width', 1.4);
        tooltip.style('display', null)
          .html(`<div class="tt-title">${d.key}</div><div class="tt-row">Hover across months to inspect peaks</div>`)
          .style('left', (event.pageX + 14) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mousemove', function (event, d) {
        const [mx] = d3.pointer(event, svg.node());
        const nearestMonth = d3.least(d3.range(monthMeta.length), m => Math.abs((x(m) || 0) - mx));
        const value = monthlyRows[nearestMonth][d.key] || 0;
        tooltip.style('display', null)
          .html(
            `<div class="tt-title">${d.key}</div>
             <div class="tt-row"><span class="tt-label">Month:</span><span>${monthMeta[nearestMonth].label}</span></div>
             <div class="tt-row"><span class="tt-label">Wins:</span><span>${value}</span></div>`
          )
          .style('left', (event.pageX + 14) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseleave', function () {
        d3.select(this).attr('opacity', 0.86).attr('stroke-width', 0.8);
        tooltip.style('display', 'none');
      });

    svg.append('text')
      .attr('x', W / 2)
      .attr('y', 19)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--accent-blue)')
      .style('font-size', '13px')
      .style('font-weight', '700')
      .text('Top 10 trainers by wins across months');

    svg.append('text')
      .attr('x', W / 2)
      .attr('y', 33)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--text-secondary)')
      .style('font-size', '10px')
      .text('Stream thickness indicates monthly win count');

    // axes
    svg.append('g')
      .attr('transform', `translate(0,${H - M.bottom})`)
      .call(d3.axisBottom(x).tickFormat(d => {
        const m = monthMeta[d];
        if (!m) return '';
        return m.label;
      }))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').remove())
      .call(g => g.selectAll('text')
        .attr('fill', 'var(--text-secondary)')
        .style('font-size', '9px')
        .attr('transform', 'rotate(-32)')
        .style('text-anchor', 'end')
        .attr('dx', '-4')
        .attr('dy', '4'));

    svg.append('text')
      .attr('x', (M.left + W - M.right) / 2)
      .attr('y', H - 46)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--text-secondary)')
      .style('font-size', '11px')
      .text('Month and Year');

    const augustIndices = monthMeta
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => m.month === 7)
      .map(({ i }) => i);

    augustIndices.forEach(idx => {
      const center = x(idx) || 0;
      const prev = x(Math.max(0, idx - 1)) || (center - 20);
      const next = x(Math.min(monthMeta.length - 1, idx + 1)) || (center + 20);
      const start = idx === 0 ? center - (next - center) / 2 : (prev + center) / 2;
      const end = idx === monthMeta.length - 1 ? center + (center - prev) / 2 : (center + next) / 2;

      svg.append('rect')
        .attr('x', start)
        .attr('y', M.top)
        .attr('width', Math.max(end - start, 14))
        .attr('height', H - M.top - M.bottom)
        .attr('fill', 'var(--accent-orange)')
        .attr('opacity', 0.12)
        .attr('rx', 4)
        .style('cursor', 'help')
        .on('mouseenter', function (event) {
          d3.select(this).attr('opacity', 0.2);
          tooltip.style('display', null)
            .html(
              `<div class="tt-title">August off-season</div>
               <div class="tt-row">No races were held in August.</div>`
            )
            .style('left', (event.pageX + 14) + 'px')
            .style('top', (event.pageY - 28) + 'px');
        })
        .on('mousemove', function (event) {
          tooltip.style('display', null)
            .style('left', (event.pageX + 14) + 'px')
            .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseleave', function () {
          d3.select(this).attr('opacity', 0.12);
          tooltip.style('display', 'none');
        });

      svg.append('line')
        .attr('x1', center)
        .attr('x2', center)
        .attr('y1', M.top)
        .attr('y2', H - M.bottom)
        .attr('stroke', 'var(--accent-orange)')
        .attr('stroke-opacity', 0.55)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '3,3');
    });

    // compact legend
    const legend = svg.append('g').attr('transform', `translate(${M.left}, ${H - 28})`);
    trainers.slice(0, 10).forEach((name, i) => {
      const row = Math.floor(i / 5);
      const col = i % 5;
      const g = legend.append('g').attr('transform', `translate(${col * 136}, ${row * 16})`);
      g.append('circle').attr('r', 4).attr('cx', 0).attr('cy', 0).attr('fill', color(name));
      g.append('text')
        .attr('x', 8)
        .attr('y', 3)
        .attr('fill', 'var(--text-muted)')
        .style('font-size', '9px')
        .text(name.length > 16 ? name.slice(0, 16) + '…' : name);
    });
  }

  return { init };
})();
