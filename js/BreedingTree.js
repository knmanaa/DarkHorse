// =============================================================================
// BreedingTree.js — Family tree / dendrogram with genetic performance scores
// =============================================================================
window.DarkHorse = window.DarkHorse || {};

window.DarkHorse.BreedingTree = (function () {
  const State = () => window.DarkHorse.GlobalState;
  let container, svg, tooltip;
  const W = 340, H = 260;

  function init(selector) {
    container = d3.select(selector);
    _render();
    State().on('activeHorseID', _update);
  }

  function _render() {
    container.html('');
    const header = container.append('div').attr('class', 'panel-header');
    header.append('span').text('Genetics & Breeding');

    container.append('div').style('padding', '4px 10px').style('font-size', '.82rem').style('font-weight', '600')
      .style('color', 'var(--text-primary)').text('Family Tree Distribution');

    const body = container.append('div').attr('class', 'panel-body');
    svg = body.append('svg')
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .style('width', '100%');

    // Legend
    const legend = container.append('div').attr('class', 'tree-legend')
      .style('padding', '4px 10px').style('display', 'flex').style('gap', '12px');
    [
      { color: 'var(--accent-green)', label: 'Group 1 Wins' },
      { color: 'var(--accent-orange)', label: 'Stake Winners' },
      { color: 'var(--accent-purple)', label: 'High Genetic Score' },
    ].forEach(l => {
      const item = legend.append('span').style('display', 'flex').style('align-items', 'center').style('gap', '4px');
      item.append('span').attr('class', 'tree-legend-dot').style('background', l.color);
      item.append('span').text(l.label);
    });

    tooltip = d3.select('body').selectAll('.d3-tooltip.tree-tt').data([0])
      .join('div').attr('class', 'd3-tooltip tree-tt').style('display', 'none');
  }

  function _update() {
    svg.selectAll('*').remove();
    const hid = State().get('activeHorseID');
    if (!hid) {
      svg.append('text').attr('x', W / 2).attr('y', H / 2).attr('text-anchor', 'middle')
        .attr('fill', 'var(--text-muted)').attr('font-size', '12').text('Select a horse');
      return;
    }

    const records = State().getHorseData(hid);
    if (!records.length) return;
    const horse = records[records.length - 1];

    // Build tree hierarchy
    const treeData = _buildTree(horse);
    const root = d3.hierarchy(treeData);

    // Layout
    const treeLayout = d3.tree().size([H - 40, W - 100]);
    treeLayout(root);

    const g = svg.append('g').attr('transform', 'translate(40, 20)');

    // Links
    g.selectAll('.tree-link')
      .data(root.links())
      .join('path')
      .attr('class', 'tree-link')
      .attr('d', d3.linkHorizontal().x(d => d.y).y(d => d.x));

    // Nodes
    const node = g.selectAll('.tree-node')
      .data(root.descendants())
      .join('g')
      .attr('class', 'tree-node')
      .attr('transform', d => `translate(${d.y},${d.x})`);

    node.append('circle')
      .attr('r', d => d.depth === 0 ? 12 : 9)
      .attr('fill', d => _nodeColor(d.data))
      .attr('stroke', d => d.data.isHorse ? 'var(--accent-blue)' : _nodeColor(d.data))
      .on('mouseenter', (event, d) => {
        tooltip.style('display', null)
          .html(`<div class="tt-title">${d.data.name}</div>
                 <div class="tt-row"><span class="tt-label">Role:</span><span>${d.data.role}</span></div>
                 <div class="tt-row"><span class="tt-label">Offspring Rtg Avg:</span><span>${d.data.avgRtg ? d.data.avgRtg.toFixed(1) : 'N/A'}</span></div>
                 <div class="tt-row"><span class="tt-label">Offspring Count:</span><span>${d.data.offspringCount || 'N/A'}</span></div>`)
          .style('left', (event.pageX + 10) + 'px').style('top', (event.pageY - 20) + 'px');
      })
      .on('mouseleave', () => tooltip.style('display', 'none'))
      .on('click', (event, d) => {
        // If clicking a sire/dam, filter sidebar to show related horses
        if (d.data.role === 'Sire' && d.data.name) {
          State().set('sidebarFilter', d.data.name.toLowerCase());
        } else if (d.data.role === 'Dam' && d.data.name) {
          State().set('sidebarFilter', d.data.name.toLowerCase());
        }
      });

    // Labels
    node.append('text')
      .attr('dy', d => d.depth === 0 ? -16 : -12)
      .attr('text-anchor', 'middle')
      .attr('font-size', d => d.depth === 0 ? '10px' : '8px')
      .attr('font-weight', d => d.depth === 0 ? '600' : '400')
      .text(d => _truncate(d.data.name, 14));

    // Role label
    node.append('text')
      .attr('dy', d => d.depth === 0 ? 20 : 16)
      .attr('text-anchor', 'middle')
      .attr('font-size', '7px')
      .attr('fill', 'var(--text-muted)')
      .text(d => d.data.role);
  }

  function _buildTree(horse) {
    const allData = State().get('allData');

    // Find sire's other offspring + dam's other offspring
    const sireOffspring = horse.Sire ? allData.filter(d => d.Sire === horse.Sire && d.HorseID !== horse.HorseID) : [];
    const damOffspring = horse.Dam ? allData.filter(d => d.Dam === horse.Dam && d.HorseID !== horse.HorseID) : [];

    // Find grandparents from other horses who share the same sire/dam
    const sireAsSire = horse.Sire ? _findParents(horse.Sire, 'Sire') : null;
    const damAsSire = horse.Dam ? _findParents(horse.Dam, 'Dam') : null;

    const sireNode = {
      name: horse.Sire || 'Unknown',
      role: 'Sire',
      avgRtg: sireOffspring.length ? d3.mean(sireOffspring, d => d['Rtg.']) : null,
      offspringCount: new Set(sireOffspring.map(d => d.HorseID)).size,
      children: sireAsSire ? [
        { name: sireAsSire.sire || '?', role: 'Grandsire (S)', children: [] },
        { name: sireAsSire.dam || '?', role: 'Granddam (S)', children: [] },
      ] : [],
    };

    const damNode = {
      name: horse.Dam || 'Unknown',
      role: 'Dam',
      avgRtg: damOffspring.length ? d3.mean(damOffspring, d => d['Rtg.']) : null,
      offspringCount: new Set(damOffspring.map(d => d.HorseID)).size,
      children: damAsSire ? [
        { name: damAsSire.sire || '?', role: 'Grandsire (D)', children: [] },
        { name: damAsSire.dam || '?', role: 'Granddam (D)', children: [] },
      ] : [],
    };

    return {
      name: horse.Name,
      role: 'Selected',
      isHorse: true,
      avgRtg: d3.mean(State().getHorseData(horse.HorseID), d => d['Rtg.']),
      children: [sireNode, damNode],
    };
  }

  function _findParents(name, role) {
    // Try to find a horse in the dataset whose Name matches and has Sire/Dam data
    const allData = State().get('allData');
    // Sire/Dam names won't match horse Names directly, but we can look for
    // other horses who share the same sire and see if they have a different dam (to infer)
    // This is limited by the data. Return null if not found.
    return null;
  }

  function _nodeColor(d) {
    if (d.isHorse) return 'var(--accent-blue)';
    if (d.avgRtg && d.avgRtg > 60) return 'var(--accent-green)';
    if (d.offspringCount && d.offspringCount > 5) return 'var(--accent-orange)';
    if (d.avgRtg && d.avgRtg > 40) return 'var(--accent-purple)';
    return 'var(--text-muted)';
  }

  function _truncate(str, max) {
    return str && str.length > max ? str.substring(0, max - 1) + '…' : (str || '?');
  }

  return { init };
})();
