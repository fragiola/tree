"use client";

import {
    createTreeModel,
    type ItemOf,
    Tree,
    useTree,
    useTreeItem,
    useTreeState,
} from "@fragiola/tree-react";
import { checkboxes } from "@fragiola/tree-react/checkboxes";
import { Check, ChevronRight, Minus } from "lucide-react";
import { useState } from "react";
import { type PermissionTypes, permissions } from "../_kit/data";
import * as styles from "./styles";

// The kit's permissions are checked in cascade (`settings.checkMode: "cascade"`): checking a group
// checks its permissions, and a group with only some of them checked is mixed. `checkboxes()`
// puts `aria-checked` on every item, and makes Space toggle the focused item's check (the tree
// has no selection to give Space to).

/** The opt-in features of the model: the checks. */
const features = [checkboxes()] as const;

export default function Checkboxes() {
    const [model] = useState(() =>
        createTreeModel<PermissionTypes, typeof features>(permissions(), {
            features,
        }),
    );
    // the scopes the app would save: the checked permissions (a group is only a shortcut)
    const scopes = useTreeState<PermissionTypes, string, typeof features>(
        (state) =>
            state.checkedItemIds
                .flatMap((itemId) => {
                    const item = state.items[itemId];
                    return item?.kind === "permission" ? [item.data.scope] : [];
                })
                .join(" "),
        { model },
    );

    return (
        <div className={styles.frame}>
            <Tree.Root<PermissionTypes, typeof features>
                model={model}
                aria-label="Permissions"
                className={styles.root}
            >
                <Tree.Items<PermissionTypes>>
                    {(item) => <PermissionItem item={item} />}
                </Tree.Items>
            </Tree.Root>
            <section aria-label="Granted scopes" className={styles.readout}>
                <h2 className={styles.readoutTitle}>Granted scopes</h2>
                <ul data-testid="scopes" className={styles.scopes}>
                    {scopes === "" ? (
                        <li className={styles.empty}>None</li>
                    ) : (
                        scopes.split(" ").map((scope) => (
                            <li key={scope} className={styles.scope}>
                                {scope}
                            </li>
                        ))
                    )}
                </ul>
            </section>
        </div>
    );
}

function PermissionItem({ item }: { item: ItemOf<PermissionTypes> }) {
    return (
        <Tree.Item item={item} className={styles.item}>
            <Tree.ItemContent className={styles.row}>
                <Tree.Toggle className={styles.toggle}>
                    <ChevronRight aria-hidden />
                </Tree.Toggle>
                <CheckControl item={item} />
                <span className={styles.label}>{item.label}</span>
            </Tree.ItemContent>
            <Tree.Group<PermissionTypes>>
                {(child) => <PermissionItem item={child} />}
            </Tree.Group>
        </Tree.Item>
    );
}

/**
 * The app's own check control: a press toggles the item's check (`item.toggle-check`, with the
 * cascade); it shows a check mark, or a dash when mixed. The item already carries `aria-checked`
 * and Space toggles it, so the box is a span hidden from assistive technology that never takes
 * focus (a press focuses the item, and the arrows keep working); `data-tree-no-drag` keeps a press
 * from dragging or selecting.
 */
function CheckControl({ item }: { item: ItemOf<PermissionTypes> }) {
    const { model } = useTree<PermissionTypes, typeof features>();
    const { state } = useTreeItem(item);
    return (
        <span
            aria-hidden
            data-tree-no-drag=""
            data-testid="check"
            data-checked={state.checked ? "" : undefined}
            data-indeterminate={state.indeterminate ? "" : undefined}
            data-disabled={state.disabled ? "" : undefined}
            className={styles.checkbox}
            onClick={() => model.run("item.toggle-check", { itemId: item.id })}
        >
            <Check aria-hidden className={styles.checkIcon} />
            <Minus aria-hidden className={styles.mixedIcon} />
        </span>
    );
}
