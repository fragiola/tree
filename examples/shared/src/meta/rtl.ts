import type { ExampleMeta } from "../meta-types";

export default {
    title: "Right to left",
    description:
        "A tree in a right-to-left document, in Arabic: the indentation and the chevrons mirror, and the Right and Left arrows swap.",
    category: "accessibility",
    order: 2,
    features: ['dir="rtl"', "direction", "logical properties"],
    docs: "/docs/guides/rtl",
} satisfies ExampleMeta;
