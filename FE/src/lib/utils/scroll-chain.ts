/** Allocate one wheel gesture from the innermost scroller outwards. */
export function getScrollChainDeltas(delta: number, available: number[]): number[] {
  let remaining = Math.abs(delta);
  return available.map((room) => {
    const amount = Math.min(remaining, Math.max(0, room));
    remaining -= amount;
    return amount === 0 ? 0 : Math.sign(delta) * amount;
  });
}

type ScrollNode = Pick<HTMLElement, "scrollTop" | "scrollHeight" | "clientHeight">;

/** Cancel even the first, entirely inner wheel event, keeping one scroll owner. */
export function consumeScrollChain(event: Pick<WheelEvent, "preventDefault">, delta: number, chain: ScrollNode[]) {
  const room = chain.map((node) => Math.max(0, delta > 0
    ? node.scrollHeight - node.clientHeight - node.scrollTop
    : node.scrollTop));
  const amounts = getScrollChainDeltas(delta, room);
  event.preventDefault();
  chain.forEach((node, index) => {
    if (amounts[index]) node.scrollTop += amounts[index];
  });
}
