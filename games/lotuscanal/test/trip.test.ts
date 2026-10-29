import { describe, expect, it } from 'vitest';
import { CANALS, STOPS_PER_CANAL } from '../src/sim/content.js';
import { canalFinishedBy, canalsDone, placeOf, TRIP_LEVELS } from '../src/sim/trip.js';

describe('the trip along the canals', () => {
  it('puts ten levels on each canal, one after another', () => {
    expect(TRIP_LEVELS).toBe(CANALS.length * STOPS_PER_CANAL);
    expect(placeOf(1)).toEqual({ index: 0, canal: 'landing', stop: 0 });
    expect(placeOf(10)).toEqual({ index: 0, canal: 'landing', stop: 9 });
    expect(placeOf(11)).toEqual({ index: 1, canal: 'mango', stop: 0 });
    expect(placeOf(TRIP_LEVELS)).toEqual({ index: CANALS.length - 1, canal: 'sunrise', stop: 9 });
    expect(placeOf(TRIP_LEVELS + 1)).toBeNull();
    expect(placeOf(0)).toBeNull();
  });

  it('finishes a canal on its last stop only', () => {
    expect(canalFinishedBy(10)).toBe('landing');
    expect(canalFinishedBy(20)).toBe('mango');
    expect(canalFinishedBy(15)).toBeNull();
    expect(canalFinishedBy(TRIP_LEVELS)).toBe('sunrise');
    expect(canalFinishedBy(TRIP_LEVELS + 10)).toBeNull();
  });

  it('counts the canals behind the boat', () => {
    expect(canalsDone(0)).toBe(0);
    expect(canalsDone(9)).toBe(0);
    expect(canalsDone(10)).toBe(1);
    expect(canalsDone(TRIP_LEVELS + 40)).toBe(CANALS.length);
  });
});
