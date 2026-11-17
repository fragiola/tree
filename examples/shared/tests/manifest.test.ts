import { afterEach, describe, expect, it } from "vitest";
import { examplesApp } from "../scripts/examples-lib.ts";
import { buildManifest } from "../scripts/manifest.ts";
import { fakeApp } from "./fake-app.ts";

// The manifest builder serves every framework: the files of each example in its own app, and its
// framework's adapter package. The React manifest's equality with main's is checked by diffing the
// site export (the PR of the Epic that moved it here).

describe("the manifest", () => {
    let remove = () => {};
    afterEach(() => remove());

    it("lists a framework's example files, entry first, and its adapter package", async () => {
        const fake = fakeApp("vue", {
            "hello-tree/index.vue": [
                '<script setup lang="ts">',
                'import { Tree } from "@fragiola/tree-vue";',
                'import { X } from "@lucide/vue";',
                'import { styles } from "./styles";',
                'import Card from "../_kit/card.vue";',
                "</script>",
                "",
            ].join("\n"),
            "hello-tree/styles.ts": "export const styles = {};\n",
            "_kit/card.vue": "<template />\n",
        });
        remove = fake.remove;
        const manifest = await buildManifest(fake.app);
        expect(manifest.examples).toHaveLength(1);
        const [example] = manifest.examples;
        expect(example).toMatchObject({
            id: "hello-tree",
            level: "getting-started",
            layout: "fill",
            files: [
                "hello-tree/index.vue",
                "_kit/card.vue",
                "hello-tree/styles.ts",
            ],
            packages: ["@fragiola/tree-vue", "@lucide/vue"],
        });
        expect(manifest.files["hello-tree/index.vue"]?.lang).toBe("vue");
    });

    it("lists the React package for every React example", async () => {
        const manifest = await buildManifest(examplesApp("react"));
        expect(manifest.examples.length).toBeGreaterThan(0);
        for (const example of manifest.examples) {
            expect(example.packages[0], example.id).toBe(
                "@fragiola/tree-react",
            );
            expect(example.files[0], example.id).toBe(
                `${example.id}/index.tsx`,
            );
        }
    });
});
