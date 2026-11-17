// A tree ref in a compiled template: `<Tree.Root :tree-ref="tree">` passes the tree ref itself, and
// the template reads `tree.value`. Vue's compiler unwraps a top-level ref (`unref(tree)` in a
// `<script setup>`, the `proxyRefs` of `setup()`'s bindings with the runtime compiler), so these
// templates are compiled by Vue's own compiler, as an app's are, not written as render functions.

import { describe, expect, it } from "vitest";
import * as Vue from "vue";
import { compileScript, compileTemplate, parse } from "vue/compiler-sfc";
import * as TreeVue from "../src";
import { createTreeRef, type TreeRef } from "../src";
import * as fixtures from "./tree";
import { bareFiles, type FileTypes, fire, render, settle, Tree } from "./tree";

const TEMPLATE = `
<button type="button" data-testid="collapse" :disabled="!tree.value"
    @click="tree.value?.model.run('tree.collapse-all', {})">Collapse all</button>
<button type="button" data-testid="toggle" @click="shown = !shown">Toggle</button>
<Tree.Root v-if="shown" :tree-ref="tree" :default-tree="bareFiles()" aria-label="Files">
    <Tree.Items v-slot="{ item }"><FileItem :item="item" /></Tree.Items>
</Tree.Root>`;

/** the modules a compiled `<script setup>` imports */
const MODULES: Record<string, Record<string, unknown>> = {
    vue: Vue,
    "@fragiola/tree-vue": TreeVue,
    "./tree": fixtures,
};

/**
 * Compiles a single-file component as `@vitejs/plugin-vue` does in production (the template
 * inlined in `<script setup>`), and evaluates it with `MODULES` as its imports.
 */
function compileSfc(source: string): Vue.Component {
    const { descriptor, errors } = parse(source, { filename: "app.vue" });
    if (errors.length > 0) throw errors[0];
    const { content } = compileScript(descriptor, {
        id: "app",
        inlineTemplate: true,
    });
    const code = content
        .replace(
            /^import \{([^}]*)\} from "([^"]+)";?$/gm,
            (_, names: string, from: string) =>
                `const {${names.replaceAll(" as ", ": ")}} = modules[${JSON.stringify(from)}];`,
        )
        .replace(/^export default /m, "return ");
    return new Function("modules", code)(MODULES) as Vue.Component;
}

/** Compiles a template as Vue's runtime compiler does (`defineComponent({ template })`). */
function compileRender(template: string): Vue.RenderFunction {
    const { code, errors } = compileTemplate({
        source: template,
        filename: "app.vue",
        id: "app",
        compilerOptions: { mode: "function" },
    });
    if (errors.length > 0) throw errors[0];
    return new Function("Vue", code)(Vue) as Vue.RenderFunction;
}

const testId = (id: string) => {
    const element = document.querySelector<HTMLElement>(
        `[data-testid="${id}"]`,
    );
    if (!element) throw new Error(`no element "${id}"`);
    return element;
};
const items = () => document.querySelectorAll('[role="treeitem"]');

/** mounts `App`, then checks the tree ref through the template's buttons and `tree` */
async function expectTreeRefWorks(
    App: Vue.Component,
    tree: () => TreeRef<FileTypes>,
) {
    await render(() => Vue.h(App));
    // the root mounted: the handle is attached, and the button bound to it re-rendered
    expect(tree().value?.model.get("visible-items")).toHaveLength(5);
    expect(testId("collapse")).toBeEnabled();
    await fire(testId("collapse"), "click");
    expect(items()).toHaveLength(2);
    // the root unmounted: the handle is detached, and the button re-rendered
    await fire(testId("toggle"), "click");
    expect(items()).toHaveLength(0);
    expect(tree().value).toBeNull();
    expect(testId("collapse")).toBeDisabled();
    // mounted again: attached again
    await fire(testId("toggle"), "click");
    await settle();
    expect(tree().value).not.toBeNull();
    expect(testId("collapse")).toBeEnabled();
}

describe("a tree ref in a compiled template", () => {
    it('`:tree-ref="tree"` works in a <script setup> single-file component', async () => {
        let tree: TreeRef<FileTypes> | undefined;
        const App = compileSfc(`
<script setup>
import { ref } from "vue";
import { useTreeRef } from "@fragiola/tree-vue";
import { bareFiles, FileItem, Tree } from "./tree";

const tree = useTreeRef();
const shown = ref(true);
defineExpose({ tree });
</script>
<template>${TEMPLATE}</template>`);
        const Probe = Vue.defineComponent({
            setup() {
                const app = Vue.ref<{ tree: TreeRef<FileTypes> } | null>(null);
                Vue.watchEffect(() => {
                    if (app.value) tree = app.value.tree;
                });
                return () => Vue.h(App, { ref: app });
            },
        });
        await expectTreeRefWorks(Probe, () => {
            if (!tree) throw new Error("no tree ref exposed");
            return tree;
        });
    });

    it('`:tree-ref="tree"` works in a template compiled at run time, with setup() bindings', async () => {
        const tree = createTreeRef<FileTypes>();
        const App = Vue.defineComponent({
            components: {
                FileItem: fixtures.FileItem,
                "Tree.Root": Tree.Root,
                "Tree.Items": Tree.Items,
            },
            setup: () => ({ tree, shown: Vue.ref(true), bareFiles }),
            render: compileRender(TEMPLATE),
        });
        await expectTreeRefWorks(App, () => tree);
    });

    it("a ref of the app's own is refused, with what to pass instead", async () => {
        const errors: unknown[] = [];
        const App = Vue.defineComponent({
            setup: () => () =>
                Vue.h(Tree.Root, {
                    treeRef: Vue.shallowRef(
                        null,
                    ) as unknown as TreeRef<FileTypes>,
                    defaultTree: bareFiles(),
                }),
        });
        await render(() =>
            Vue.h(
                Vue.defineComponent({
                    setup() {
                        Vue.onErrorCaptured((error) => {
                            errors.push(error);
                            return false;
                        });
                        return () => Vue.h(App);
                    },
                }),
            ),
        );
        expect(String(errors[0])).toMatch(/useTreeRef or createTreeRef/);
    });
});
