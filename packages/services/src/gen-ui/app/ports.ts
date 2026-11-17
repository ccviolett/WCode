import type { Event } from "@wcode/rpc";
import type {
  GenUiScope,
  GenUiStateChange,
  GenUiStateEntry,
  GenUiStateTarget,
  GenUiWidgetState,
} from "@wcode/shared/gen-ui";
export interface GenUiStateStorage {
  get(target: GenUiStateTarget): Promise<GenUiWidgetState | null>;
  set(target: GenUiStateTarget, state: GenUiWidgetState): Promise<void>;
  list(scope: GenUiScope): Promise<GenUiStateEntry[]>;
  onChanged: Event<GenUiStateChange>;
  dispose(): void;
}
