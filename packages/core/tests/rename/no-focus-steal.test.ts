// @vitest-environment jsdom
// After a rename ends, however it ended, an unrelated command never pulls focus onto the item
// from a control of its row (the rename feature never keeps a stale renaming item).
import { expect, it } from "vitest";
import { mount } from "../engine/dom";
import { filesModel } from "../fixture";

for (const how of ["outside", "normal", "inside-then-outside"] as const) {
    it(`rename ended (${how}), then an unrelated command leaves focus on a row's button`, () => {
        const m = mount(filesModel());
        m.engine.run("focus", { itemId: "app" });
        const toolbar = document.createElement("button");
        document.body.append(toolbar);
        if (how === "outside") {
            toolbar.focus();
            m.model.run("item.start-rename", { itemId: "app" });
            m.model.run("item.cancel-rename", { itemId: "app" });
        } else if (how === "inside-then-outside") {
            m.model.run("item.start-rename", { itemId: "app" });
            const input = document.createElement("input");
            m.content("app").append(input);
            input.focus();
            toolbar.focus();
            m.engine.run("cancel-rename", { itemId: "app", focus: false });
            input.remove();
        } else {
            m.model.run("item.start-rename", { itemId: "app" });
            const input = document.createElement("input");
            m.content("app").append(input);
            input.focus();
            m.engine.run("commit-rename", { itemId: "app", label: "x.ts" });
            input.remove();
        }
        const button = document.createElement("button");
        m.content("app").append(button);
        button.focus();
        expect(document.activeElement).toBe(button);
        let pulled = 0;
        const item = m.item("app");
        const original = item.focus.bind(item);
        item.focus = (o?: FocusOptions) => {
            pulled++;
            original(o);
        };
        m.model.run("item.expand", { itemId: "utils" });
        expect(pulled).toBe(0);
        expect(document.activeElement).not.toBe(item);
        m.unmount();
        toolbar.remove();
    });
}
