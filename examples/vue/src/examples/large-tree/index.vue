<script setup lang="ts">
import {
    type AnnounceEvent,
    createTreeModel,
    createTreeVirtualizer,
    type DropTarget,
    type TreeJson,
    type TreeModel,
    useTreeRef,
    useTreeState,
} from "@fragiola/tree-vue";
import { ChevronRight, File, Folder } from "@lucide/vue";
import { ref, watchEffect } from "vue";
import { Clickable } from "#/components/atoms/clickable";
import * as styles from "./styles";
import { Tree, type Types } from "./tree";

const FOLDERS = 1000;
const FILES = 100;

/** 1 000 folders of 100 files each: 101 000 items, every folder expanded. */
function largeTree(): TreeJson<Types> {
    const items: TreeJson<Types>["items"] = {};
    const rootItemIds: string[] = [];
    for (let f = 1; f <= FOLDERS; f++) {
        const folderId = `folder-${f}`;
        const childItemIds: string[] = [];
        for (let i = 1; i <= FILES; i++) {
            const fileId = `${folderId}-file-${i}`;
            childItemIds.push(fileId);
            items[fileId] = { kind: "file", label: `file ${f}.${i}.ts` };
        }
        rootItemIds.push(folderId);
        items[folderId] = {
            kind: "folder",
            label: `module ${f}`,
            childItemIds,
        };
    }
    return { version: 1, rootItemIds, items, expandedItemIds: rootItemIds };
}

// The virtualizer: the engine renders only the rows in view, plus 10 on each side. Each theme
// sizes the rows, so they are measured (estimated at 28px until then). Create it once: it holds
// options only, and another one would make another engine.
const virtual = createTreeVirtualizer({ estimateRowSize: 28, overscan: 10 });

/** The live region's text for each step of a drag (pointer or keyboard): the package writes none. */
function announcer(model: TreeModel<Types>) {
    const label = (itemId: string | null) =>
        itemId === null
            ? "the tree"
            : (model.get("item-by", { id: itemId })?.label ?? itemId);
    const where = (target: DropTarget) =>
        target.position === "inside"
            ? `into ${label(target.itemId)}`
            : `${target.position} ${label(target.itemId)}`;
    return (event: AnnounceEvent): string | undefined => {
        switch (event.type) {
            case "drag-start":
                return event.target
                    ? `Picked up. Drop ${where(event.target)}.`
                    : "Picked up.";
            case "drag-over":
                return event.target
                    ? `Drop ${where(event.target)}.`
                    : undefined;
            case "drop":
                return `Moved ${where(event.target)}.`;
            case "drag-cancel":
                return "Cancelled.";
            default:
                return undefined;
        }
    };
}

// The model is the source of truth: create it once (never in a ref).
const model = createTreeModel<Types>(largeTree());
const announce = announcer(model);
const tree = useTreeRef<Types>();
const visible = useTreeState<Types, number>(
    (_state, current) => current.get("visible-items").length,
    { model },
);
// how many rows the DOM holds: the engine's window, read again on a scroll (the engine's
// listeners) and on a change of the tree (the model's)
const rendered = ref(0);
watchEffect((onCleanup) => {
    const engine = tree.value?.engine;
    if (!engine) return;
    const read = () => {
        rendered.value = engine.get("virtual-window")?.rows.length ?? 0;
    };
    read();
    const stopEngine = engine.subscribe(read);
    const stopModel = model.subscribe(read);
    onCleanup(() => {
        stopEngine();
        stopModel();
    });
});
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.toolbar">
            <Clickable.Button
                variant="outline"
                size="sm"
                @click="model.run('tree.expand-all', {})"
            >
                Expand all
            </Clickable.Button>
            <Clickable.Button
                variant="outline"
                size="sm"
                @click="model.run('tree.collapse-all', {})"
            >
                Collapse all
            </Clickable.Button>
            <span :class="styles.count" data-testid="rendered">
                {{ rendered.toLocaleString("en") }} of
                {{ visible.toLocaleString("en") }} rows in the DOM
            </span>
        </div>
        <Tree.Root
            :model="model"
            :virtual="virtual"
            :tree-ref="tree"
            :indicator-inset="styles.indicatorInset"
            :announce="announce"
            aria-label="Large project"
            :class="styles.root"
        >
            <!-- flat rows: each item carries its level, position and set size; no Tree.Group -->
            <Tree.VirtualItems v-slot="{ item }">
                <Tree.Item :item="item" :class="styles.item">
                    <Tree.ItemContent :class="styles.row">
                        <Tree.Toggle :class="styles.toggle">
                            <ChevronRight aria-hidden="true" />
                        </Tree.Toggle>
                        <Folder
                            v-if="item.kind === 'folder'"
                            aria-hidden="true"
                            :class="styles.folderIcon"
                        />
                        <File v-else aria-hidden="true" :class="styles.fileIcon" />
                        <span :class="styles.label">{{ item.label }}</span>
                    </Tree.ItemContent>
                </Tree.Item>
            </Tree.VirtualItems>
            <Tree.DropIndicator :class="styles.dropIndicator" />
            <Tree.LiveRegion :class="styles.liveRegion" />
        </Tree.Root>
        <p :class="styles.hint">
            End, Home, PageDown and type-ahead reach any row; drag a row, the
            tree scrolls near its edges.
        </p>
    </div>
</template>
