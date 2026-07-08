/**
 * Simple variable pool for storing node outputs.
 * Ported from graphon/runtime/variable_pool.py.
 *
 * Variables are keyed by a selector tuple (e.g. ["nodeA", "text"]).
 */

export class VariablePool {
  private readonly store = new Map<string, unknown>()

  /** Convert a selector array to a stable string key. */
  private static key(selector: string[]): string {
    return selector.join('\0')
  }

  set(selector: string[], value: unknown): void {
    this.store.set(VariablePool.key(selector), value)
  }

  get(selector: string[]): unknown {
    return this.store.get(VariablePool.key(selector))
  }

  /** Alias for set — mirrors the Python VariablePool.add() method. */
  add(selector: string[], value: unknown): void {
    this.set(selector, value)
  }

  has(selector: string[]): boolean {
    return this.store.has(VariablePool.key(selector))
  }

  delete(selector: string[]): boolean {
    return this.store.delete(VariablePool.key(selector))
  }

  clear(): void {
    this.store.clear()
  }

  get size(): number {
    return this.store.size
  }

  /** Iterate all entries. */
  entries(): IterableIterator<[string, unknown]> {
    return this.store.entries()
  }
}
