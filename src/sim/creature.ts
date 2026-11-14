import { tuning } from '../config';
import type { Point, CreatureStateName } from './types';

export class Creature {
  position: Point;
  state: CreatureStateName = 'stalk';
  stateTime = 0;
  windupSeconds = tuning.windupSeconds;
  private lungeTarget: Point = { x: 0, y: 0 };
  private lungeDirection: Point = { x: 0, y: 0 };

  constructor(start: Point) {
    this.position = { ...start };
  }

  beginWindup(target: Point): void {
    if (this.state !== 'stalk') return;
    this.state = 'windup';
    this.stateTime = 0;
    this.lungeTarget = { ...target };
  }

  advance(seconds: number, player: Point): void {
    this.stateTime += seconds;
    if (this.state === 'stalk') {
      const distance = Math.hypot(player.x - this.position.x, player.y - this.position.y);
      if (distance > 1) {
        const step = Math.min(distance, tuning.creatureStalkSpeed * seconds);
        this.position.x += ((player.x - this.position.x) / distance) * step;
        this.position.y += ((player.y - this.position.y) / distance) * step;
      }
    } else if (this.state === 'windup' && this.stateTime >= this.windupSeconds) {
      this.state = 'lunge';
      this.stateTime = 0;
      const distance = Math.hypot(this.lungeTarget.x - this.position.x, this.lungeTarget.y - this.position.y);
      const maxDistance = Math.min(distance, tuning.lungeMaxDistance);
      this.lungeDirection = distance > 0
        ? { x: (this.lungeTarget.x - this.position.x) / distance, y: (this.lungeTarget.y - this.position.y) / distance }
        : { x: 0, y: 0 };
      this.lungeTarget = {
        x: this.position.x + this.lungeDirection.x * maxDistance,
        y: this.position.y + this.lungeDirection.y * maxDistance,
      };
    } else if (this.state === 'lunge') {
      const distance = Math.hypot(this.lungeTarget.x - this.position.x, this.lungeTarget.y - this.position.y);
      const step = Math.min(distance, tuning.lungeSpeed * seconds);
      this.position.x += this.lungeDirection.x * step;
      this.position.y += this.lungeDirection.y * step;
      if (distance <= 1) {
        this.position = { ...this.lungeTarget };
        this.state = 'stalk';
        this.stateTime = 0;
      }
    } else if (this.state === 'recoil' && this.stateTime >= tuning.recoilSeconds) {
      this.state = 'stalk';
      this.stateTime = 0;
    }
  }

  hit(): void {
    this.state = 'recoil';
    this.stateTime = 0;
  }
}
