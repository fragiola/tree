// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FileTree, filesModel } from "./tree";

// a server render, like the first client render, has no engine yet: what the features add to an
// item and the root is model state, so it is there already
describe("a render with no engine", () => {
    it("has the features' ARIA and data-*", () => {
        const model = filesModel({
            settings: { selectionMode: "multiple" },
            selectedItemIds: ["app"],
        });
        const html = renderToString(<FileTree model={model} />);
        expect(html).toContain('aria-multiselectable="true"');
        expect(html).toMatch(/aria-selected="true"[^>]*data-selected=""/);
        expect(html).toContain('aria-selected="false"');
    });
});
