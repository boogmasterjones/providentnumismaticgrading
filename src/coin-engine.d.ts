/** The coin engine (src/scripts/coin-engine.js) attaches itself to window. */
type CoinRiver = { pause(): void; play(): void };
interface Window {
  CoinEngine: {
    river(host: HTMLElement, opts: Record<string, unknown>): CoinRiver;
    watch(el: Element, fn: (visible: boolean) => void): void;
    fillPlaceholders(root?: ParentNode): void;
  };
}
