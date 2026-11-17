"use client";

import { type ItemOf, Tree, type TreeJson } from "@fragiola/tree-react";
import { ChevronRight, File, Folder } from "lucide-react";
import * as styles from "./styles";

type Types = { items: { folder: undefined; file: undefined } };

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

export default function RightToLeft() {
    return (
        // the direction comes from the document: here a wrapper, in an app often <html dir="rtl">
        <div dir="rtl" lang="ar" className={styles.frame}>
            <p className={styles.hint}>
                السهم الأيسر <kbd className={styles.kbd}>←</kbd> يفتح المجلد،
                والسهم الأيمن <kbd className={styles.kbd}>→</kbd> يغلقه.
            </p>
            <Tree.Root<Types>
                defaultTree={json}
                aria-label="الملفات"
                className={styles.root}
            >
                <Tree.Items<Types>>{(item) => <Item item={item} />}</Tree.Items>
            </Tree.Root>
        </div>
    );
}

function Item({ item }: { item: ItemOf<Types> }) {
    return (
        <Tree.Item item={item} className={styles.item}>
            <Tree.ItemContent className={styles.row}>
                {/* the chevron points to the inline end: mirrored in rtl (styles.ts) */}
                <Tree.Toggle className={styles.toggle}>
                    <ChevronRight aria-hidden />
                </Tree.Toggle>
                {item.kind === "folder" ? (
                    <Folder aria-hidden className={styles.folderIcon} />
                ) : (
                    <File aria-hidden className={styles.fileIcon} />
                )}
                <span className={styles.label}>{item.label}</span>
            </Tree.ItemContent>
            <Tree.Group<Types>>{(child) => <Item item={child} />}</Tree.Group>
        </Tree.Item>
    );
}
