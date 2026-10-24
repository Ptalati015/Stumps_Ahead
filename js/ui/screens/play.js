// Play screen: delivery view, batting and bowling controls, and the game loop.
// All text goes in with textContent; every timer and listener is released in unmount.
import {
  setBowler, playBall, aiChooseBowler, aiBowl, aiBat, availableBowlers, previewDelivery,
  currentInnings, playerById, teamByCode, isUserBatting, oversText, runRate, chaseInfo, maxOversPerBowler,
} from '../../engine/match.js';
import {
  SHOTS, SHOT_LABELS, LINES, LENGTHS, LINE_LABELS, LENGTH_LABELS, TIMING_WINDOWS, DEFAULT_AIM, OFFSET_STEP_M,
  VARIATIONS, SIDES, lineFromX, lengthFromZ, expectedArrival,
} from '../../engine/outcomes.js';
import { createScene } from '../scene/scene.js';
import { attachDrag, dragToOffset, clampOffset } from '../input/swipe.js';

const RUN_UP_MS = 1100;
const PAUSE_AFTER_BALL_MS = 1100;
const PAUSE_BEFORE_NAV_MS = 1800;
const METER_PERIOD_MS = 1100;
const SHOT_KEYS = { defend: 'd', drive: 'f', pull: 'p', cut: 'c', loft: 'l' };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function button(className, text, onPress) {
  const b = el('button', className, text);
  b.type = 'button';
  // pointerdown for time-critical taps; keyboard activation comes through click with detail 0.
  b.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    onPress();
  });
  b.addEventListener('click', (e) => {
    if (e.detail === 0) onPress();
  });
  return b;
}

