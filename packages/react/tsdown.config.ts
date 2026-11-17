import { defineConfig } from "tsdown";

export default defineConfig({
    // the main entry and one entry per opt-in feature (`@fragiola/tree-<framework>/<feature>`)
    entry: {
        index: "src/index.ts",
        selection: "src/selection/index.ts",
        checkboxes: "src/checkboxes/index.ts",
        rename: "src/rename/index.ts",
        "async-children": "src/async-children/index.ts",
        "type-ahead": "src/type-ahead/index.ts",
        virtualization: "src/virtualization/index.ts",
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
    // the declarations are built from src only: tsconfig.json also takes in the tests and the
    // configs, which import the repo's scripts/, and their declarations would be written there
    tsconfig: "tsconfig.build.json",
});
