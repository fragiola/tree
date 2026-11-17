import type { ExampleMeta } from "../meta-types";

export default {
    title: "Keyboard",
    description:
        "The WAI-ARIA tree keyboard model with type-ahead and a keyboard drag, its keys listed beside the tree and the drag announced.",
    category: "accessibility",
    order: 1,
    features: [
        "selection()",
        "keyMap",
        "type-ahead",
        "start-keyboard-drag",
        "announce",
        "LiveRegion",
    ],
    docs: "/docs/guides/keyboard",
} satisfies ExampleMeta;
