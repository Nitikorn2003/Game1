import type { RefObject } from 'preact';
import { useLayoutEffect, useState } from 'preact/hooks';
import { extentOf, layerOf, stackOf, type Slot } from '../sim/counter.js';
import { RACK, TRAY } from '../sim/round.js';

/** The size of an element's content box, kept up to date as the screen changes. */
export function useContentSize(ref: RefObject<HTMLElement>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const style = getComputedStyle(el);
      const width = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const height = el.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      setSize((old) => (old.width === width && old.height === height ? old : { width, height }));
    };
    measure();
    // Old WebViews have no ResizeObserver; there the window's size is all that changes.
    const Observer = (window as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    if (!Observer) {
      window.addEventListener('resize', measure);
      return () => {
        window.removeEventListener('resize', measure);
      };
    }
    const observer = new Observer(measure);
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [ref]);
  return size;
}

export function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** How much higher a tile is drawn for each layer under it, and for each tile under it in a stack, as a share of its size. */
export const LAYER_LIFT = 0.08;
export const STACK_LIFT = 0.075;
/** The edge of a tile under its face, as a share of its size. */
export const EDGE = 0.12;
/** The rim of the wooden board around the tiles on the counter, in pixels. */
export const RIM = 10;

/** The biggest and smallest a tile on the counter gets across, in pixels. */
const MAX_TILE = 66;
const MIN_TILE = 24;
/** The biggest a tile on the tray gets. */
const MAX_TRAY_TILE = 54;
/** The tiles on the cooling rack are this much smaller than those on the tray. */
const RACK_SCALE = 0.72;
/** Pixels between the places of the tray and the rack, and around them. */
const GAP = 4;
const PAD = 8;

/** Where a tile is drawn: its top left, how much it is scaled from its size on the counter, and what it is drawn over. */
export interface Spot {
  x: number;
  y: number;
  scale: number;
  z: number;
}

/** A strip of places: the tray or the cooling rack. */
export interface Strip {
  x: number;
  y: number;
  w: number;
  h: number;
  /** A tile's size in a place. */
  tile: number;
  /** The left edge of each place. */
  places: readonly number[];
}

/** Where everything on the table goes, in pixels from its top left, for a space and a counter. */
export interface Geometry {
  width: number;
  height: number;
  /** A tile's size on the counter. */
  tile: number;
  counter: { x: number; y: number; w: number; h: number };
  rack: Strip;
  tray: Strip;
  onCounter: (s: Slot) => Spot;
  onTray: (place: number) => Spot;
  onRack: (place: number) => Spot;
  /** Above the middle of the tray, where the whisk whips up its set. */
  whisked: (k: number) => Spot;
}

function strip(width: number, y: number, tile: number, count: number): Strip {
  const h = Math.round(tile * (1 + EDGE)) + 2 * PAD;
  const span = count * tile + (count - 1) * GAP;
  const x0 = Math.round((width - span) / 2);
  return { x: x0 - PAD, y, w: span + 2 * PAD, h, tile, places: Array.from({ length: count }, (_, i) => x0 + i * (tile + GAP)) };
}

export function geometryOf(space: { width: number; height: number }, slots: readonly Slot[]): Geometry {
  const { width, height } = space;
  const trayTile = Math.max(28, Math.min(MAX_TRAY_TILE, Math.floor((width - 2 * PAD - (TRAY - 1) * GAP) / TRAY)));
  const rackTile = Math.round(trayTile * RACK_SCALE);
  const trayH = Math.round(trayTile * (1 + EDGE)) + 2 * PAD;
  const rackH = Math.round(rackTile * (1 + EDGE)) + 2 * PAD;
  const tray = strip(width, height - trayH, trayTile, TRAY);
  const rack = strip(width, tray.y - rackH - GAP, rackTile, RACK);
  const area = { w: width - 2 * RIM, h: Math.max(60, rack.y - GAP - 2 * RIM) };
  const ext = extentOf(slots);
  const deepest = Math.max(0, ...slots.map((s) => stackOf(s.z)));
  const lift = LAYER_LIFT * Math.max(0, ext.layers - 1) + STACK_LIFT * deepest;
  const fit = Math.floor(Math.min(area.w / Math.max(1, ext.w / 2), area.h / (ext.h / 2 + EDGE + lift)));
  const tile = Math.max(MIN_TILE, Math.min(MAX_TILE, fit));
  const cw = (tile * ext.w) / 2;
  const ch = tile * (ext.h / 2 + EDGE + lift);
  const counter = { x: Math.round((width - cw) / 2), y: RIM + Math.round(Math.max(0, (area.h - ch) / 2)), w: cw, h: ch };
  const top = counter.y + tile * lift;
  return {
    width,
    height,
    tile,
    counter,
    rack,
    tray,
    onCounter: (s) => ({
      x: counter.x + (s.x * tile) / 2,
      y: top + (s.y * tile) / 2 - tile * (LAYER_LIFT * layerOf(s.z) + STACK_LIFT * stackOf(s.z)),
      scale: 1,
      // Higher tiles over lower ones, and in a layer the nearer rows over the farther.
      z: s.z * 20 + s.y + 1,
    }),
    onTray: (place) => ({ x: tray.places[place] ?? tray.x, y: tray.y + PAD, scale: trayTile / tile, z: 5000 + place }),
    onRack: (place) => ({ x: rack.places[place] ?? rack.x, y: rack.y + PAD, scale: rackTile / tile, z: 4000 + place }),
    whisked: (k) => ({ x: tray.places[2 + k] ?? tray.x, y: tray.y - trayTile * 0.95, scale: trayTile / tile, z: 6000 + k }),
  };
}
