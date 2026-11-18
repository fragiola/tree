import type { ExampleMeta } from "../meta-types";

export default {
    title: "Task board",
    description:
        "Projects, epics, tasks and subtasks with status, priority and assignees: checks for done work with progress per parent, a board that takes rows dropped out of the tree, filters, inline add and undo.",
    category: "apps",
    order: 3,
    features: [
        "typed data",
        "checkboxes() cascade",
        "selection()",
        "rename()",
        "dragAndDrop()",
        "dropOutside()",
        "drop-outside-element",
        "model.use veto",
        "batch",
        "undo/redo",
    ],
    docs: "/docs/guides/checkboxes",
} satisfies ExampleMeta;
