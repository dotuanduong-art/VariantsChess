import { EffectHandler } from '../EffectHandler';
import { EffectType } from '../Effect';

export class AegisHandler implements EffectHandler {
  effectType = 'aegis' as EffectType;
  subscribesTo = [];

  handle(): void {}
}
