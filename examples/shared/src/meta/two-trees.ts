import type { ExampleMeta } from "../meta-types";

export default {
    title: "Two trees",
    description:
        "Drag items between two lists by pointer and keyboard: a transfer between two models, or a move over one shared model.",
    category: "editing",
    order: 3,
    features: [
        "dragGroup",
        "transfer",
        "item.add",
        "item.remove",
        "item.move",
        "announce",
    ],
    docs: "/docs/guides/drag-and-drop",
} satisfies ExampleMeta;
