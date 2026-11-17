import type { ExampleMeta } from "../meta-types";

export default {
    title: "Drag and drop",
    description:
        "Reorder and move items with the pointer, a line or a box showing where they land; locked items and a read-only folder refuse the drag.",
    category: "editing",
    order: 2,
    features: [
        "selection()",
        "dragAndDrop()",
        "DropIndicator",
        "item.move",
        "movable",
        "droppable",
        "announce",
        "LiveRegion",
    ],
    docs: "/docs/guides/drag-and-drop",
} satisfies ExampleMeta;
