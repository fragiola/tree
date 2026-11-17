import { type CommandEvent, veto } from "@fragiola/tree";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ROW } from "./setup";
import {
    content,
    FileTree,
    type FileTypes,
    filesModel,
    itemElement,
} from "./tree";

/** The y of a fraction of a row's height (the rows are stacked in render order). */
function rowY(label: string, fraction = 0.5): number {
    const rows = [...document.querySelectorAll('[data-tree-part="content"]')];
    const index = rows.indexOf(content(label));
    if (index < 0) throw new Error(`${label} is not rendered`);
    return index * ROW + fraction * ROW;
}

const move = (y: number) =>
    fireEvent.pointerMove(document, {
        clientX: 40,
        clientY: y,
        pointerId: 1,
        isPrimary: true,
    });

function press(label: string) {
    fireEvent.pointerDown(content(label), {
        clientX: 40,
        clientY: rowY(label),
        pointerId: 1,
        isPrimary: true,
        button: 0,
    });
    move(rowY(label) + 10);
}

function setup(model = filesModel()) {
    const events: CommandEvent<FileTypes>[] = [];
    model.subscribe((event) => events.push(event));
    render(
        <FileTree
            model={model}
            announce={(event) => (event.type === "drop" ? "Moved" : undefined)}
        />,
    );
    return { model, events };
}

describe("drag and drop", () => {
    it("drags an item with the pointer, shows the target and the indicator, and drops: one item.move", () => {
        const { model, events } = setup();
        press("readme.md");
        expect(itemElement("readme.md")).toHaveAttribute("data-dragging", "");
        expect(screen.getByRole("tree")).toHaveAttribute("data-dragging", "");
        // the top of app.ts: before it
        move(rowY("app.ts", 0.1));
        expect(content("app.ts")).toHaveAttribute("data-drop-target", "");
        expect(content("app.ts")).toHaveAttribute(
            "data-drop-position",
            "before",
        );
        const indicator = document.querySelector(
            '[data-tree-part="drop-indicator"]',
        );
        expect(indicator).toHaveAttribute("data-drop-position", "before");
        expect(indicator).toHaveAttribute("aria-hidden", "true");
        expect(indicator).toHaveStyle({ position: "absolute" });
        events.length = 0;
        act(() => {
            fireEvent.pointerUp(document, {
                clientX: 40,
                clientY: rowY("app.ts", 0.1),
                pointerId: 1,
            });
        });
        expect(events.map((event) => event.command)).toEqual(["item.move"]);
        expect(model.get("child-items-by", { itemId: "src" })[0]?.id).toBe(
            "readme",
        );
        expect(
            document.querySelector('[data-tree-part="drop-indicator"]'),
        ).toBeNull();
        expect(screen.getByRole("status")).toHaveTextContent("Moved");
        expect(itemElement("readme.md")).toHaveAttribute("aria-level", "2");
    });

    it("hides a target the model refuses (a locked folder)", () => {
        const model = filesModel();
        model.use((ctx, next) =>
            ctx.command === "item.move" &&
            (ctx.payload as { to: { parentItemId: string | null } }).to
                .parentItemId === "src"
                ? veto("src is locked")
                : next(),
        );
        setup(model);
        press("readme.md");
        move(rowY("app.ts", 0.5));
        expect(
            document.querySelector('[data-tree-part="drop-indicator"]'),
        ).toBeNull();
        expect(document.querySelector("[data-drop-target]")).toBeNull();
    });

    it("cancels a drag with Escape", () => {
        const { model, events } = setup();
        press("readme.md");
        act(() => {
            fireEvent.keyDown(screen.getByRole("tree"), { key: "Escape" });
        });
        fireEvent.pointerUp(document, {
            clientX: 40,
            clientY: 0,
            pointerId: 1,
        });
        expect(events.filter((event) => event.command === "item.move")).toEqual(
            [],
        );
        expect(model.state.rootItemIds).toEqual(["src", "readme"]);
        expect(itemElement("readme.md")).not.toHaveAttribute("data-dragging");
    });

    it("drags with the keyboard: start, step through the targets, drop with Enter", () => {
        const { model } = setup();
        act(() => itemElement("readme.md").focus());
        const key = (k: string, init: Partial<KeyboardEventInit> = {}) =>
            fireEvent.keyDown(document.activeElement ?? document.body, {
                key: k,
                ...init,
            });
        key("d", { ctrlKey: true, shiftKey: true });
        expect(screen.getByRole("tree")).toHaveAttribute(
            "data-keyboard-dragging",
            "",
        );
        key("ArrowUp");
        expect(document.querySelector("[data-drop-target]")).not.toBeNull();
        key("Enter");
        expect(model.state.rootItemIds).not.toEqual(["src", "readme"]);
        expect(screen.getByRole("tree")).not.toHaveAttribute(
            "data-keyboard-dragging",
        );
    });
});
