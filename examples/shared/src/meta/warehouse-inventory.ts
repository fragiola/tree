import type { ExampleMeta } from "../meta-types";

export default {
    title: "Warehouse inventory",
    description:
        "A warehouse's locations five levels deep, virtualized: stock totals and bin fill per subtree, low-stock flags, storage rules that hide refused drops, and a details panel.",
    category: "apps",
    order: 2,
    features: [
        "typed data",
        "virtualization()",
        "dragAndDrop()",
        "selection()",
        "model.use veto",
        "model.can",
        "item.set-data",
        "item.move",
        "batch",
        "derived state",
    ],
    docs: "/docs/guides/middleware",
} satisfies ExampleMeta;
