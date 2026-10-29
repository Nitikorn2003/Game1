import type { CSSProperties, JSX } from 'preact';
import { COLOURS, type JarStyle } from '../sim/content.js';
import { Glyph } from './Icon.js';

/** The colours a unit is drawn in, for the stylesheet. */
export function unitStyle(colour: number): CSSProperties {
  const c = COLOURS[colour] ?? COLOURS[0];
  return { '--fill': c.fill, '--glow': c.glow };
}

export interface JarArtProps {
  units: readonly number[];
  capacity: number;
  look: JarStyle;
  /** The top units that just arrived, which drop in. */
  arrived?: number;
  /** Bumped for every pour, so the drop plays again. */
  pourId?: number;
}

/** One jar, its units drawn from the bottom, each with its colour's symbol. */
export function JarArt(props: JarArtProps): JSX.Element {
  const { units, capacity } = props;
  const full = units.length === capacity && units.every((u) => u === units[0]);
  const arrived = props.arrived ?? 0;
  const style = { '--cap': capacity, ...(full ? { '--full-glow': (COLOURS[units[0] ?? 0] ?? COLOURS[0]).glow } : {}) } as CSSProperties;
  return (
    <span class={`jar jar--${props.look}${full ? ' jar--full' : ''}`} style={style}>
      <span class="jar__neck" />
      <span class="jar__body">
        <span class="jar__fill">
          {units.map((colour, i) => {
            const fresh = i >= units.length - arrived;
            // A unit on its own colour runs into the one below, like one pour of light.
            const joined = i > 0 && units[i - 1] === colour;
            return (
              <span
                key={fresh ? `${String(i)}-${String(props.pourId ?? 0)}` : String(i)}
                class={`unit${fresh ? ' unit--new' : ''}${joined ? ' unit--joined' : ''}`}
                style={unitStyle(colour)}
              >
                <Glyph name={(COLOURS[colour] ?? COLOURS[0]).symbol} />
              </span>
            );
          })}
        </span>
      </span>
    </span>
  );
}
