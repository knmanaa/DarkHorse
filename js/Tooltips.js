// =============================================================================
// Tooltips.js — Shared metric-definition tooltip utility for DarkHorse
// =============================================================================
window.DarkHorse = window.DarkHorse || {};

window.DarkHorse.Tooltips = (function () {
  const DEFINITIONS = {
    // ── Core performance metrics ──────────────────────────────────────────────
    'Win Rate'        : 'Wins ÷ total starts. Higher = more consistent winner.',
    'Win %'           : 'Win percentage — wins ÷ total starts × 100.',
    'Win%'            : 'Win percentage — wins ÷ total starts × 100.',
    'Place Rate'      : 'Races finished 1st–3rd ÷ total starts.',
    'Place%'          : 'Percentage of races finished in 1st, 2nd or 3rd place.',
    'Avg Finish'      : 'Mean finishing position across all races (lower is better).',
    'Avg.P.'          : 'Average finishing position (lower = better).',
    'Avg Position'    : 'Mean finishing position across all races together (lower = better).',
    'Wo.'             : 'Wins out of total — the raw count of wins / total races raced together.',
    'Common Races'    : 'Number of races this horse and jockey ran together.',
    'Races'           : 'Total number of races in this gear configuration.',
    'Num Races'       : 'Total number of races recorded with this gear setup.',

    // ── FSpeed (Final-section speed) ─────────────────────────────────────────
    'FSpeed'          : 'Final-400m sectional time (seconds). It reflects the average speed over the last 400 m of the race — lower time = higher speed = stronger finish. Example: 23.67 s → 400 ÷ 23.67 ≈ 16.89 m/s (≈ 60.8 km/h). Compare against the reference sectional to gauge whether the horse accelerated or faded.',
    'FSpd'            : 'Final-400m sectional time (seconds). Lower = faster sprint finish. See "FSpeed".',
    'Avg FSpeed'      : 'Mean final-400m sectional time across all recorded races for this horse. A lower average indicates a consistently quick finisher.',
    'Δ FSpeed'        : 'Change in Avg FSpeed vs. the no-gear baseline. Negative (green) = faster finish — positive (red) = slower finish.',
    'Delta FSpeed'    : 'Change in Avg FSpeed vs. the no-gear baseline. Negative = faster (improvement); positive = slower (worse).',
    'FSpeed Trend'    : 'Compares mean final-400m sectional time over the last 5 races vs the prior 5. Lower FSpeed = faster finish. ▲ = getting faster (improving), ▼ = getting slower.',
    'Win Rate Trend'  : 'Compares win rate (wins ÷ races) in the last 5 races vs the previous 5. ▲ = win rate improving, ▼ = declining.',

    // ── LBW (Lengths Behind Winner) ───────────────────────────────────────────
    'LBW'             : 'Lengths Behind Winner — the gap to 1st place at the finish line. 0 = winner. 1 Length ≈ 2.4 m. Standard short margins: Nose ≈ 0.05 L · Short Head ≈ 0.1 L · Head ≈ 0.2 L · Neck ≈ 0.3 L. A small LBW with a fast FSpeed often signals an unlucky run.',
    'Avg LBW'         : 'Average Lengths Behind Winner across recorded races. Smaller = the horse typically finishes closer to the winner.',

    // ── Running position ──────────────────────────────────────────────────────
    'RunningPosition' : 'Position at each official call point during the race (Start → mid-race checkpoints → Finish). A move from 8th → 1st signals a powerful late run (closer style). Staying near the front (e.g. 2nd → 1st) indicates front-running tactics. Combine with FSpeed to judge whether the horse conserved energy early and unleashed a sprint late.',

    // ── Race class & rating ───────────────────────────────────────────────────
    'RaceClass'       : 'Grade of the race. Class 5 (entry-level, Rtg 0–39) → 4 (40–59) → 3 (60–79) → 2 (80–99) → 1 (elite, 100+). Special types: Griffin = first-time starters; G3 / G2 / G1 = international graded races (highest prestige). Classes 1–5 are all handicap races. Overall hierarchy: G1 > G2 > G3 > 1 > 2 > 3 > 4 > 5.',
    'Rtg'             : 'Official HKJC handicap rating (0–140+). Higher = better. Determines class eligibility and handicap weight: every 1 rating point ≈ 1 lb extra weight in Classes 1–5. Rate 60–79 = Class 3; 80–99 = Class 2; 100+ = Class 1.',
    'Rtg.'            : 'Official HKJC handicap rating (0–140+). Higher = better. Determines class eligibility and handicap weight: every 1 rating point ≈ 1 lb extra weight in Classes 1–5. Rate 60–79 = Class 3; 80–99 = Class 2; 100+ = Class 1.',

    // ── Weight ───────────────────────────────────────────────────────────────
    'Act.Wt.'         : 'Actual weight (lbs) carried during the race, including saddle and jockey. In handicap races (Classes 1–5), higher-rated horses carry more weight to level the field — approx. 1 rating point ≈ 1 lb. Higher-rated horses handicapped with more weight to narrow the competitive gap.',
    'Declar.Horse Wt.': 'Declared bodyweight of the horse (kg), submitted by the trainer ~3–4 days before race day — not the post-race weigh-in. Used to track fitness and condition: a gain of 2–7 kg may reflect muscle build-up; a large swing of ±9 kg+ may signal health or training concerns.',

    // ── Odds ─────────────────────────────────────────────────────────────────
    'Win Odds'        : 'Win-market starting odds (decimal). Example: 2.0 → bet $100, collect $200 if winner. Lower odds = crowd favourite. Odds shift in real time under the pari-mutuel pool system: more money on a horse = lower odds for that horse.',

    // ── Draw ─────────────────────────────────────────────────────────────────
    'Dr.'             : 'Draw — starting gate/barrier number. 1 = inside rail (shortest path). Inner draws (1–3) are shortest but risk being boxed in. Middle draws (4–8) are most balanced. Outer draws (9+) require wider running lines, favouring horses with good early pace or a late-running style.',

    // ── Track condition ───────────────────────────────────────────────────────
    'G'               : 'Going / track condition. G = Good · GF = Good to Firm (faster, harder) · GY = Good to Yielding (slightly wet) · Y = Yielding (soft, slower) · WF = Wet Fast (wet surface, firm base — can be quick) · WS = Wet Slow (very wet, very slow) · SE = Soft (deepest going, slowest). Firmer conditions = faster race times; wet conditions favour stamina over speed.',

    // ── Course & track type ───────────────────────────────────────────────────
    'Track'           : 'Racing surface: Turf (natural grass) or AWT (All-Weather Track — sand-based artificial surface). Each surface suits different horse types and produces different pace patterns.',
    'Course'          : 'Track configuration / inner-rail position. At Sha Tin: A (innermost, shortest path, widest track 30.5 m) → B → C+3 (outermost, narrowest). At Happy Valley: similar A–C+3 scheme but on a tighter oval. "+2"/"+3" indicate the rail is shifted outward. More outward = longer path but wider running room.',
    'Dist.'           : 'Race distance in metres.',

    // ── Gear (equipment) ─────────────────────────────────────────────────────
    'Gear'            : 'Equipment worn to improve focus, breathing, or control. Key codes — B = Blinkers · V = Visor · PC = Pacifier · CP = Cheek Pieces · SR = Shadow Roll · H = Hood · E = Ear Plugs · XB = Cross Nose Band · TT = Tongue Tie · SB = Sheepskin Browband. Suffixes: "1" = first time worn (significant signal) · "2" = second time · "-" = removed (also a major signal). Multiple items separated by "/". Example: B-/TT1 = Blinkers removed + Tongue Tie worn for first time.',

    // ── Bloodline ─────────────────────────────────────────────────────────────
    'Sire'            : 'Father (paternal parent) of the horse. Sire lines are used to assess aptitude: some sire families excel at sprint distances, others at middle or long distances. Breeding analysis often focuses on sire × dam combinations.',
    'Dam'             : 'Mother (maternal parent) of the horse. The dam\'s sire (known as the "broodmare sire" or grandsire through the dam) is another key bloodline indicator for stamina, temperament, and racing style.',

    // ── Import type ───────────────────────────────────────────────────────────
    'ImportType'      : 'How the horse was acquired and entered HK racing. PPG = Privately Purchased Griffin (unraced, private buy — races in Griffin class first) · PP = Privately Purchased (previously raced overseas, private import) · ISG = International Sale Griffin (unraced, bought at HKJC auction) · VIS = International Sale (previously raced, bought at HKJC auction). Griffin horses start without a rating; wins assign one.',

    // ── Identity ──────────────────────────────────────────────────────────────
    'HorseID'         : 'Unique identifier assigned by the HKJC to each registered horse (e.g. H057).',
    'Country'         : 'Country of origin / breeding country of the horse (e.g. AUS = Australia, IRE = Ireland, NZ = New Zealand).',
  };

  // ---- Singleton floating popup ----
  let popup = null;
  function _getPopup() {
    if (!popup) {
      popup = document.createElement('div');
      popup.className = 'metric-tooltip-popup';
      popup.style.display = 'none';
      document.body.appendChild(popup);
    }
    return popup;
  }

  /**
   * Wrap an existing element (the label node) so it shows a small ? badge
   * that displays the metric definition on hover.
   *
   * @param {Element|d3.Selection} el   — the label element to augment
   * @param {string}               key  — key into DEFINITIONS
   */
  function attach(el, key) {
    const def = DEFINITIONS[key];
    if (!def) return;

    // Accept a raw DOM node or a D3 selection
    const node = (el instanceof Element) ? el : el.node();
    if (!node) return;

    // Wrap contents in a flex container so the ? sits inline with the text
    const text = node.textContent;
    node.innerHTML = '';
    const wrap = document.createElement('span');
    wrap.className = 'metric-tip-wrap';
    wrap.textContent = text;

    const icon = document.createElement('span');
    icon.className = 'metric-tip-icon';
    icon.textContent = '?';
    icon.setAttribute('aria-label', def);
    icon.setAttribute('title', ''); // suppress native tooltip

    icon.addEventListener('mouseenter', (e) => {
      const p = _getPopup();
      p.textContent = def;
      p.style.display = 'block';
      _position(p, e);
    });
    icon.addEventListener('mousemove', (e) => _position(_getPopup(), e));
    icon.addEventListener('mouseleave', () => { _getPopup().style.display = 'none'; });

    wrap.appendChild(icon);
    node.appendChild(wrap);
  }

  /**
   * Programmatically show a floating tooltip with arbitrary content.
   * @param {string}     content  — text or HTML
   * @param {MouseEvent} event
   */
  function tip(content, event) {
    const p = _getPopup();
    p.innerHTML = content;
    p.style.display = 'block';
    _position(p, event);
  }

  function hide() { _getPopup().style.display = 'none'; }

  function _position(p, e) {
    const pad = 14;
    let x = e.clientX + pad, y = e.clientY + pad;
    const rect = p.getBoundingClientRect();
    if (x + rect.width > window.innerWidth - 8)  x = e.clientX - rect.width - pad;
    if (y + rect.height > window.innerHeight - 8) y = e.clientY - rect.height - pad;
    p.style.left = x + 'px';
    p.style.top  = y + 'px';
  }

  return { attach, tip, hide, DEFINITIONS };
})();
