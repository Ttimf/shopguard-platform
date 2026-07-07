import { EngineEvent } from '@app/contracts';

/** Контекст правила: позволяет публиковать производные события в шину. */
export interface RuleContext {
  emit(event: EngineEvent): Promise<void>;
}

/**
 * Правило движка событий. Расширяемо: новый класс реализует EventRule
 * и регистрируется в списке правил (RULES). Правило реагирует на входящие
 * события и может порождать производные (напр. SuspiciousActivity).
 */
export interface EventRule {
  readonly name: string;
  handle(event: EngineEvent, ctx: RuleContext): Promise<void>;
}
