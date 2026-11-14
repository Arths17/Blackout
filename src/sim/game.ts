import { tuning } from '../config';
import { routes } from './routes';
import { Creature } from './creature';
import { Surge } from './surge';
import type { Point, SimEvent } from './types';

export class GameSim {
  readonly player: Point = { x: 165, y: 330 };
  readonly creature: Creature;
  events: SimEvent[] = [];
  surge: Surge | null = null;
  elapsed = 0;

  constructor(creatureStart: Point = { x: 700, y: 280 }) {
    this.creature = new Creature(creatureStart);
  }

  throwBreaker(index = 0): boolean {
    if (this.surge || this.creature.state !== 'stalk') return false;
    this.surge = new Surge(routes[index], index);
    this.creature.beginWindup(routes[index].points[0]);
    this.events.push({ type: 'relayClick', breaker: index });
    return true;
  }

  advance(seconds = 1 / 60): SimEvent[] {
    this.elapsed += seconds;
    this.events = [];
    this.creature.advance(seconds, this.player);
    if (this.surge) {
      const hits = this.surge.advance(seconds, this.creature.position, this.player);
      for (const hit of hits) {
        if (hit.target === 'creature') {
          this.creature.hit();
          this.events.push({ type: 'shock', breaker: this.surge.breaker, position: hit.position });
          this.events.push({ type: 'recoil' });
        } else {
          this.events.push({ type: 'playerHit', position: hit.position });
        }
      }
      if (this.surge.finished) {
        if (!this.surge.creatureHit) this.events.push({ type: 'miss' });
        this.surge = null;
      }
    }
    return this.events;
  }

  runUntilSurgeEnds(maxSeconds = 10): SimEvent[] {
    const result: SimEvent[] = [];
    for (let i = 0; i < maxSeconds * 60 && this.surge; i += 1) result.push(...this.advance());
    return result;
  }
}
