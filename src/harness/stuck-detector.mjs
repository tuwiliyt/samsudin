/**
 * Stuck Detector for Samsudin (inspired by OpenHands' StuckDetector).
 *
 * Free/open-weights models frequently fall into unproductive loops. The detector watches
 * the (action, observation) history and flags three pathological patterns:
 *   1. repeat-observation : same action -> same observation, `repeatObservation`+ times in a row
 *   2. repeat-error       : same action -> error, `repeatError`+ times in a row
 *   3. ping-pong          : two distinct action/observation pairs alternating, `pingPongCycles`+ cycles
 */

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

/** Strip volatile fragments (timestamps, durations, long numeric ids) before comparing observations. */
export function normalizeObservation(text = '') {
  return String(text)
    .replace(/\d{4}-\d{2}-\d{2}[T ][\d:.]+Z?/g, '<ts>')
    .replace(/"?durationMs"?\s*[:=]\s*\d+/gi, 'durationMs=<n>')
    .replace(/\b\d{9,}\b/g, '<id>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

export class StuckDetector {
  constructor({ repeatObservation = 4, repeatError = 3, pingPongCycles = 3, maxHistory = 40 } = {}) {
    this.repeatObservation = repeatObservation;
    this.repeatError = repeatError;
    this.pingPongCycles = pingPongCycles;
    this.maxHistory = maxHistory;
    this.events = [];
  }

  reset() {
    this.events = [];
  }

  record({ name, args = {}, observation = '', isError = false }) {
    const action = `${name}:${stableStringify(args)}`;
    const obs = normalizeObservation(observation);
    this.events.push({ name, action, obs, isError: Boolean(isError), pair: `${action}=>${obs}` });
    if (this.events.length > this.maxHistory) this.events.shift();
  }

  check() {
    const e = this.events;

    // 2. Repeated action -> error
    if (e.length >= this.repeatError) {
      const tail = e.slice(-this.repeatError);
      if (tail.every(x => x.isError && x.action === tail[0].action)) {
        return {
          stuck: true,
          pattern: 'repeat-error',
          reason: `'${tail[0].name}' failed ${this.repeatError}+ times in a row with the same arguments`
        };
      }
    }

    // 1. Repeated action -> identical observation
    if (e.length >= this.repeatObservation) {
      const tail = e.slice(-this.repeatObservation);
      if (tail.every(x => x.pair === tail[0].pair)) {
        return {
          stuck: true,
          pattern: 'repeat-observation',
          reason: `'${tail[0].name}' returned the same result ${this.repeatObservation}+ times in a row`
        };
      }
    }

    // 3. Ping-pong between two distinct pairs
    const window = this.pingPongCycles * 2;
    if (e.length >= window) {
      const tail = e.slice(-window);
      const a = tail[0].pair;
      const b = tail[1].pair;
      if (a !== b && tail.every((x, i) => x.pair === (i % 2 === 0 ? a : b))) {
        return {
          stuck: true,
          pattern: 'ping-pong',
          reason: `alternating between two actions for ${this.pingPongCycles}+ cycles without progress`
        };
      }
    }

    return { stuck: false };
  }
}
