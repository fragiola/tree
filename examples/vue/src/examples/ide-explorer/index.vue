<script setup lang="ts">
import {
    type AnnounceEvent,
    type CommandError,
    createTreeModel,
    useTreeRef,
    useTreeState,
} from "@fragiola/tree-vue";
import { DropIndicator } from "@fragiola/tree-vue/drag-and-drop";
import {
    ChevronsDownUp,
    FilePlus,
    FolderPlus,
    GitBranch,
    LocateFixed,
    Trash2,
} from "@lucide/vue";
import { onScopeDispose, ref, shallowRef } from "vue";
import { Clickable } from "#/components/atoms/clickable";
import Editor from "./editor.vue";
import {
    createPackageLoader,
    freeLabel,
    gitSummary,
    isManaged,
    type ProjectTypes,
    project,
} from "./project";
import ProjectItem from "./project-item.vue";
import * as styles from "./styles";
import { Tree } from "./tree";
import {
    createEditors,
    features,
    type ProjectModel,
    projectRules,
    reveal,
} from "./workspace";

let nextId = 0;

// the model is created once, outside Vue's reactivity
const model = createTreeModel<ProjectTypes, typeof features>(project(), {
    features,
});
// node_modules is listed from disk the first time it is opened (a fake, here)
const loadChildren = createPackageLoader();
// the open editors follow the model: selecting a file opens it, removing one closes it
const editors = createEditors(model);
const announce = announcer(model);
const tree = useTreeRef<ProjectTypes, typeof features>();
onScopeDispose(projectRules(model));
onScopeDispose(editors.destroy);

const activeFileId = shallowRef(editors.get().activeFileId);
onScopeDispose(
    editors.subscribe(() => {
        activeFileId.value = editors.get().activeFileId;
    }),
);
const selectedCount = useTreeState<ProjectTypes, number, typeof features>(
    (state) => state.selectedItemIds.length,
    { model },
);
const counts = useTreeState((_state, current) => gitSummary(current).counts, {
    model,
});
// the last thing the project refused, or did: shown in the status bar and announced
const notice = ref("");
const report = (error: CommandError | undefined) => {
    notice.value = error?.message ?? "";
};

/** Adds a file or a folder where an editor does: inside the focused folder, or beside the focused file. */
function create(kind: "file" | "folder") {
    const { focusedItemId } = model.state;
    const focused =
        focusedItemId === null
            ? undefined
            : model.get("item-by", { id: focusedItemId });
    const parentItemId =
        focused === undefined || isManaged(model, focused.id)
            ? null
            : focused.kind === "folder"
              ? focused.id
              : (model.get("item-parent-by", { itemId: focused.id })?.id ??
                null);
    const id = `new-${nextId++}`;
    const label =
        kind === "file"
            ? freeLabel(model, parentItemId, "untitled", ".ts")
            : freeLabel(model, parentItemId, "folder");
    // one step: the folder opens, the item appears first in it, selected, and its name is edited
    const result = model.run("batch", {
        commands: [
            ...(parentItemId !== null &&
            !model.is("item-expanded", { itemId: parentItemId })
                ? [
                      {
                          command: "item.expand" as const,
                          payload: { itemId: parentItemId },
                      },
                  ]
                : []),
            {
                command: "item.add",
                payload: {
                    item:
                        kind === "file"
                            ? {
                                  id,
                                  kind,
                                  label,
                                  data: { status: "untracked" },
                              }
                            : { id, kind, label, childItemIds: [] },
                    to: { parentItemId, index: 0 },
                },
            },
            { command: "item.select", payload: { itemId: id } },
            { command: "item.focus", payload: { itemId: id } },
            { command: "item.start-rename", payload: { itemId: id } },
        ],
    });
    report(result.ok ? undefined : result.error);
}

function removeSelection() {
    const itemIds = [...model.state.selectedItemIds];
    if (itemIds.length === 0) return;
    const result = model.run("item.remove", { itemIds });
    notice.value = result.ok
        ? `Deleted ${itemIds.length === 1 ? "1 item" : `${itemIds.length} items`}.`
        : result.error.message;
}

