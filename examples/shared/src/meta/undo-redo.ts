import type { ExampleMeta } from "../meta-types";

export default {
    title: "Undo and redo",
    description:
        "Undo and redo written as app code over the command bus: renames, deletions and drags become steps, with buttons and Ctrl+Z.",
    category: "model-api",
    order: 1,
    features: [
        "model.subscribe",
        "tree-json",
        "tree.load",
        "item.remove",
        "useSyncExternalStore",
    ],
    docs: "/docs/guides/undo-redo",
} satisfies ExampleMeta;
