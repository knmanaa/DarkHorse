// =============================================================================
// SidebarSelector.js — Horse list, search, profile card with gear & form
// =============================================================================
window.DarkHorse = window.DarkHorse || {};

window.DarkHorse.SidebarSelector = (function () {
  const State = () => window.DarkHorse.GlobalState;
  const Loader = () => window.DarkHorse.DataLoader;
  let container;

  function init(selector) {
    container = d3.select(selector);
    _render();
    State().on('allData', () => _renderList());
    State().on('activeHorseID', () => { _highlightActive(); _renderProfile(); });
    State().on('sidebarFilter', () => _renderList());
    State().on('hoveredHorseID', () => _highlightHovered());
  }

  function _render() {
    container.html('');
    // Header
    container.append('div').attr('class', 'panel-header')
      .html('<span>Horse Performance</span><div class="header-actions"><span style="cursor:pointer;color:var(--text-muted)">&#9881;</span></div>');

    // Search
    const search = container.append('div').attr('class', 'sidebar-search');
    search.append('svg').attr('viewBox', '0 0 16 16').attr('width', 14).attr('height', 14)
      .append('path').attr('fill', '#8b949e')
      .attr('d', 'M11.5 7a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0zm-.82 4.74a6 6 0 1 1 1.06-1.06l3.04 3.04a.75.75 0 1 1-1.06 1.06l-3.04-3.04z');
    search.append('input')
      .attr('type', 'text')
      .attr('placeholder', 'Search horses...')
      .attr('id', 'sidebar-horse-search')
      .on('input', function () {
        State().set('sidebarFilter', this.value.toLowerCase());
      });

    // Horse List
    container.append('div').attr('class', 'horse-list').attr('id', 'horse-list-container');

    // Profile area
    container.append('div').attr('class', 'horse-profile').attr('id', 'horse-profile-area')
      .style('display', 'none');
  }

  function _renderList() {
    const horses = State().getUniqueHorses();
    const filter = State().get('sidebarFilter') || '';
    const filtered = filter
      ? horses.filter(h => h.Name.toLowerCase().includes(filter) || h.HorseID.toLowerCase().includes(filter))
      : horses.slice(0, 100); // show first 100 by default

    const listEl = container.select('#horse-list-container');
    const rows = listEl.selectAll('div.horse-row')
      .data(filtered, d => d.HorseID);

    rows.exit().remove();

    const enter = rows.enter()
      .append('div')
      .attr('class', 'horse-row')
      .on('click', (event, d) => {
        State().set('activeHorseID', d.HorseID);
      })
      .on('mouseenter', (event, d) => {
        State().set('hoveredHorseID', d.HorseID);
      })
      .on('mouseleave', () => {
        State().set('hoveredHorseID', null);
      });

    enter.append('span').attr('class', 'horse-id');
    enter.append('span').attr('class', 'horse-name');
    enter.append('span').attr('class', 'horse-meta');
    enter.append('span').attr('class', 'horse-chevron').html('&#9656;');

    const merged = enter.merge(rows);
    merged.select('.horse-id').text(d => d.HorseID);
    merged.select('.horse-name').text(d => d.Name);
    merged.select('.horse-meta').text(d => `Rtg ${d.Rtg}`);
    merged.classed('active', d => d.HorseID === State().get('activeHorseID'));
  }

  function _highlightActive() {
    const aid = State().get('activeHorseID');
    container.selectAll('.horse-row').classed('active', d => d.HorseID === aid);
  }

  function _highlightHovered() {
    // Hovered horse styling handled via RaceReplay
  }

  function _renderProfile() {
    const hid = State().get('activeHorseID');
    const profileEl = container.select('#horse-profile-area');
    if (!hid) { profileEl.style('display', 'none'); return; }

    const records = State().getHorseData(hid);
    if (!records.length) { profileEl.style('display', 'none'); return; }

    const stats = Loader().computeHorseStats(records);
    const latest = records[records.length - 1];
    const gearList = Loader().parseGearString(latest.Gear);

    profileEl.style('display', null).html('');

    // Header row
    const header = profileEl.append('div').attr('class', 'horse-profile-header');
    header.append('div').attr('class', 'horse-avatar').text(latest.Name.charAt(0));
    const info = header.append('div').attr('class', 'horse-profile-info');
    info.append('h3').text(latest.Name);
    info.append('div').attr('class', 'meta-line')
      .text(`${latest.HorseID} | Rtg ${latest['Rtg.']} | ${latest.Country}`);
    info.append('div').attr('class', 'meta-line')
      .text(`Trainer: ${latest.Trainer} | Jockey: ${latest.Jockey}`);

    // Stats grid
    const sg = profileEl.append('div').attr('class', 'profile-stats');
    _addStat(sg, (stats.winRate * 100).toFixed(1) + '%', 'Win Rate', 'green');
    _addStat(sg, stats.places + '/' + stats.total, 'Place Rate', 'blue');
    _addStat(sg, stats.avgFSpeed.toFixed(2) + 's', 'Avg FSpeed', 'orange');
    _addStat(sg, stats.avgPos.toFixed(1), 'Avg Finish', 'blue');

    // Recent Form
    const formRow = profileEl.append('div').attr('class', 'recent-form');
    formRow.append('span').attr('class', 'form-label').text('Recent Form');
    stats.recentForm.forEach(p => {
      const cls = p === 1 ? 'win' : p <= 3 ? 'place' : 'loss';
      const label = p === 1 ? 'W' : p <= 3 ? p : p >= 99 ? 'X' : p;
      formRow.append('span').attr('class', `form-dot ${cls}`).text(label);
    });

    // Gear tags
    if (gearList.length) {
      const gearDiv = profileEl.append('div').attr('class', 'gear-tags');
      gearList.forEach(g => {
        gearDiv.append('span').attr('class', 'gear-tag')
          .text(Loader().getGearFullName(g));
      });
    }
  }

  function _addStat(parent, value, label, colorClass) {
    const box = parent.append('div').attr('class', 'stat-box');
    box.append('div').attr('class', `stat-value ${colorClass}`).text(value);
    box.append('div').attr('class', 'stat-label').text(label);
  }

  return { init };
})();