/** Reveal active file: its folders open (model), then it scrolls into view and takes focus (engine). */
function revealActive() {
    const fileId = activeFileId.value;
    if (fileId === null) return;
    reveal(model, fileId);
    const engine = tree.value?.engine;
    // the expanded folders render on the next frame; the engine scrolls to rendered rows only
    requestAnimationFrame(() => {
        engine?.run("scroll-to", { itemId: fileId, align: "center" });
        engine?.run("focus", { itemId: fileId });
    });
}

// the app's shortcut on the tree: Delete removes the selection (the tree's own keys run first)
function onKeydown(event: KeyboardEvent) {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key !== "Delete") return;
    event.preventDefault();
    removeSelection();
}

/** The live region's text: loads and drags (the package writes none). */
function announcer(current: ProjectModel) {
    const label = (itemId: string | null) =>
        itemId === null
            ? "the project"
            : (current.get("item-by", { id: itemId })?.label ?? itemId);
    return (event: AnnounceEvent): string | undefined => {
        switch (event.type) {
            case "load-error":
                return `Could not list ${label(event.itemId)}.`;
            case "drag-start":
                return `Picked up ${event.itemIds.map(label).join(", ")}.`;
            case "drop":
                return `Moved ${event.itemIds.map(label).join(", ")} ${
                    event.target.position === "inside"
                        ? `into ${label(event.target.itemId)}`
                        : `${event.target.position} ${label(event.target.itemId)}`
                }.`;
            case "drag-cancel":
                return "Move cancelled.";
            default:
                return undefined;
        }
    };
}
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.body">
            <section aria-label="Explorer" :class="styles.sideBar">
                <div :class="styles.sideBarHeader">
                    <h2 :class="styles.sideBarTitle">Explorer</h2>
                    <Clickable.Button
                        variant="icon"
                        shape="square"
                        aria-label="New file"
                        title="New file"
                        :class="styles.toolButton"
                        @click="create('file')"
                    >
                        <FilePlus aria-hidden="true" />
                    </Clickable.Button>
                    <Clickable.Button
                        variant="icon"
                        shape="square"
                        aria-label="New folder"
                        title="New folder"
                        :class="styles.toolButton"
                        @click="create('folder')"
                    >
                        <FolderPlus aria-hidden="true" />
                    </Clickable.Button>
                    <Clickable.Button
                        variant="icon"
                        shape="square"
                        aria-label="Reveal active file"
                        title="Reveal active file"
                        :disabled="activeFileId === null"
                        :class="styles.toolButton"
                        @click="revealActive"
                    >
                        <LocateFixed aria-hidden="true" />
                    </Clickable.Button>
                    <Clickable.Button
                        variant="icon"
                        shape="square"
                        aria-label="Collapse folders"
                        title="Collapse folders"
                        :class="styles.toolButton"
                        @click="model.run('tree.collapse-all', {})"
                    >
                        <ChevronsDownUp aria-hidden="true" />
                    </Clickable.Button>
                    <Clickable.Button
                        variant="icon"
                        shape="square"
                        aria-label="Delete"
                        title="Delete"
                        :disabled="selectedCount === 0"
                        :class="styles.toolButton"
                        @click="removeSelection"
                    >
                        <Trash2 aria-hidden="true" />
                    </Clickable.Button>
                </div>
                <Tree.Root
                    :model="model"
                    :tree-ref="tree"
                    :load-children="loadChildren"
                    :announce="announce"
                    expand-on-click
                    aria-label="Project files"
                    :class="styles.root"
                    @keydown="onKeydown"
                >
                    <Tree.Items v-slot="{ item }">
                        <ProjectItem :item="item" @rename-error="report" />
                    </Tree.Items>
                    <!-- where the drop lands: a line before or after a row, or the box of a folder -->
                    <DropIndicator :class="styles.dropIndicator" />
                    <Tree.LiveRegion :class="styles.liveRegion" />
                </Tree.Root>
            </section>
            <Editor :model="model" :editors="editors" />
        </div>
        <footer :class="styles.statusBar">
            <span :class="styles.statusItem">
                <GitBranch aria-hidden="true" />
                main
            </span>
            <span :class="styles.statusItem" data-testid="changes">
                {{ counts.modified }} modified, {{ counts.added + counts.untracked }} new
            </span>
            <span :class="styles.statusItem" data-testid="selection">
                {{ selectedCount }} selected
            </span>
            <span role="status" data-testid="notice" :class="styles.notice">{{ notice }}</span>
        </footer>
    </div>
</template>
