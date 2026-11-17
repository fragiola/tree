import type { ExampleMeta } from "../meta-types";

export default {
    title: "IDE explorer",
    description:
        "A code editor's workbench: a project tree with icons per language and git status, lazy node_modules, new files and folders, rename, delete and drag, and open editors that follow the tree.",
    category: "apps",
    order: 1,
    features: [
        "typed data",
        "selection()",
        "rename()",
        "asyncChildren()",
        "typeAhead()",
        "dragAndDrop()",
        "model.use veto",
        "batch",
        "item.add",
        "item.remove",
        "scroll-to",
        "useTreeItemRename",
    ],
    docs: "/docs/guides/drag-and-drop",
} satisfies ExampleMeta;
