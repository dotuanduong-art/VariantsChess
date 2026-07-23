import { EffectHandler } from '../EffectHandler';
import { EffectType } from '../Effect';

export class GhostHandler implements EffectHandler {
  effectType = 'ghost' as EffectType;
  subscribesTo = [];

  handle(): void {}
}
