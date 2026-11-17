import type { ExampleMeta } from "../meta-types";

export default {
    title: "Controlled state",
    description:
        "The app's React state drives the expansion and the selection: buttons outside the tree change them, and the tree reports every change back.",
    category: "data",
    order: 2,
    features: [
        "selection()",
        "expandedItemIds",
        "onExpandedItemIdsChange",
        "selectedItemIds",
        "onSelectedItemIdsChange",
    ],
    docs: "/docs/guides/controlled-state",
} satisfies ExampleMeta;
