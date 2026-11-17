import type { ExampleMeta } from "../meta-types";

export default {
    title: "File drop",
    description:
        "Drop files from your computer into the tree's folders, and drag rows out of the tree onto a trash zone that deletes them.",
    category: "editing",
    order: 4,
    features: [
        "dragAndDrop()",
        "foreignDrop()",
        "dropOutside()",
        "drop-outside-element",
        "item.add",
        "item.remove",
        "announce",
    ],
    docs: "/docs/guides/drag-and-drop",
} satisfies ExampleMeta;
