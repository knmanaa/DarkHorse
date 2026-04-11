// =============================================================================
// GlobalState.js — Centralized state management with pub/sub event system
// =============================================================================
window.DarkHorse = window.DarkHorse || {};

window.DarkHorse.GlobalState = (function () {
  const _state = {
    allData: [],              // full parsed CSV
    activeHorseID: null,      // currently selected horse
    activeRace: null,         // { Date, RaceIndex } of selected race
    hoveredHorseID: null,     // horse being hovered in sidebar
    raceDate: null,           // selected race-day filter
    replayTime: 0,            // 0–1 progress of race scrubber
    sidebarFilter: '',        // search text in sidebar
    synergyJockey: null,      // selected jockey in synergy view
    synergyTrainer: null,     // selected trainer in synergy view
  };

  const _listeners = {};

  function get(key) {
    return _state[key];
  }

  function set(key, value) {
    if (_state[key] === value) return;
    _state[key] = value;
    _emit(key, value);
  }

  function batch(updates) {
    const changed = [];
    for (const [k, v] of Object.entries(updates)) {
      if (_state[k] !== v) {
        _state[k] = v;
        changed.push(k);
      }
    }
    changed.forEach(k => _emit(k, _state[k]));
  }

  function on(key, fn) {
    if (!_listeners[key]) _listeners[key] = [];
    _listeners[key].push(fn);
  }

  function off(key, fn) {
    if (!_listeners[key]) return;
    _listeners[key] = _listeners[key].filter(f => f !== fn);
  }

  function _emit(key, value) {
    (_listeners[key] || []).forEach(fn => fn(value));
    (_listeners['*'] || []).forEach(fn => fn(key, value));
  }

  // ---- Derived helpers ----
  function getHorseData(horseID) {
    return _state.allData.filter(d => d.HorseID === (horseID || _state.activeHorseID));
  }

  function getRaceData(date, raceIndex) {
    const d = date || (_state.activeRace && _state.activeRace.Date);
    const r = raceIndex || (_state.activeRace && _state.activeRace.RaceIndex);
    return _state.allData.filter(row => row.Date === d && row.RaceIndex === r);
  }

  function getUniqueHorses() {
    const map = new Map();
    _state.allData.forEach(d => {
      if (!map.has(d.HorseID)) {
        map.set(d.HorseID, {
          HorseID: d.HorseID,
          Name: d.Name,
          Trainer: d.Trainer,
          Jockey: d.Jockey,
          Rtg: d['Rtg.'],
          Country: d.Country,
          Sire: d.Sire,
          Dam: d.Dam,
          lastRaceDate: d._parsedDate,
        });
      } else {
        const existing = map.get(d.HorseID);
        if (d._parsedDate > existing.lastRaceDate) {
          existing.Trainer = d.Trainer;
          existing.Jockey = d.Jockey;
          existing.Rtg = d['Rtg.'];
          existing.lastRaceDate = d._parsedDate;
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => b.lastRaceDate - a.lastRaceDate);
  }

  return { get, set, batch, on, off, getHorseData, getRaceData, getUniqueHorses };
})();
