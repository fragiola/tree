import type { ExampleMeta } from "../meta-types";

export default {
    title: "Large tree",
    description:
        "A hundred thousand items, all expanded, rendered as a window of the rows in view: scroll, keys, type-ahead and drag and drop.",
    category: "data",
    order: 4,
    features: [
        "createTreeVirtualizer",
        "VirtualItems",
        "virtual-window",
        "tree.expand-all",
        "item.move",
    ],
    docs: "/docs/guides/virtualization",
} satisfies ExampleMeta;
