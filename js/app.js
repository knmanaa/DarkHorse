// =============================================================================
// app.js — Main orchestrator: loads data, initializes all components
// =============================================================================
(function () {
  const { GlobalState, DataLoader, SidebarSelector, PerformanceGrid,
          RaceReplay, SpeedAnalytics, BreedingTree, SynergyMatrix,
          GearImpactAnalyzer } = window.DarkHorse;

  // ---- Trending Trends (inline component, rendered in #trending-trends) ----
  function initTrendingTrends(selector) {
    const container = d3.select(selector);
    container.html('');
    container.append('div').attr('class', 'panel-header').text('Trending Trends');
    container.append('div').attr('class', 'panel-body').attr('id', 'trends-body');

    GlobalState.on('allData', renderTrends);
    GlobalState.on('activeHorseID', renderTrends);
  }

  function renderTrends() {
    const body = d3.select('#trends-body');
    body.html('');
    const data = GlobalState.get('allData');
    if (!data.length) return;

    const grid = body.append('div').attr('class', 'trends-grid');

    // ---- Horse Winning Trends ----
    const horseSec = grid.append('div').attr('class', 'trend-section');
    horseSec.append('h4').text('Horse Winning Trends');

    // Compute recent win rate change per horse (last 5 vs. prev 5 races)
    const horseGroups = d3.group(data, d => d.HorseID);
    const horseTrends = [];
    horseGroups.forEach((recs, hid) => {
      if (recs.length < 6) return;
      const sorted = recs.slice().sort((a, b) => a._parsedDate - b._parsedDate);
      const recent = sorted.slice(-5);
      const prev = sorted.slice(-10, -5);
      if (prev.length < 3) return;
      const rWin = recent.filter(r => r._place === 1).length / recent.length;
      const pWin = prev.filter(r => r._place === 1).length / prev.length;
      const delta = rWin - pWin;
      horseTrends.push({ name: recs[0].Name, hid, delta });
    });
    horseTrends.sort((a, b) => b.delta - a.delta);

    // Show top improving + declining
    const topHorses = [...horseTrends.slice(0, 4), ...horseTrends.slice(-2)];
    topHorses.forEach(t => {
      const row = horseSec.append('div').attr('class', 'trend-row');
      row.append('span').attr('class', 'trend-name').text(t.name);
      const cls = t.delta >= 0 ? 'positive' : 'negative';
      row.append('span').attr('class', `trend-val ${cls}`)
        .text((t.delta >= 0 ? '+' : '') + (t.delta * 100).toFixed(1) + '%');
    });

    // ---- Jockey Hot Streaks ----
    const jockeySec = grid.append('div').attr('class', 'trend-section');
    jockeySec.append('h4').text('Jockey Hot Streaks');

    const jockeyGroups = d3.group(data, d => d.Jockey);
    const jockeyStreaks = [];
    jockeyGroups.forEach((recs, jockey) => {
      const sorted = recs.slice().sort((a, b) => b._parsedDate - a._parsedDate);
      // Find current win streak
      let streak = 0;
      for (const r of sorted) {
        if (r._place === 1) streak++;
        else break;
      }
      // Recent win rate for last 20
      const recent20 = sorted.slice(0, 20);
      const winRate = recent20.filter(r => r._place === 1).length / recent20.length;
      jockeyStreaks.push({ jockey, streak, winRate, total: recs.length });
    });
    jockeyStreaks.sort((a, b) => b.winRate - a.winRate);

    jockeyStreaks.slice(0, 6).forEach(j => {
      const row = jockeySec.append('div').attr('class', 'trend-row');
      row.append('span').attr('class', 'trend-name').text(j.jockey);
      row.append('span').attr('class', 'trend-val positive')
        .text((j.winRate * 100).toFixed(1) + '%');
    });

    // ---- Average FSpeed Rise/Fall Chart ----
    const chartSec = grid.append('div').attr('class', 'trend-section trend-chart-area');
    chartSec.append('h4').text('Average FSpeed Rise/Fall');

    const W = 320, H = 100, M = { top: 12, right: 10, bottom: 20, left: 36 };
    const svg = chartSec.append('svg')
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .style('width', '100%');

    // Group by date, compute avg FSpeed
    const dateGroups = d3.group(data, d => d.Date);
    const dateAvgs = [];
    dateGroups.forEach((recs, date) => {
      const avg = d3.mean(recs, r => r.FSpeed);
      if (avg) dateAvgs.push({ date: recs[0]._parsedDate, avg });
    });
    dateAvgs.sort((a, b) => a.date - b.date);

    if (dateAvgs.length < 2) return;

    const x = d3.scaleTime()
      .domain(d3.extent(dateAvgs, d => d.date))
      .range([M.left, W - M.right]);
    const y = d3.scaleLinear()
      .domain([d3.min(dateAvgs, d => d.avg) - 0.3, d3.max(dateAvgs, d => d.avg) + 0.3])
      .range([H - M.bottom, M.top]);

    svg.append('g').attr('class', 'speed-axis')
      .attr('transform', `translate(0,${H - M.bottom})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat('%b')).tickSize(3))
      .select('.domain').remove();

    svg.append('g').attr('class', 'speed-axis')
      .attr('transform', `translate(${M.left},0)`)
      .call(d3.axisLeft(y).ticks(3).tickSize(-W + M.left + M.right).tickFormat(d => d.toFixed(1)))
      .select('.domain').remove();
    svg.selectAll('.speed-axis .tick line').attr('stroke', '#21262d');

    const line = d3.line().x(d => x(d.date)).y(d => y(d.avg)).curve(d3.curveMonotoneX);
    svg.append('path').datum(dateAvgs)
      .attr('fill', 'none').attr('stroke', 'var(--accent-orange)').attr('stroke-width', 2)
      .attr('d', line);

    // Bars showing delta from mean
    const overallMean = d3.mean(dateAvgs, d => d.avg);
    const barW = Math.max(2, (W - M.left - M.right) / dateAvgs.length - 1);
    svg.selectAll('.fspeed-bar').data(dateAvgs).enter()
      .append('rect')
      .attr('x', d => x(d.date) - barW / 2)
      .attr('y', d => d.avg < overallMean ? y(d.avg) : y(overallMean))
      .attr('width', barW)
      .attr('height', d => Math.abs(y(d.avg) - y(overallMean)))
      .attr('fill', d => d.avg < overallMean ? 'var(--accent-green)' : 'var(--accent-red)')
      .attr('opacity', 0.4)
      .attr('rx', 1);
  }

  // ---- Application Boot ----
  function boot() {
    // Show loading state
    d3.select('#race-replay').html('<div class="loading-state"><div class="loading-spinner"></div>Loading race data…</div>');

    DataLoader.load('dataset/20242025HongKongHorseRacingRawData.csv')
      .then(data => {
        console.log(`[RaceAnalytics Pro] Loaded ${data.length} records, ${new Set(data.map(d => d.HorseID)).size} unique horses`);

        // Initialize all components FIRST (so they register event listeners)
        SidebarSelector.init('#sidebar-selector');
        SpeedAnalytics.init('#speed-analytics');
        PerformanceGrid.init('#performance-grid');
        RaceReplay.init('#race-replay');
        BreedingTree.init('#breeding-tree');
        SynergyMatrix.init('#synergy-matrix');
        GearImpactAnalyzer.init('#gear-impact');
        initTrendingTrends('#trending-trends');

        // THEN set global data (triggers all listeners)
        GlobalState.set('allData', data);

        // Auto-select first horse for demo
        const horses = GlobalState.getUniqueHorses();
        if (horses.length > 0) {
          GlobalState.set('activeHorseID', horses[0].HorseID);
          // Auto-select their most recent race
          const horseData = GlobalState.getHorseData(horses[0].HorseID);
          if (horseData.length > 0) {
            const lastRace = horseData[horseData.length - 1];
            GlobalState.set('activeRace', { Date: lastRace.Date, RaceIndex: lastRace.RaceIndex });
          }
        }
      })
      .catch(err => {
        console.error('[RaceAnalytics Pro] Failed to load data:', err);
        d3.select('#race-replay').html(`<div class="empty-state">Error loading data. Make sure to serve from an HTTP server.<br><code style="font-size:.75rem;color:var(--accent-red)">${err.message}</code></div>`);
      });
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