export function mount(root, props, navigate) {
  let state = props.match;
  let alive = true;
  const timeouts = new Set();
  const frames = new Set();

  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timeouts.delete(id);
      if (alive) fn();
    }, ms);
    timeouts.add(id);
  };
  const frame = (fn) => {
    const id = requestAnimationFrame((t) => {
      frames.delete(id);
      if (alive) fn(t);
    });
    frames.add(id);
  };

  // ---- Layout ----
  root.textContent = '';
  const screen = el('div', 'pl');
  const scoreSlot = el('div', 'pl-score');
  const miniScore = el('div', 'pl-mini');
  const players = el('div', 'pl-players');
  const pitchWrap = el('div', 'pl-pitch-wrap');
  const flash = el('div', 'pl-flash');
  const speed = el('div', 'pl-speed');
  pitchWrap.append(flash, speed);
  const overRow = el('div', 'pl-over');
  const commentary = el('p', 'pl-comm', '');
  commentary.setAttribute('aria-live', 'polite');
  const controls = el('div', 'pl-controls');
  const venueLine = el('div', 'pl-venue');
  venueLine.hidden = true;
  scoreSlot.append(miniScore, venueLine);
  if (state.config.venueId) {
    import('../../data/venues.js')
      .then((m) => {
        const name = m.getVenue?.(state.config.venueId)?.name;
        if (!alive || !name) return;
        venueLine.textContent = name;
        venueLine.hidden = false;
      })
      .catch(() => {});
  }
  screen.append(scoreSlot, players, pitchWrap, overRow, commentary, controls);
  root.append(screen);
  const scene = createScene(pitchWrap);
  // Venue look and ball colour (pink = night), before the first ball.
  scene.setConditions?.({ venueId: state.config.venueId ?? null, ball: state.config.ball ?? 'white' });
  // Lower half of the delivery view takes a drag to move the batter (SPEC 12.1,
  // 15.3). Positioned through CSSOM so it works under the strict CSP; Joel styles .pl-swipe.
  const swipeZone = el('div', 'pl-swipe');
  Object.assign(swipeZone.style, { position: 'absolute', left: '0', right: '0', bottom: '0', height: '50%', touchAction: 'none', zIndex: '3' });
  swipeZone.hidden = true;
  pitchWrap.append(swipeZone);
  let detachDrag = () => {};

  // Joel's shared scoreboard, if it is there; the mini score is the fallback.
  let renderScoreboard = null;
  const boardEl = el('div', 'pl-board');
  import('../components/scoreboard.js')
    .then((m) => {
      if (!alive || typeof m.renderScoreboard !== 'function') return;
      renderScoreboard = m.renderScoreboard;
      scoreSlot.prepend(boardEl);
      miniScore.hidden = true;
      renderInfo();
    })
    .catch(() => {});

  // ---- Info rendering ----
  function renderInfo() {
    const inn = currentInnings(state);
    const batTeam = teamByCode(state, inn.battingTeam);
    if (renderScoreboard) {
      try {
        renderScoreboard(boardEl, state, { compact: true });
      } catch {
        miniScore.hidden = false;
      }
    }
    const chase = chaseInfo(state);
    const rateText = chase
      ? chase.ballsLeft > 0
        ? `Need ${chase.runsNeeded} from ${chase.ballsLeft} ball${chase.ballsLeft === 1 ? '' : 's'}`
        : ''
      : `Run rate ${runRate(inn).toFixed(2)}`;
    miniScore.textContent = '';
    miniScore.append(
      el('strong', null, `${batTeam.code} ${inn.runs}/${inn.wickets}`),
      el('span', null, ` (${oversText(inn)}/${state.config.overs})`),
      el('span', 'pl-rate', rateText),
    );

    players.textContent = '';
    for (const id of [inn.strikerId, inn.nonStrikerId]) {
      const p = playerById(state, id);
      const c = inn.batting[id];
      const row = el('div', id === inn.strikerId ? 'pl-bat pl-striker' : 'pl-bat');
      row.append(el('span', 'pl-name', `${p.name}${id === inn.strikerId ? ' *' : ''}`), el('span', null, `${c.runs} (${c.balls})`));
      players.append(row);
    }
    if (inn.bowlerId) {
      const p = playerById(state, inn.bowlerId);
      const c = inn.bowling[inn.bowlerId];
      const row = el('div', 'pl-bowl');
      row.append(el('span', 'pl-name', p.name), el('span', null, `${oversText({ legalBalls: c.balls })}-${c.runs}-${c.wickets}`));
      players.append(row);
    }

    overRow.textContent = '';
    for (const b of inn.log.slice(-6)) {
      let text = String(b.runs);
      let cls = 'pl-chip';
      if (b.wicket) [text, cls] = ['W', 'pl-chip pl-chip-w'];
      else if (b.extra?.type === 'wide') text = 'Wd';
      else if (b.extra?.type === 'noball') text = `Nb${b.runs ? '+' + b.runs : ''}`;
      if (!b.wicket && (b.runs === 4 || b.runs === 6)) cls = 'pl-chip pl-chip-b';
      overRow.append(el('span', cls, text));
    }
  }

  // ---- Scene ----
  let camera = null;
  const strikerBats = () => playerById(state, currentInnings(state).strikerId)?.bats ?? 'R';
  function resetBall() {
    const inn = currentInnings(state);
    const bowler = inn.bowlerId ? playerById(state, inn.bowlerId) : null;
    // Behind the batter when the user bats, behind the bowler when they bowl.
    const wanted = isUserBatting(state) ? 'batting' : 'bowling';
    if (wanted !== camera) {
      camera = wanted;
      scene.setCamera?.(wanted);
    }
    scene.newBall({
      batColors: teamByCode(state, inn.battingTeam).colors,
      bowlColors: teamByCode(state, inn.bowlingTeam).colors,
      spinner: bowler?.bowlType === 'spin',
      // The user's side carries over between balls; the AI's is set in userBats.
      side: isUserBatting(state) ? 'over' : bowlPick.side,
    });
    scene.setBatter?.({ bats: strikerBats(), offsetX: 0 });
    scene.setArrivalMarker?.(null);
    flash.textContent = '';
    flash.className = 'pl-flash';
    speed.textContent = '';
  }

  function showFlash(ballResult, extraLabel) {
    let text = '';
    let cls = 'pl-flash pl-flash-on';
    if (ballResult.wicket) [text, cls] = ['OUT!', cls + ' pl-flash-out'];
    else if (ballResult.extra?.type === 'wide') text = 'WIDE';
    else if (ballResult.runs === 6) [text, cls] = ['SIX!', cls + ' pl-flash-big'];
    else if (ballResult.runs === 4) [text, cls] = ['FOUR!', cls + ' pl-flash-big'];
    else if (ballResult.runs > 0) text = `${ballResult.runs} run${ballResult.runs === 1 ? '' : 's'}`;
    else text = 'Dot';
    if (ballResult.extra?.type === 'noball') text = `NO BALL · ${text}`;
    flash.className = cls;
    flash.textContent = '';
    flash.append(el('span', null, text));
    if (extraLabel) flash.append(el('small', null, extraLabel));
  }

  // ---- Game loop ----
  // The scene acts the ball out; the banner, commentary and score land at its climax.
  function afterBall(result, timingLabel) {
    state = result.state;
    const { flashAt, total } = scene.outcome(result.ball);
    later(() => {
      showFlash(result.ball, timingLabel);
      commentary.textContent = result.ball.commentary;
      renderInfo();
    }, flashAt);
    const settle = Math.max(flashAt, total);
    if (state.status === 'innings_break') {
      later(() => navigate('inningsBreak', { ...props, match: state }), settle + PAUSE_BEFORE_NAV_MS);
    } else if (state.status === 'complete') {
      later(() => navigate('result', { ...props, match: state }), settle + PAUSE_BEFORE_NAV_MS);
    } else {
      later(next, settle + PAUSE_AFTER_BALL_MS);
    }
  }

  function next() {
    resetBall();
    renderInfo();
    if (state.status === 'awaiting_bowler') {
      if (isUserBatting(state)) {
        state = setBowler(state, aiChooseBowler(state));
        const p = playerById(state, currentInnings(state).bowlerId);
        commentary.textContent = `${p.name} to bowl.`;
        renderInfo();
      } else {
        showBowlerPicker();
        return;
      }
    }
    if (state.status !== 'in_play') return;
    resetBall();
    if (isUserBatting(state)) userBats();
    else showBowlingControls();
  }

  // User bats: AI bowls. Before release the user can shuffle across the
  // crease; after it, tap (or key) a shot button to play. Loft is always
  // in the air (SPEC 15.3).
  function userBats() {
    const bowl = aiBowl(state);
    const delivery = previewDelivery(state, bowl);
    const bats = strikerBats();
    scene.setBowlingSide?.(delivery.side);
    scene.setMarker(delivery);
    controls.textContent = '';
    controls.className = 'pl-controls pl-shots';
    let played = false;
    let releaseAt = null;
    let offsetX = 0;

    // Movement: ◀ ▶ move the batter that way on screen. A right-hander's
    // off side is screen right, so screen left is toward his leg side.
    const screenLeftSign = bats === 'L' ? -1 : 1;
    const setOffset = (m) => {
      offsetX = clampOffset(m);
      scene.setBatter?.({ bats, offsetX });
      moveLeft.disabled = releaseAt != null || offsetX * screenLeftSign >= 0.6;
      moveRight.disabled = releaseAt != null || offsetX * screenLeftSign <= -0.6;
    };
    const step = (dir) => {
      if (releaseAt != null || played) return;
      setOffset(offsetX + dir * screenLeftSign * OFFSET_STEP_M);
    };
    const moveLeft = button('pl-btn pl-move pl-move-left', '◀', () => step(1));
    const moveRight = button('pl-btn pl-move pl-move-right', '▶', () => step(-1));
    moveLeft.setAttribute('aria-label', 'Move batter left');
    moveRight.setAttribute('aria-label', 'Move batter right');
    const moveRow = el('div', 'pl-move-row');
    moveRow.append(moveLeft, moveRight);

    const buttons = SHOTS.map((shot) => {
      const b = button('pl-btn pl-shot', SHOT_LABELS[shot], () => playShot({ shot, aimDeg: DEFAULT_AIM[shot], aerial: shot === 'loft' }));
      b.dataset.shot = shot;
      b.append(el('kbd', 'pl-key', SHOT_KEYS[shot].toUpperCase()));
      b.disabled = true;
      return b;
    });
    controls.append(moveRow, ...buttons);
    const hint = el('p', 'pl-hint', 'Move before the ball, then tap a shot.');
    controls.append(hint);

    // Drag zone: lower half of the delivery view, only until release.
    let dragFrom = null;
    const drag = attachDrag(swipeZone, {
      enabled: () => releaseAt == null && !played,
      onMove: (dx) => {
        dragFrom ??= offsetX;
        setOffset(dragToOffset(dragFrom, dx, bats));
      },
      onMoveEnd: () => (dragFrom = null),
    });
    swipeZone.hidden = false;
    detachDrag = () => {
      drag.detach();
      swipeZone.hidden = true;
    };

    function onKey(e) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        step(e.key === 'ArrowLeft' ? 1 : -1);
        return;
      }
      const shot = Object.keys(SHOT_KEYS).find((k) => SHOT_KEYS[k] === e.key.toLowerCase());
      if (shot) playShot({ shot, aimDeg: DEFAULT_AIM[shot], aerial: shot === 'loft' });
    }
    function playShot({ shot, aimDeg, aerial }, atMs = performance.now()) {
      if (played || releaseAt == null) return;
      played = true;
      scene.swing(shot, { aimDeg, aerial });
      finish({ shot, aimDeg, aerial }, atMs - releaseAt - delivery.travelMs);
    }
    function finish({ shot, aimDeg = 0, aerial = false }, timingMs) {
      played = true;
      setKeyHandler(null);
      detachDrag();
      [moveLeft, moveRight, ...buttons].forEach((b) => (b.disabled = true));
      buttons.forEach((b) => b.dataset.shot === shot && b.classList.add('pl-picked'));
      const bat = shot === 'leave'
        ? { shot: 'leave', timingMs: null, offsetX }
        : { shot, timingMs: Math.round(timingMs), offsetX, aimDeg, aerial };
      const result = playBall(state, bowl, bat);
      const label = shot === 'leave' || delivery.extra === 'wide' ? null : timingLabel(result.ball.timing, bat.timingMs);
      afterBall(result, label);
    }
    setKeyHandler(onKey);
    setOffset(0);

    commentary.textContent = `${playerById(state, currentInnings(state).bowlerId).name} runs in...`;
    speed.textContent = `${delivery.kph} kph`;
    scene.runUp(RUN_UP_MS);
    later(() => {
      // Position locks at release.
      releaseAt = performance.now();
      setOffset(offsetX);
      buttons.forEach((b) => (b.disabled = false));
      // What a leave would bring, so an unplayed ball heads for the stumps when it should.
      const ifLeft = playBall(state, bowl, { shot: 'leave', timingMs: null, offsetX }).ball;
      scene.release(delivery, { pre: ifLeft });
      later(() => {
        if (!played) finish({ shot: 'leave' }, null);
      }, delivery.travelMs + TIMING_WINDOWS.edge);
    }, RUN_UP_MS);
  }

  function timingLabel(grade, ms) {
    if (!grade) return null;
    const names = { perfect: 'Perfect timing', good: 'Good timing', early: 'Early', late: 'Late', miss: 'Missed' };
    return ms == null ? names[grade] : `${names[grade]} (${ms > 0 ? '+' : ''}${ms} ms)`;
  }

  // User bowls: pick the bowler for the over.
  function showBowlerPicker() {
    const inn = currentInnings(state);
    const legal = new Set(availableBowlers(state).map((p) => p.id));
    const cap = maxOversPerBowler(state);
    controls.textContent = '';
    controls.className = 'pl-controls pl-pick';
    controls.append(el('p', 'pl-label', `Choose your bowler (max ${cap} overs each)`));
    const list = el('div', 'pl-bowlers');
    const bowlers = teamByCode(state, inn.bowlingTeam).players.filter((p) => p.role !== 'WK');
    for (const p of bowlers.sort((a, b) => b.bowling - a.bowling)) {
      const card = inn.bowling[p.id];
      const figures = card ? `${oversText({ legalBalls: card.balls })}-${card.runs}-${card.wickets}` : '0-0-0';
      const b = button('pl-btn pl-bowler', null, () => {
        if (!legal.has(p.id) || state.status !== 'awaiting_bowler') return;
        state = setBowler(state, p.id);
        next();
      });
      b.append(el('span', 'pl-name', p.name), el('span', 'pl-sub', `${p.bowlType ?? 'part-time'} · ${p.bowling} · ${figures}`));
      b.disabled = !legal.has(p.id);
      list.append(b);
    }
    controls.append(list);
  }

  // User bowls: over/around the wicket, line, length (or drag the landing
  // ring), a variation, then stop the power meter. pitch is set only after a
  // drag; a Line/Length tap clears it so the ring snaps back to the preset.
  // The side carries over to the next ball (SPEC 15.2).
  const bowlPick = { side: 'over', line: 'off', length: 'good', pitch: null, variation: 'stock' };
  const SIDE_LABELS = { over: 'Over', around: 'Around' };
  const VARIATION_LABELS = {
    pace: { stock: 'Stock', in: 'Inswing', out: 'Outswing', slower: 'Slower' },
    spin: { stock: 'Stock', in: 'Turn in', out: 'Turn away', slower: 'Slower' },
  };
  function showBowlingControls() {
    controls.textContent = '';
    controls.className = 'pl-controls pl-bowling';
    const preview = () => scene.setMarker({ line: bowlPick.line, length: bowlPick.length, pitch: bowlPick.pitch, extra: null, travelMs: 1000 });
    // Where the ball would reach the batter at 100% accuracy, so a spot that
    // arrives wide shows as one before it is bowled (SPEC 15.1).
    const showArrival = () => {
      const { x, wide } = expectedArrival(bowlPick, strikerBats());
      scene.setArrivalMarker?.({ x, wide });
    };
    preview();
    showArrival();

    const lit = {};
    const light = () => {
      for (const [key, row] of Object.entries(lit)) {
        row.querySelectorAll('button').forEach((x) => x.classList.toggle('pl-picked', x.dataset.value === bowlPick[key]));
      }
      showArrival();
    };
    const group = (label, options, labels, key, onPick) => {
      const wrap = el('div', 'pl-seg');
      wrap.append(el('span', 'pl-label', label));
      const row = el('div', 'pl-seg-row');
      for (const opt of options) {
        const b = button('pl-btn pl-seg-btn', labels[opt], () => {
          if (meterRunning || done) return;
          bowlPick[key] = opt;
          onPick?.();
          light();
        });
        b.dataset.value = opt;
        row.append(b);
      }
      lit[key] = row;
      wrap.append(row);
      return wrap;
    };
    const snap = () => {
      bowlPick.pitch = null;
      preview();
    };
    const bowler = playerById(state, currentInnings(state).bowlerId);
    const variationLabels = VARIATION_LABELS[bowler?.bowlType === 'spin' ? 'spin' : 'pace'];
    // Over/Around: the bowler, umpire and non-striker move straight away.
    const sideGroup = group('Side', SIDES, SIDE_LABELS, 'side', () => {
      scene.setBowlingSide?.(bowlPick.side);
      commentary.textContent = `${bowler.name} switches to ${bowlPick.side} the wicket.`;
    });
    sideGroup.classList.add('pl-side');
    sideGroup.querySelectorAll('button').forEach((b) => b.classList.add('pl-side-btn'));
    controls.append(
      sideGroup,
      group('Line', LINES, LINE_LABELS, 'line', snap),
      group('Length', LENGTHS, LENGTH_LABELS, 'length', snap),
      group('Variation', VARIATIONS, variationLabels, 'variation'),
    );
    light();

    // Dragging the ring places the ball exactly; the matching buttons light up.
    scene.enableMarkerDrag?.((p) => {
      if (meterRunning || done) return;
      bowlPick.pitch = { x: p.x, z: p.z };
      bowlPick.line = lineFromX(p.x);
      bowlPick.length = lengthFromZ(p.z);
      light();
    });

    const meter = el('div', 'pl-meter');
    const needle = el('div', 'pl-needle');
    meter.append(el('div', 'pl-meter-green'), needle);
    const bowlBtn = button('pl-btn pl-go', 'Bowl', press);
    controls.append(meter, bowlBtn);

    let meterRunning = false;
    let meterStart = 0;
    let pos = 0;
    let done = false;
    function tick(now) {
      if (!meterRunning) return;
      const phase = ((now - meterStart) % METER_PERIOD_MS) / METER_PERIOD_MS;
      pos = phase < 0.5 ? phase * 2 : 2 - phase * 2;
      needle.style.left = `${pos * 100}%`;
      frame(tick);
    }
    function press() {
      if (done) return;
      if (!meterRunning) {
        meterRunning = true;
        scene.enableMarkerDrag?.(null);
        meterStart = performance.now();
        bowlBtn.textContent = 'Stop!';
        frame(tick);
        return;
      }
      done = true;
      meterRunning = false;
      bowlBtn.disabled = true;
      controls.querySelectorAll('button').forEach((b) => (b.disabled = true));
      const accuracy = Math.max(0, 1 - Math.abs(pos - 0.5) * 2);
      const bowl = { line: bowlPick.line, length: bowlPick.length, accuracy: Math.round(accuracy * 100) / 100, side: bowlPick.side };
      if (bowlPick.pitch) bowl.pitch = bowlPick.pitch;
      if (bowlPick.variation !== 'stock') bowl.variation = bowlPick.variation;
      deliver(bowl);
    }
    function onKey(e) {
      // A focused button already gets Enter/Space as a click.
      if (e.target instanceof HTMLButtonElement) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        press();
      }
    }
    setKeyHandler(onKey);
  }

  function deliver(bowl) {
    setKeyHandler(null);
    scene.enableMarkerDrag?.(null);
    scene.setArrivalMarker?.(null);
    const delivery = previewDelivery(state, bowl);
    const bat = aiBat(state, bowl);
    const result = playBall(state, bowl, bat);
    scene.setBatter?.({ bats: strikerBats(), offsetX: bat.offsetX ?? 0 });
    scene.setMarker(delivery);
    const accuracyText = `Accuracy ${Math.round(bowl.accuracy * 100)}%`;
    commentary.textContent = `${accuracyText}. ${playerById(state, currentInnings(state).bowlerId).name} runs in...`;
    speed.textContent = `${delivery.kph} kph`;
    scene.runUp(RUN_UP_MS);
    later(() => {
      const swing = bat.shot === 'leave'
        ? null
        : { shot: bat.shot, atMs: delivery.travelMs + clampMs(bat.timingMs), aimDeg: bat.aimDeg, aerial: bat.aerial };
      scene.release(delivery, { pre: result.ball, swing });
      // The result plays out from when the bat meets the ball (or the ball passes).
      const decided = bat.shot === 'leave' ? delivery.travelMs + 150 : delivery.travelMs + Math.max(0, clampMs(bat.timingMs));
      later(() => afterBall(result, accuracyText), decided);
    }, RUN_UP_MS);
  }

  const clampMs = (ms) => Math.max(-TIMING_WINDOWS.edge, Math.min(TIMING_WINDOWS.edge, ms ?? 0));

  // At most one keyboard handler is live at a time.
  let keyHandler = null;
  function setKeyHandler(fn) {
    if (keyHandler) document.removeEventListener('keydown', keyHandler);
    keyHandler = fn;
    if (fn) document.addEventListener('keydown', fn);
  }

  next();

  return function unmount() {
    alive = false;
    timeouts.forEach(clearTimeout);
    frames.forEach(cancelAnimationFrame);
    timeouts.clear();
    frames.clear();
    setKeyHandler(null);
    detachDrag();
    scene.enableMarkerDrag?.(null);
    scene.setArrivalMarker?.(null);
    scene.destroy();
    root.textContent = '';
  };
}
