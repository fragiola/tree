import "@testing-library/jest-dom/vitest";
import { enableAutoUnmount } from "@vue/test-utils";
import { afterEach } from "vitest";

// every wrapper mounted by a test unmounts after it, as Testing Library's cleanup does
enableAutoUnmount(afterEach);
afterEach(() => {
    // a test file in the node environment (server rendering) has no document
    if (typeof document !== "undefined") document.body.innerHTML = "";
});

/** The height of a row (`Tree.ItemContent`) in the tests' fake layout. */
export const ROW = 20;
export const WIDTH = 300;

// jsdom lays nothing out: every row gets a rect from its place among the rendered rows of its
// tree (stacked from the top, 20px each), and a root the size of its rows, so the engine's
// hit-testing and drop indicator work as in a browser (the fake layout of packages/react's tests)
if (typeof window !== "undefined") {
    Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
        configurable: true,
        value: function getBoundingClientRect(this: HTMLElement) {
            const part = this.getAttribute("data-tree-part");
            const root = this.closest('[data-tree-part="root"]');
            const rows = root
                ? [...root.querySelectorAll('[data-tree-part="content"]')]
                : [];
            const index = part === "content" ? rows.indexOf(this) : -1;
            const top = index >= 0 ? index * ROW : 0;
            const height =
                index >= 0 ? ROW : part === "root" ? rows.length * ROW : 0;
            return {
                top,
                left: 0,
                width: WIDTH,
                height,
                right: WIDTH,
                bottom: top + height,
                x: 0,
                y: top,
                toJSON: () => ({}),
            };
        },
    });
}
