import { VariantDefinition } from '../Variant';
import { Action } from '../../action/Action';
import { ActionValidator } from '../../action/ActionPipeline';
import { GameState } from '../../state/GameState';
export declare class ColossusActionValidator implements ActionValidator {
    validate(action: Action, state: Readonly<GameState>): string | null;
}
export declare const ColossusVariant: VariantDefinition;
//# sourceMappingURL=ColossusVariant.d.ts.map