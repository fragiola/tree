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
    },
    format: "esm",
    platform: "browser",
    dts: true,
    sourcemap: true,
    clean: true,
});
