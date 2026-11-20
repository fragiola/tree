import type { ExampleMeta } from "../meta-types";

export default {
    title: "Warehouse control",
    description:
        "A live control room: a narrow tree of sites, zones, aisles and bins whose totals and low-stock flags follow a seeded stock feed, beside key figures, a fill chart, the feed and a table.",
    category: "apps",
    order: 5,
    features: [
        "typed data",
        "selection()",
        "dragAndDrop()",
        "item.set-data",
        "batch",
        "model.use veto",
        "derived state",
        "live data",
    ],
    docs: "/docs/guides/middleware",
    layout: "fill",
    height: 600,
} satisfies ExampleMeta;
