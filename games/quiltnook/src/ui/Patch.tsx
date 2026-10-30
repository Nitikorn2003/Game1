import type { JSX } from 'preact';
import type { FabricSetId } from '../sim/content.js';
import { SHAPES, type ShapeId } from '../sim/shapes.js';
import { fabricStyle, lookOf } from './fabrics.js';

/** A patch drawn square by square, `cell` pixels to a square. */
export function PatchArt(props: { shape: ShapeId; fabric: number; set: FabricSetId; cell: number; class?: string }): JSX.Element {
  const shape = SHAPES[props.shape];
  const look = fabricStyle(lookOf(props.set, props.fabric));
  return (
    <div class={`patch ${props.class ?? ''}`} style={{ width: `${shape.width * props.cell}px`, height: `${shape.height * props.cell}px` }}>
      {shape.cells.map(([x, y]) => (
        <span key={`${x},${y}`} class="sq sq--sewn" style={{ ...look, left: `${x * props.cell}px`, top: `${y * props.cell}px`, width: `${props.cell}px`, height: `${props.cell}px` }} />
      ))}
    </div>
  );
}
