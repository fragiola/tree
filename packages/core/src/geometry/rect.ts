// Rectangles in viewport pixels (what `getBoundingClientRect` gives), and what the drag reads of them.

export interface Rect {
    readonly top: number;
    readonly left: number;
    readonly width: number;
    readonly height: number;
}

/** An element's rect in viewport pixels. */
export function rectOf(element: Element): Rect {
    const { top, left, width, height } = element.getBoundingClientRect();
    return { top, left, width, height };
}

export function bottomOf(rect: Rect): number {
    return rect.top + rect.height;
}

export function rightOf(rect: Rect): number {
    return rect.left + rect.width;
}

/** Whether a point is inside a rect (edges included). */
export function containsPoint(rect: Rect, x: number, y: number): boolean {
    return (
        x >= rect.left &&
        x <= rightOf(rect) &&
        y >= rect.top &&
        y <= bottomOf(rect)
    );
}

/** The distance from a point to the inline-start edge of a rect: from the left in ltr, the right in rtl. */
export function inlineOffset(
    rect: Rect,
    x: number,
    direction: "ltr" | "rtl",
): number {
    return direction === "rtl" ? rightOf(rect) - x : x - rect.left;
}
