import type { ExampleMeta } from "../meta-types";

export default {
    title: "File explorer",
    description:
        "Folders and files with icons by kind, sizes read from typed item data, and a click that opens a folder.",
    category: "getting-started",
    order: 2,
    features: [
        "selection()",
        "expandOnClick",
        "item.data",
        "useTreeState",
        "--tree-depth",
    ],
    docs: "/docs/guides/styling-tailwind",
} satisfies ExampleMeta;
