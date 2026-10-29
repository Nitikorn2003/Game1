/**
 * Tries combinations of Lodelings balance numbers with the scripted player and prints the pace
 * for each. Run: npx tsx tools/sweep.ts
 */
import { BALANCE, GEAR } from '../games/lodelings/src/sim/content.js';
import { ATTENTIVE, newBotGame, playActive } from '../games/lodelings/src/sim/bot.js';

const minutes = (s: number | undefined) => (s === undefined ? '   -' : (s / 60).toFixed(0).padStart(4));
const base = structuredClone({ ...BALANCE, pickGrowth: GEAR.pick.growth });

const grid = {
  growth: [1.3, 1.36, 1.42],
  orePerHp: [0.01, 0.02, 0.04],
  costGrowth: [1.1],
  dustBonus: [0.05],
};

console.log('growth orePerHp cost dust |  d10  d20  d30  d40 | 1st resurface (min@depth dust) | depth@4h resurfaces');
for (const growth of grid.growth)
  for (const orePerHp of grid.orePerHp)
    for (const costGrowth of grid.costGrowth)
      for (const dustBonus of grid.dustBonus) {
        Object.assign(BALANCE, structuredClone(base));
        BALANCE.hpGrowth[0] = [80, growth];
        BALANCE.orePerHp = orePerHp;
        BALANCE.levelCostGrowth = costGrowth;
        BALANCE.dustDamageBonus = dustBonus;
        GEAR.pick.growth = costGrowth;
        const state = newBotGame(7);
        const r = playActive(state, 4 * 3600, ATTENTIVE);
        const first = r.resurfaces[0];
        console.log(
          `${growth.toFixed(2)}   ${orePerHp.toFixed(3)}  ${costGrowth.toFixed(2)} ${dustBonus.toFixed(2)} | ${minutes(r.reached.get(10))} ${minutes(r.reached.get(20))} ${minutes(r.reached.get(30))} ${minutes(r.reached.get(40))} | ${first ? `${minutes(first.seconds)}@${first.depth} ${first.dust}` : '   none'}`.padEnd(80) +
            `| ${state.bestDepth} ${r.resurfaces.length}`,
        );
      }
