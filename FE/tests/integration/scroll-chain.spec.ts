import { expect, test } from "@playwright/test";
import { consumeScrollChain, getScrollChainDeltas } from "../../src/lib/utils/scroll-chain";

test("keeps a wheel delta inside a list while there is room", () => {
  expect(getScrollChainDeltas(50, [100, 500])).toEqual([50, 0]);
});

test("passes leftover delta out in the same gesture", () => {
  expect(getScrollChainDeltas(120, [20, 500])).toEqual([20, 100]);
});

test("passes a whole delta out when already at the bottom", () => {
  expect(getScrollChainDeltas(80, [0, 500])).toEqual([0, 80]);
});

test("hands scrolling back upwards at the top", () => {
  expect(getScrollChainDeltas(-120, [15, 500])).toEqual([-15, -105]);
});

test("passes a whole upward gesture out when the list is already at the top", () => {
  expect(getScrollChainDeltas(-80, [0, 500])).toEqual([0, -80]);
});

test("handles multiple nested lists without exceeding their boundaries", () => {
  expect(getScrollChainDeltas(200, [10, 30, 60])).toEqual([10, 30, 60]);
});

test("handles empty and fractional deltas", () => {
  expect(getScrollChainDeltas(0, [0, 20])).toEqual([0, 0]);
  expect(getScrollChainDeltas(2.5, [0.5, 10])).toEqual([0.5, 2]);
});

for (const direction of [1, -1]) {
  test(`owns the first wheel and crosses the ${direction > 0 ? "bottom" : "top"} without a new gesture`, () => {
    const inner = { scrollTop: direction > 0 ? 0 : 40, clientHeight: 100, scrollHeight: 140 };
    const outer = { scrollTop: 200, clientHeight: 300, scrollHeight: 1000 };
    let cancellations = 0;
    const event = { preventDefault: () => { cancellations += 1; } };
    // The first two events fit wholly inside the list; they must still be canceled.
    consumeScrollChain(event, direction * 20, [inner, outer]);
    expect(cancellations).toBe(1);
    expect(outer.scrollTop).toBe(200);
    consumeScrollChain(event, direction * 20, [inner, outer]);
    consumeScrollChain(event, direction * 20, [inner, outer]);
    consumeScrollChain(event, direction * 20, [inner, outer]);
    expect(cancellations).toBe(4);
    expect(inner.scrollTop).toBe(direction > 0 ? 40 : 0);
    expect(outer.scrollTop).toBe(200 + direction * 40);
  });
}
