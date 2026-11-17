import type { ExampleMeta } from "../meta-types";

export default {
    title: "Multiple selection",
    description:
        "An organization chart in multiple selection mode: Ctrl or Cmd click toggles a person, Shift click selects a range, and a summary follows the selection.",
    category: "selection",
    order: 1,
    features: [
        "selectionMode",
        "item.select",
        "tree.select-all",
        "tree.clear-selection",
        "useTreeState",
    ],
    docs: "/docs/guides/selection",
} satisfies ExampleMeta;
