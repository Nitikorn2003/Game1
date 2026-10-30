/**
 * Prints how fast the scripted player progresses in Lodelings. Run: npx tsx tools/balance.ts
 * (or through vitest: npx vitest run games/lodelings/test/balance.test.ts).
 */
import { ATTENTIVE, newBotGame, playActive } from '../games/lodelings/src/sim/bot.js';
import { formatDuration, formatNumber } from '../packages/engine/src/index.js';

const hours = Number(process.argv[2] ?? 4);
const state = newBotGame(7);
const report = playActive(state, hours * 3600, ATTENTIVE);
const marks = [2, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200];
for (const depth of marks) {
  const at = report.reached.get(depth);
  if (at !== undefined) console.log(`depth ${String(depth).padStart(3)}  ${formatDuration(at)}`);
}
for (const r of report.resurfaces) console.log(`resurface at ${formatDuration(r.seconds)} from depth ${r.depth} for ${r.dust} dust`);
console.log(`final depth ${state.depth} (best ${state.bestDepth}), ore ${formatNumber(state.ore)}, gems ${state.gems}, species ${Object.keys(state.roster).length}, guardian losses ${report.guardianLosses}`);
console.log(`team ${state.team.map((id) => `${id}:${state.roster[id]?.level}`).join(' ')}; gear ${JSON.stringify(state.gear)}; relics ${JSON.stringify(state.relics)}`);
if (report.nonFinite.length) console.log('NON-FINITE', report.nonFinite);
