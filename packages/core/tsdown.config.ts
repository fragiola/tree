import { defineConfig } from "tsdown";

export default defineConfig({
    // the main entry and one entry per opt-in feature (`@fragiola/tree/<feature>`): the main entry
    // never imports a feature's code (scripts/check-features.ts checks the built chunks)
    entry: {
        index: "src/index.ts",
        selection: "src/selection/index.ts",
        checkboxes: "src/checkboxes/index.ts",
        rename: "src/rename/index.ts",
        "async-children": "src/async-children/index.ts",
        "type-ahead": "src/type-ahead/index.ts",
        virtualization: "src/virtual/index.ts",
        "drag-and-drop": "src/drag-and-drop/index.ts",
        "drag-group": "src/drag-group/index.ts",
        "foreign-drop": "src/foreign-drop/index.ts",
        "drop-outside": "src/drop-outside/index.ts",
    },
    format: "esm",
    platform: "browser",
    dts: true,
    sourcemap: true,
    clean: true,
});
