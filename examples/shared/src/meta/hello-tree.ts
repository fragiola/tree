import type { ExampleMeta } from "../meta-types";

export default {
    title: "Hello tree",
    description:
        "The smallest styled tree: a JSON document, the recursion you own, and rows indented by their depth.",
    category: "getting-started",
    order: 1,
    features: [
        "Root",
        "Items",
        "Item",
        "ItemContent",
        "Toggle",
        "Group",
        "defaultTree",
    ],
    docs: "/docs/getting-started/first-tree",
} satisfies ExampleMeta;
