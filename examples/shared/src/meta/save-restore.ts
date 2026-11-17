import type { ExampleMeta } from "../meta-types";

export default {
    title: "Save and restore",
    description:
        "The tree's JSON document is saved to localStorage after every change and restored on reload; Reset loads the default document again.",
    category: "data",
    order: 3,
    features: [
        "selection()",
        "tree-json",
        "model.subscribe",
        "tree.load",
        "createTreeModel",
    ],
    docs: "/docs/guides/persistence",
} satisfies ExampleMeta;
