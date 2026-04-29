// =============================================================================
// DataLoader.js — CSV loading, parsing, and data transformation utilities
// =============================================================================
window.DarkHorse = window.DarkHorse || {};

window.DarkHorse.DataLoader = (function () {
  const parseDate = d3.timeParse('%d/%m/%Y');

  function load(csvPath) {
    return d3.csv(csvPath).then(raw => {
      const data = raw.map(d => ({
        Date: d.Date,
        _parsedDate: parseDate(d.Date),
        RaceIndex: +d.RaceIndex,
        'Pla.': d['Pla.'],
        _place: parsePlace(d['Pla.']),
        HorseID: d.HorseID.trim(),
        Name: d.Name.trim(),
        'RC/Track/Course': d['RC/Track/Course'],
        _track: parseTrack(d['RC/Track/Course']),
        'Dist.': +d['Dist.'],
        G: d.G,
        RaceClass: d.RaceClass,
        'Dr.': +d['Dr.'],
        'Rtg.': +d['Rtg.'],
        Trainer: d.Trainer ? d.Trainer.trim() : '',
        Jockey: d.Jockey ? d.Jockey.trim() : '',
        LBW: parseLBW(d.LBW),
        'Win Odds': +d['Win Odds'],
        'Act.Wt.': +d['Act.Wt.'],
        RunningPosition: d.RunningPosition ? d.RunningPosition.trim() : '',
        _runPos: d.RunningPosition ? d.RunningPosition.trim().split(/\s+/).map(Number) : [],
        'Finish Time': +d['Finish Time'],
        'Declar.Horse Wt.': +d['Declar.Horse Wt.'],
        Gear: d.Gear ? d.Gear.trim() : '--',
        Country: d.Country ? d.Country.trim() : '',
        ImportType: d.ImportType ? d.ImportType.trim() : '',
        Sire: d.Sire ? d.Sire.trim() : '',
        Dam: d.Dam ? d.Dam.trim() : '',
        FSpeed: +d.FSpeed,
      }));

      data.sort((a, b) => a._parsedDate - b._parsedDate);
      return data;
    });
  }

  function parsePlace(p) {
    const n = parseInt(p, 10);
    return isNaN(n) ? 99 : n;
  }

  function parseLBW(lbw) {
    if (!lbw || lbw === '---' || lbw === '-') return 0;
    const n = parseFloat(lbw);
    return isNaN(n) ? 0 : n;
  }

  function parseTrack(rc) {
    if (!rc) return { venue: 'ST', surface: 'Turf', course: 'A' };
    const parts = rc.replace(/"/g, '').split('/').map(s => s.trim());
    return {
      venue: parts[0] || 'ST',
      surface: parts[1] || 'Turf',
      course: parts[2] || 'A',
    };
  }

  // Compute derived stats for a horse
  function computeHorseStats(horseRecords) {
    if (!horseRecords.length) return {};
    const total = horseRecords.length;
    const wins = horseRecords.filter(r => r._place === 1).length;
    const places = horseRecords.filter(r => r._place <= 3).length;
    const avgPos = d3.mean(horseRecords, r => r._place) || 0;
    const avgLBW = d3.mean(horseRecords, r => r.LBW) || 0;
    const avgFSpeed = d3.mean(horseRecords, r => r.FSpeed) || 0;
    const recentForm = horseRecords
      .slice(-10)
      .map(r => r._place);
    return { total, wins, places, avgPos, avgLBW, avgFSpeed, recentForm, winRate: wins / total };
  }

  // Build a list of unique race-days
  function getUniqueDates(data) {
    const set = new Set();
    data.forEach(d => set.add(d.Date));
    return Array.from(set).sort((a, b) => parseDate(a) - parseDate(b));
  }

  // Get gear list from a gear string like "B-/CP1/TT"
  function parseGearString(gear) {
    if (!gear || gear === '--') return [];
    return gear.split('/').map(g => g.trim()).filter(Boolean);
  }

  // Map gear abbreviations to full names
  const GEAR_NAMES = {
    'B': 'Blinkers', 'B-': 'Blinkers', 'B1': 'Blinkers', 'B2': 'Blinkers',
    'E': 'Eye Shield', 'E-': 'Eye Shield', 'E1': 'Eye Shield',
    'H': 'Hood', 'H-': 'Hood', 'H1': 'Hood',
    'P': 'Pacifiers', 'P-': 'Pacifiers', 'P1': 'Pacifiers',
    'PC': 'Cheek Pieces', 'PC-': 'Cheek Pieces', 'PC1': 'Cheek Pieces', 'PC2': 'Cheek Pieces',
    'CP': 'Cross-over Noseband', 'CP-': 'Cross-over Noseband', 'CP1': 'Cross-over Noseband', 'CP2': 'Cross-over Noseband',
    'TT': 'Tongue Tie', 'TT-': 'Tongue Tie', 'TT1': 'Tongue Tie',
    'SR': 'Shadow Roll', 'SR-': 'Shadow Roll', 'SR1': 'Shadow Roll', 'SR2': 'Shadow Roll',
    'V': 'Visor', 'V-': 'Visor', 'V1': 'Visor',
    'SB': 'Side Blinds', 'SB-': 'Side Blinds',
    'BO': 'Blinkers (one-eye)', 'BO-': 'Blinkers (one-eye)',
    'XN': 'Cross Noseband', 'XN-': 'Cross Noseband',
  };

  function getGearFullName(code) {
    const base = code.replace(/[0-9-]/g, '');
    return GEAR_NAMES[code] || GEAR_NAMES[base] || code;
  }

  return { load, computeHorseStats, getUniqueDates, parseGearString, getGearFullName };
})();
