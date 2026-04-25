// =============================================================================
// SidebarSelector.js — Unified Horse Panel: search + profile + lineage + trends
// =============================================================================
window.DarkHorse = window.DarkHorse || {};

window.DarkHorse.SidebarSelector = (function () {
  const State  = () => window.DarkHorse.GlobalState;
  const Loader = () => window.DarkHorse.DataLoader;
  const Tips   = () => window.DarkHorse.Tooltips;
  let container, _sortMode = 'name';

  function init(selector) {
    container = d3.select(selector);
    _render();
    State().on('allData',      () => _renderList());
    State().on('activeHorseID', () => { _highlightActive(); _renderProfile(); });
    State().on('sidebarFilter', () => _renderList());
  }

  // ---- Shell ----------------------------------------------------------------
  function _render() {
    container.html('');
    container.append('div').attr('class', 'panel-header')
      .html('<span>Horse Panel</span>');

    // Search box
    const search = container.append('div').attr('class', 'sidebar-search');
    search.append('svg').attr('viewBox', '0 0 16 16').attr('width', 14).attr('height', 14)
      .append('path').attr('fill', '#8b949e')
      .attr('d', 'M11.5 7a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0zm-.82 4.74a6 6 0 1 1 1.06-1.06l3.04 3.04a.75.75 0 1 1-1.06 1.06l-3.04-3.04z');
    search.append('input')
      .attr('type', 'text')
      .attr('placeholder', 'Search horses…')
      .attr('id', 'sidebar-horse-search')
      .on('input', function () { State().set('sidebarFilter', this.value.toLowerCase()); });

    // Sort bar
    const sortBar = container.append('div').attr('class', 'horse-sort-bar');
    sortBar.append('span').attr('class', 'horse-sort-label').text('Sort:');
    sortBar.append('button').attr('class', 'horse-sort-btn active').attr('id', 'ss-sort-name').text('A–Z')
      .on('click', () => { _sortMode = 'name'; _updateSortButtons(); _renderList(); });
    sortBar.append('button').attr('class', 'horse-sort-btn').attr('id', 'ss-sort-rtg').text('Rtg ↑')
      .on('click', () => { _sortMode = 'rtg'; _updateSortButtons(); _renderList(); });

    // Horse list
    container.append('div').attr('class', 'horse-list').attr('id', 'horse-list-container');

    // Profile card (hidden until horse selected)
    container.append('div').attr('class', 'horse-profile').attr('id', 'horse-profile-area')
      .style('display', 'none');


  }

  // ---- Horse list -----------------------------------------------------------
  function _renderList() {
    const horses = State().getUniqueHorses();
    const filter = (State().get('sidebarFilter') || '').toLowerCase();
    const filtered = filter
      ? horses.filter(h =>
          h.Name.toLowerCase().includes(filter) ||
          h.HorseID.toLowerCase().includes(filter))
      : horses.slice();
    filtered.sort((a, b) => _sortMode === 'rtg'
      ? (+a.Rtg || 0) - (+b.Rtg || 0)
      : a.Name.localeCompare(b.Name));

    const listEl = container.select('#horse-list-container');
    const rows   = listEl.selectAll('div.horse-row').data(filtered, d => d.HorseID);

    rows.exit().remove();

    const enter = rows.enter().append('div').attr('class', 'horse-row')
      .on('click',      (_, d) => State().set('activeHorseID', d.HorseID))
      .on('mouseenter', (_, d) => State().set('hoveredHorseID', d.HorseID))
      .on('mouseleave', ()     => State().set('hoveredHorseID', null));

    enter.append('span').attr('class', 'horse-id');
    enter.append('span').attr('class', 'horse-name');
    enter.append('span').attr('class', 'horse-meta');
    enter.append('span').attr('class', 'horse-chevron').html('&#9656;');

    const merged = enter.merge(rows);
    merged.select('.horse-id').text(d => d.HorseID);
    merged.select('.horse-name').text(d => d.Name);
    merged.select('.horse-meta').text(d => `Rtg ${d.Rtg}`);
    merged.classed('active', d => d.HorseID === State().get('activeHorseID'));
    merged.order(); // reorder DOM nodes to match sorted data order
  }

  function _updateSortButtons() {
    container.select('#ss-sort-name').classed('active', _sortMode === 'name');
    container.select('#ss-sort-rtg').classed('active', _sortMode === 'rtg');
  }

  function _highlightActive() {
    const aid = State().get('activeHorseID');
    container.selectAll('.horse-row').classed('active', d => d.HorseID === aid);
  }

  // ---- Profile card ---------------------------------------------------------
  function _renderProfile() {
    const hid = State().get('activeHorseID');
    const profileEl = container.select('#horse-profile-area');
    if (!hid) { profileEl.style('display', 'none'); return; }

    const records = State().getHorseData(hid);
    if (!records.length) { profileEl.style('display', 'none'); return; }

    const stats  = Loader().computeHorseStats(records);
    const latest = records[records.length - 1];

    profileEl.style('display', null).html('');

    // ---- Header: avatar + name + meta
    const header = profileEl.append('div').attr('class', 'horse-profile-header');
    header.append('div').attr('class', 'horse-avatar').text(latest.Name.charAt(0));
    const info = header.append('div').attr('class', 'horse-profile-info');
    info.append('h3').text(latest.Name);
    // Meta line: ID · Rtg · Country — each with a ? badge explaining what it means
    const metaLine = info.append('div').attr('class', 'meta-line').style('display','flex').style('align-items','center').style('flex-wrap','wrap').style('gap','4px');
    const idBadge   = metaLine.append('span').text(latest.HorseID);
    metaLine.append('span').style('color','var(--text-muted)').text('·');
    const rtgBadge  = metaLine.append('span').text(`Rtg ${latest['Rtg.']}`);
    metaLine.append('span').style('color','var(--text-muted)').text('·');
    const ctryBadge = metaLine.append('span').text(latest.Country || '—');
    if (Tips()) {
      Tips().attach(idBadge.node(),   'HorseID');
      Tips().attach(rtgBadge.node(),  'Rtg.');
      Tips().attach(ctryBadge.node(), 'Country');
    }
    info.append('div').attr('class', 'meta-line')
      .text(`Trainer: ${latest.Trainer}`);
    info.append('div').attr('class', 'meta-line')
      .text(`Jockey: ${latest.Jockey}`);

    // ---- Sire / Dam lineage
    const lineageRow = profileEl.append('div').attr('class', 'lineage-row');
    const sireItem = lineageRow.append('div').attr('class', 'lineage-item');
    sireItem.append('div').attr('class', 'lineage-label').text('Sire');
    sireItem.append('div').attr('class', 'lineage-value')
      .attr('title', latest.Sire || '—').text(latest.Sire || '—');
    const damItem = lineageRow.append('div').attr('class', 'lineage-item');
    damItem.append('div').attr('class', 'lineage-label').text('Dam');
    damItem.append('div').attr('class', 'lineage-value')
      .attr('title', latest.Dam || '—').text(latest.Dam || '—');

    // ---- Stats grid with tooltip badges
    const sg = profileEl.append('div').attr('class', 'profile-stats');
    _addStat(sg, (stats.winRate * 100).toFixed(1) + '%', 'Win Rate',   'green', 'Win Rate');
    _addStat(sg, stats.places + '/' + stats.total,       'Place Rate', 'blue',  'Place Rate');
    _addStat(sg, stats.avgFSpeed.toFixed(2) + 's',       'Avg FSpeed', 'orange','Avg FSpeed');
    _addStat(sg, stats.avgPos.toFixed(1),                'Avg Finish', 'blue',  'Avg Finish');

    // ---- Recent Form dots
    const formRow = profileEl.append('div').attr('class', 'recent-form');
    const formLabel = formRow.append('span').attr('class', 'form-label').text('Form');
    if (Tips()) Tips().attach(formLabel.node(), 'Form');
    stats.recentForm.forEach(p => {
      const cls   = p === 1 ? 'win' : p <= 3 ? 'place' : 'loss';
      const label = p === 1 ? 'W'   : p <= 3 ? p       : p >= 99 ? 'X' : p;
      formRow.append('span').attr('class', `form-dot ${cls}`).text(label);
    });

    // ---- Used Gear (all unique full gear names across every race this horse has run)
    const allGearNames = new Set();
    records.forEach(r => {
      Loader().parseGearString(r.Gear).forEach(g => {
        const name = Loader().getGearFullName(g);
        if (name) allGearNames.add(name);
      });
    });
    if (allGearNames.size > 0) {
      const gearSection = profileEl.append('div').style('padding-top', '6px');
      gearSection.append('div')
        .style('font-size', '.72rem')
        .style('color', 'var(--text-secondary)')
        .style('text-transform', 'uppercase')
        .style('letter-spacing', '.4px')
        .style('margin-bottom', '4px')
        .text('Used Gear');
      const gearDiv = gearSection.append('div').attr('class', 'gear-tags');
      Array.from(allGearNames).sort().forEach(name => {
        gearDiv.append('span').attr('class', 'gear-tag')
          .attr('title', name)
          .text(name);
      });
    }
  }

  // ---- helpers --------------------------------------------------------------
  function _addStat(parent, value, label, colorClass, tipKey) {
    const box = parent.append('div').attr('class', 'stat-box');
    box.append('div').attr('class', `stat-value ${colorClass}`).text(value);
    const lbl = box.append('div').attr('class', 'stat-label').text(label);
    if (tipKey && Tips()) Tips().attach(lbl.node(), tipKey);
  }

  return { init };
})();

