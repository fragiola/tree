import type { ExampleMeta } from "../meta-types";

export default {
    title: "Inline rename",
    description:
        "F2 or a double click edits a label in place; a middleware refuses an empty name, a slash or a name a sibling already has.",
    category: "editing",
    order: 1,
    features: [
        "rename()",
        "useTreeItemRename",
        "item.start-rename",
        "model.use",
        "veto",
        "onRenameError",
    ],
    docs: "/docs/guides/rename",
} satisfies ExampleMeta;
