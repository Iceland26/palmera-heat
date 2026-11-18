// The story of Costa Palmera in five jobs. A small data-driven step engine:
// each step has an objective, an optional marker, optional dialogue, an enter
// hook and a check. Completing a job pays out and autosaves via the api.
export function createMissions(api) {
  let index = -1, stepIdx = 0, step = null, ctx = null, timer = null, finished = false;

  const MISSIONS = [
    {
      title: 'JOB 1 · FIRST WHEELS', reward: 300,
      steps: [
        {
          obj: 'Meet Sol Vega at his garage', marker: { x: 0, z: 99 },
          say: [['SOL', 'Nico Ferrer. Heard you drove trucks through three countries and never scratched one.'], ['SOL', 'My loaner coupe is sitting at the Yacht Club. Bring her home and we talk work.']],
          check: (c) => api.distTo(0, 99) < 8,
        },
        {
          obj: 'Pick up Sol\u2019s loaner coupe at the Yacht Club', markerFn: (c) => c.car ? c.car.mesh.position : { x: 134, z: 99 },
          enter: (c) => { c.car = api.spawnCar(134, 99, -Math.PI / 2, 0x3ec6b8, {}); },
          check: (c) => api.playerCar() === c.car,
        },
        {
          obj: 'Bring the coupe back to Sol\u2019s Garage', marker: { x: 0, z: 99 },
          check: (c) => api.playerCar() === c.car && api.distTo(0, 99) < 9,
        },
      ],
      outro: [['SOL', 'Clean. No dents, no cops. You are wasted on trucks, Nico.'], ['SOL', 'Marisol at the harbour pays better. Tell her Sol sent you.']],
    },
    {
      title: 'JOB 2 · HARBOUR RUN', reward: 450,
      steps: [
        {
          obj: 'Meet Marisol\u2019s man at Palmera Harbour', marker: { x: 198, z: 103 },
          say: [['MARISOL', 'Sol\u2019s boy. Good. A package leaves the harbour NOW — the buyer at Vista Plaza does not wait.'], ['MARISOL', 'And Nico — the harbour patrol watches that dock. Move.']],
          check: () => api.distTo(198, 103) < 9,
        },
        {
          obj: 'Deliver the package to Vista Plaza — fast', marker: { x: 88, z: 40 }, timed: 150,
          enter: () => { api.addHeat(1); api.subtitle('MARISOL', 'Patrol boat radioed your plates. Drive like the tide is coming in.', 4); },
          check: () => api.distTo(88, 40) < 10,
          fail: () => api.subtitle('MARISOL', 'The buyer walked. Circle back — he gives you one more window.', 4),
        },
      ],
      outro: [['MARISOL', 'On time and breathing. The plaza crew will remember that.']],
    },
    {
      title: 'JOB 3 · THREE-STAR GOODBYE', reward: 600,
      steps: [
        {
          obj: 'Roll past the Palmera PD precinct', marker: { x: -118, z: -100 },
          say: [['RICO', 'Word is you are a ghost, Ferrer. Ghosts do not scare anyone.'], ['RICO', 'Earn three stars outside the precinct — then lose them. Show me a legend.']],
          check: () => api.distTo(-118, -100) < 11,
        },
        {
          obj: 'Cause enough trouble to earn 3 stars', marker: null,
          say: [['', 'Ram, steal and shoot where the police can see. Trouble witnessed is trouble earned.']],
          check: () => api.getHeat() >= 3,
        },
        {
          obj: 'Now lose the heat', marker: null,
          check: () => api.getHeat() <= 0.4,
        },
      ],
      outro: [['RICO', 'Three stars, then nothing. Like you were never there.'], ['RICO', 'Fine. You are a legend. Marlin wants a word at his club.']],
    },
    {
      title: 'JOB 4 · MARLIN\u2019S YACHT PARTY', reward: 800,
      steps: [
        {
          obj: 'Go to the Marlin Yacht Club', marker: { x: 148, z: 99 },
          say: [['MARLIN', 'Ferrer. My club, my rules. My boys want to show you the door.']],
          check: () => api.distTo(148, 99) < 10,
        },
        {
          obj: 'Drop Marlin\u2019s three men', marker: { x: 148, z: 95 },
          enter: (c) => { c.rivals = api.spawnRivals([[139, 94], [157, 94], [148, 89]]); },
          check: (c) => c.rivals && c.rivals.every(r => r.dead),
          exit: () => api.clearRivals(),
        },
        {
          obj: 'Vanish — lose the heat', marker: null,
          check: () => api.getHeat() <= 0.4,
        },
      ],
      outro: [['MARLIN', 'Enough! The club is yours on weekends. Just — stop visiting on weekdays.']],
    },
    {
      title: 'JOB 5 · PALMERA SUNSET', reward: 1500,
      steps: [
        {
          obj: 'Every cop in Palmera is awake. Grab the pier cash drop', marker: { x: 60, z: 186 },
          enter: () => { api.setHeat(4); api.subtitle('MARISOL', 'Three drops, one sunset. The whole city is watching, Nico — give them a show.', 5); },
          check: () => api.distTo(60, 186) < 9,
        },
        {
          obj: 'Grab the harbour cash drop', marker: { x: 212, z: 108 },
          check: () => api.distTo(212, 108) < 9,
        },
        {
          obj: 'Grab the plaza cash drop', marker: { x: 74, z: -60 },
          check: () => api.distTo(74, -60) < 9,
        },
        {
          obj: 'Finish at the end of the pier', marker: { x: 60, z: 192 },
          check: () => api.distTo(60, 192) < 9,
        },
      ],
      outro: [['MARISOL', 'You own this sunset, Nico Ferrer. Palmera is yours.']],
    },
  ];

  function playSay(lines) {
    if (!lines) return;
    lines.forEach(([name, text], i) => {
      setTimeout(() => api.subtitle(name, text, 4.2), i * 3600);
    });
  }

  function loadStep() {
    const m = MISSIONS[index];
    step = m.steps[stepIdx];
    ctx = {};
    timer = step.timed || null;
    if (step.say) playSay(step.say);
    if (step.enter) step.enter(ctx);
  }

  function start(i) {
    index = i; stepIdx = 0; finished = false;
    if (index >= MISSIONS.length) { finished = true; step = null; return; }
    loadStep();
  }

  function completeMission() {
    const m = MISSIONS[index];
    if (step && step.exit) step.exit(ctx);
    playSay(m.outro);
    api.reward(m.reward);
    api.toast('JOB COMPLETE  +$' + m.reward);
    start(index + 1);
  }

  function update(dt) {
    if (finished || !step) return null;
    if (timer != null) {
      timer -= dt;
      if (timer <= 0) {
        if (step.fail) step.fail(ctx);
        if (step.enter) step.enter(ctx);
        timer = step.timed;
      }
    }
    let doneStep = false;
    try { doneStep = step.check(ctx); } catch { doneStep = false; }
    if (doneStep) {
      if (step.exit && stepIdx >= MISSIONS[index].steps.length - 1) { /* handled in complete */ }
      else if (step.exit) step.exit(ctx);
      stepIdx++;
      if (stepIdx >= MISSIONS[index].steps.length) completeMission();
      else loadStep();
    }
    // build the HUD view
    const m = MISSIONS[index];
    if (!step) return null;
    let marker = step.marker || null;
    if (step.markerFn) marker = step.markerFn(ctx);
    let obj = step.obj;
    if (timer != null) obj += `  (${Math.max(0, Math.ceil(timer))}s)`;
    return { title: m.title, objective: obj, marker };
  }

  return {
    start, update,
    get index() { return index; },
    get finished() { return finished; },
    get count() { return MISSIONS.length; },
  };
}
