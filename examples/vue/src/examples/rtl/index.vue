<script setup lang="ts">
import type { TreeJson } from "@fragiola/tree-vue";
import ItemNode from "./item-node.vue";
import * as styles from "./styles";
import { Tree, type Types } from "./tree";

// A tree in a right-to-left document. Nothing is configured: the engine reads the root's
// direction (`engine.get("direction")`), so Right and Left swap, and the styles use logical
// properties (`ps-*`, `start`/`end`), so the indentation and the chevrons mirror.
const json: TreeJson<Types> = {
    version: 1,
    rootItemIds: ["documents", "photos", "notes"],
    items: {
        documents: {
            kind: "folder",
            label: "المستندات",
            childItemIds: ["reports", "contract"],
        },
        reports: {
            kind: "folder",
            label: "التقارير",
            childItemIds: ["annual", "quarter"],
        },
        annual: { kind: "file", label: "التقرير السنوي.pdf" },
        quarter: { kind: "file", label: "الربع الأول.xlsx" },
        contract: { kind: "file", label: "العقد.docx" },
        photos: { kind: "folder", label: "الصور", childItemIds: ["trip"] },
        trip: { kind: "file", label: "رحلة.jpg" },
        notes: { kind: "file", label: "ملاحظات.txt" },
    },
    expandedItemIds: ["documents", "reports"],
};
</script>

<template>
    <!-- the direction comes from the document: here a wrapper, in an app often <html dir="rtl"> -->
    <div dir="rtl" lang="ar" :class="styles.frame">
        <p :class="styles.hint">
            السهم الأيسر <kbd :class="styles.kbd">←</kbd> يفتح المجلد،
            والسهم الأيمن <kbd :class="styles.kbd">→</kbd> يغلقه.
        </p>
        <Tree.Root :default-tree="json" aria-label="الملفات" :class="styles.root">
            <Tree.Items v-slot="{ item }">
                <ItemNode :item="item" />
            </Tree.Items>
        </Tree.Root>
    </div>
</template>
