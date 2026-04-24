// =============================================================================
// RaceReplay.js — Interactive SVG race track replay with scrubber
// =============================================================================
window.DarkHorse = window.DarkHorse || {};

window.DarkHorse.RaceReplay = (function () {
  const State = () => window.DarkHorse.GlobalState;
  let container, svg, tooltip, raceData = [], animTimer = null, playing = false;
  const W = 680, H = 340, MARGIN = { top: 30, right: 30, bottom: 20, left: 30 };
  const COLORS = d3.schemeTableau10;

  function init(selector) {
    container = d3.select(selector);
    _render();
    State().on('activeRace', _onRaceChange);
    State().on('activeHorseID', _highlightHorse);
    State().on('hoveredHorseID', _highlightHover);
    State().on('replayTime', _onScrub);
  }

  function _render() {
    container.html('');

    // Header — just a title, no inner sub-tabs
    const header = container.append('div').attr('class', 'panel-header');
    header.append('span').text('Interactive Race Replay');

    // Scrubber controls — placed immediately below title so they're always visible
    const scrubber = container.append('div').attr('class', 'replay-scrubber');

    // Play/pause button
    scrubber.append('button').attr('class', 'scrub-btn').attr('id', 'btn-play')
      .html('<svg viewBox="0 0 16 16"><path d="M4 2l10 6-10 6z"/></svg>')
      .on('click', _togglePlay);
    // Step back
    scrubber.append('button').attr('class', 'scrub-btn')
      .html('<svg viewBox="0 0 16 16"><path d="M10 2L2 8l8 6z"/><rect x="12" y="2" width="2" height="12"/></svg>')
      .on('click', () => _stepTime(-0.05));
    // Step forward
    scrubber.append('button').attr('class', 'scrub-btn')
      .html('<svg viewBox="0 0 16 16"><path d="M6 2l8 6-8 6z"/><rect x="2" y="2" width="2" height="12"/></svg>')
      .on('click', () => _stepTime(0.05));

    // Slider
    scrubber.append('input')
      .attr('type', 'range').attr('class', 'scrub-slider')
      .attr('min', 0).attr('max', 1).attr('step', 0.005).attr('value', 0)
      .on('input', function () {
        State().set('replayTime', +this.value);
      });

    // Time display
    scrubber.append('span').attr('class', 'scrub-time').attr('id', 'scrub-time-display').text('0:00');

    // Race title
    container.append('div').attr('class', 'replay-title').attr('id', 'replay-race-title')
      .text('Select a race from the Performance Grid');

    // SVG
    svg = container.append('div').attr('class', 'panel-body').style('padding', '0')
      .append('svg')
      .attr('class', 'replay-svg')
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    _drawEmptyTrack();

    // Race conditions
    container.append('div').attr('class', 'race-conditions').attr('id', 'replay-conditions')
      .html(_condHtml('--', '--', '--', '--'));

    // Tooltip
    tooltip = d3.select('body').selectAll('.d3-tooltip.replay-tt').data([0])
      .join('div').attr('class', 'd3-tooltip replay-tt').style('display', 'none');
  }

  function _condHtml(g, track, course, dist) {
    return `<span class="cond-item"><span class="cond-label">G:</span><span class="cond-value">${g}</span></span>` +
      `<span class="cond-item"><span class="cond-label">Track:</span><span class="cond-value">${track}</span></span>` +
      `<span class="cond-item"><span class="cond-label">Course:</span><span class="cond-value">${course}</span></span>` +
      `<span class="cond-item"><span class="cond-label">Dist:</span><span class="cond-value">${dist}m</span></span>`;
  }

  // ---- Track Drawing ----
  function _buildTrackPath(dist) {
    // Create an oval track proportional to the real HK tracks
    const cx = W / 2, cy = H / 2 - 10;
    const rx = W / 2 - MARGIN.left - 70;
    const ry = H / 2 - MARGIN.top - 55;
    // Build path points for the oval (clockwise, starting from finish line on the right)
    const pts = [];
    const N = 200;
    for (let i = 0; i <= N; i++) {
      const angle = (2 * Math.PI * i) / N - Math.PI / 2; // start from top-right
      pts.push([cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)]);
    }
    return pts;
  }

  function _drawEmptyTrack() {
    svg.selectAll('*').remove();
    const pts = _buildTrackPath(1600);
    const line = d3.line().curve(d3.curveBasisClosed);

    // Track surface
    svg.append('path')
      .attr('class', 'track-surface')
      .attr('d', line(pts));

    // Inner and outer rails
    const cx = W / 2, cy = H / 2 - 10;
    const rx = W / 2 - MARGIN.left - 70;
    const ry = H / 2 - MARGIN.top - 55;

    svg.append('ellipse').attr('class', 'track-rail-outer')
      .attr('cx', cx).attr('cy', cy).attr('rx', rx + 16).attr('ry', ry + 16);
    svg.append('ellipse').attr('class', 'track-rail-inner')
      .attr('cx', cx).attr('cy', cy).attr('rx', rx - 16).attr('ry', ry - 16);

    // Track markers
    const markers = [
      { label: 'START', angle: -Math.PI / 2 },
      { label: 'BEND', angle: 0 },
      { label: 'HOME STRAIGHT', angle: Math.PI / 2 },
      { label: 'FINISH', angle: Math.PI },
    ];
    markers.forEach(m => {
      const x = cx + (rx + 28) * Math.cos(m.angle);
      const y = cy + (ry + 28) * Math.sin(m.angle);
      svg.append('text').attr('class', 'track-marker')
        .attr('x', x).attr('y', y).text(m.label);
    });

    // Finish line
    const fx = cx + rx * Math.cos(Math.PI);
    const fy = cy + ry * Math.sin(Math.PI);
    svg.append('line')
      .attr('x1', fx).attr('y1', fy - 18).attr('x2', fx).attr('y2', fy + 18)
      .attr('stroke', '#fff').attr('stroke-width', 2).attr('stroke-dasharray', '3 3');

    // Starting gates marker
    const sx = cx + rx * Math.cos(-Math.PI / 2);
    const sy = cy + ry * Math.sin(-Math.PI / 2);
    svg.append('text').attr('class', 'track-marker')
      .attr('x', sx).attr('y', sy - 10)
      .style('font-size', '10px').style('fill', 'var(--accent-green)')
      .text('STARTING GATES');

    // Horse dots group
    svg.append('g').attr('id', 'horse-dots-group');
  }

  // ---- Race Rendering ----
  function _onRaceChange() {
    const ar = State().get('activeRace');
    if (!ar) return;

    // Exclude withdrawn horses (WV: _runPos is all NaN or empty)
    raceData = State().getRaceData(ar.Date, ar.RaceIndex)
      .filter(h => h._runPos && h._runPos.length > 0 && h._runPos.some(p => !isNaN(p)));
    if (!raceData.length) return;

    const sample = raceData[0];
    const track = sample._track;

    const titleEl = container.select('#replay-race-title');
    titleEl.text(`${track.venue} — Race ${ar.RaceIndex}, ${sample['Dist.']}M ${track.surface} — ${sample.G} (${sample.RaceClass})`);

    // Hover tooltip explaining each component of the race title
    const Tips = window.DarkHorse.Tooltips;
    titleEl.on('mouseenter', function (event) {
      if (!Tips) return;
      Tips.tip(
        `<strong>Race ${ar.RaceIndex} — ${sample.Date}</strong><br>` +
        `<span style="color:var(--text-muted)">Venue:</span> ${track.venue === 'ST' ? 'Sha Tin' : track.venue === 'HV' ? 'Happy Valley' : track.venue}<br>` +
        `<span style="color:var(--text-muted)">Distance:</span> ${sample['Dist.']}m<br>` +
        `<span style="color:var(--text-muted)">Surface:</span> ${track.surface}<br>` +
        `<span style="color:var(--text-muted)">Course:</span> ${track.course}<br>` +
        `<span style="color:var(--text-muted)">Going:</span> ${sample.G}<br>` +
        `<span style="color:var(--text-muted)">Class:</span> ${sample.RaceClass}`,
        event
      );
    })
    .on('mousemove', function (event) {
      if (!Tips) return;
      const p = document.querySelector('.metric-tooltip-popup');
      if (p && p.style.display !== 'none') {
        const pad = 14;
        let x = event.clientX + pad, y = event.clientY + pad;
        const rect = p.getBoundingClientRect();
        if (x + rect.width > window.innerWidth - 8)  x = event.clientX - rect.width - pad;
        if (y + rect.height > window.innerHeight - 8) y = event.clientY - rect.height - pad;
        p.style.left = x + 'px'; p.style.top = y + 'px';
      }
    })
    .on('mouseleave', function () { if (Tips) Tips.hide(); });

    container.select('#replay-conditions')
      .html(_condHtml(sample.G, track.surface, track.course, sample['Dist.']));

    // Attach metric tooltips to each condition label
    if (Tips) {
      const labelNodes = container.select('#replay-conditions').selectAll('.cond-label').nodes();
      ['G', 'Track', 'Course', 'Dist.'].forEach((key, i) => {
        if (labelNodes[i]) Tips.attach(labelNodes[i], key);
      });
    }

    // Determine max checkpoints
    const maxCk = d3.max(raceData, d => d._runPos.length) || 4;

    // Reset time to 0 — horses start at the starting gates
    State().set('replayTime', 0);
    _drawHorses();
  }

  function _drawHorses() {
    const t = State().get('replayTime') || 0;
    const activeID = State().get('activeHorseID');

    const cx = W / 2, cy = H / 2 - 10;
    const rx = W / 2 - MARGIN.left - 70;
    const ry = H / 2 - MARGIN.top - 55;

    // Each horse gets a position around the track based on t and their running position
    const numRunners = raceData.length;
    const maxCk = d3.max(raceData, d => d._runPos.length) || 4;

    // For each horse, compute which checkpoint we're at
    const ckIdx = Math.min(Math.floor(t * maxCk), maxCk - 1);
    const ckFrac = (t * maxCk) - ckIdx;

    const group = svg.select('#horse-dots-group');

    const dots = group.selectAll('.horse-dot')
      .data(raceData, d => d.HorseID);

    dots.exit().remove();

    const enter = dots.enter().append('circle')
      .attr('class', 'horse-dot')
      .attr('r', 5)
      .on('mouseenter', (event, d) => {
        tooltip.style('display', null)
          .html(`<div class="tt-title">${d.Name} (${d.HorseID})</div>
                 <div class="tt-row"><span class="tt-label">Pos:</span><span>${d._runPos.join(' → ')}</span></div>
                 <div class="tt-row"><span class="tt-label">Finish:</span><span>${d['Finish Time'].toFixed(2)}s</span></div>
                 <div class="tt-row"><span class="tt-label">FSpeed:</span><span>${d.FSpeed.toFixed(2)}</span></div>`)
          .style('left', (event.pageX + 12) + 'px')
          .style('top', (event.pageY - 20) + 'px');
      })
      .on('mousemove', (event) => {
        tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 20) + 'px');
      })
      .on('mouseleave', () => tooltip.style('display', 'none'))
      .on('click', (event, d) => State().set('activeHorseID', d.HorseID));

    const merged = enter.merge(dots);

    merged.each(function (d, i) {
      // Position around the track based on running position
      const runPos = d._runPos;
      const pos = runPos.length > 0 ? (runPos[Math.min(ckIdx, runPos.length - 1)] || 1) : (i + 1);
      // Angle: spread around track, further back = further from finish
      // Finish is at angle PI (left side). Start is top.
      // Progress: t=0 -> start(-PI/2), t=1 -> finish(PI)
      const progressAngle = -Math.PI / 2 + t * 1.5 * Math.PI;
      // Offset by position (higher position number = further behind)
      const posOffset = (pos - 1) * 0.04; // spread out
      const angle = progressAngle - posOffset;

      // Slight radial offset to avoid overlap
      const rowOffset = (i % 3 - 1) * 6;
      const x = cx + (rx + rowOffset) * Math.cos(angle);
      const y = cy + (ry + rowOffset) * Math.sin(angle);

      d3.select(this)
        .attr('cx', x)
        .attr('cy', y)
        .attr('fill', COLORS[i % COLORS.length])
        .attr('r', d.HorseID === activeID ? 7 : 5)
        .attr('stroke', d.HorseID === activeID ? '#fff' : 'none')
        .attr('stroke-width', d.HorseID === activeID ? 2 : 0)
        .attr('opacity', activeID && d.HorseID !== activeID ? 0.5 : 1);
    });

    // No text labels on the track
    group.selectAll('.horse-label').remove();

    // Update time display
    if (raceData.length > 0) {
      const maxTime = d3.max(raceData, d => d['Finish Time']) || 120;
      const minTime = d3.min(raceData, d => d['Finish Time']) || 0;
      const currentTime = minTime + t * (maxTime - minTime) * 0.3; // rough estimate
      const totalSec = raceData[0]['Finish Time'] * t;
      const min = Math.floor(totalSec / 60);
      const sec = (totalSec % 60).toFixed(0).padStart(2, '0');
      container.select('#scrub-time-display').text(`${min}:${sec}`);
    }
  }

  function _highlightHorse() { if (raceData.length) _drawHorses(); }
  function _highlightHover() { /* could add temporary highlight */ }

  function _onScrub() {
    const t = State().get('replayTime');
    container.select('.scrub-slider').property('value', t);
    if (raceData.length) _drawHorses();
  }

  function _togglePlay() {
    playing = !playing;
    const btn = container.select('#btn-play');
    if (playing) {
      btn.html('<svg viewBox="0 0 16 16"><rect x="3" y="2" width="4" height="12"/><rect x="9" y="2" width="4" height="12"/></svg>');
      _animate();
    } else {
      btn.html('<svg viewBox="0 0 16 16"><path d="M4 2l10 6-10 6z"/></svg>');
      if (animTimer) animTimer.stop();
    }
  }

  function _animate() {
    let t = State().get('replayTime') || 0;
    if (t >= 1) t = 0;
    animTimer = d3.timer((elapsed) => {
      t = Math.min(t + 0.003, 1);
      State().set('replayTime', t);
      if (t >= 1) { animTimer.stop(); playing = false;
        container.select('#btn-play').html('<svg viewBox="0 0 16 16"><path d="M4 2l10 6-10 6z"/></svg>');
      }
    });
  }

  function _stepTime(delta) {
    const t = Math.max(0, Math.min(1, (State().get('replayTime') || 0) + delta));
    State().set('replayTime', t);
  }

  return { init };
})();
