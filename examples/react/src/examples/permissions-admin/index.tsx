"use client";

import {
    createTreeModel,
    type ItemOf,
    Tree,
    useTreeItem,
    useTreeState,
} from "@fragiola/tree-react";
import {
    Check,
    ChevronRight,
    Lock,
    Minus,
    RotateCcw,
    Save,
    Search,
    TriangleAlert,
} from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { Clickable } from "#/components/atoms/clickable";
import { features, type PermissionModel } from "./features";
import { KindIcon } from "./kind-icon";
import {
    changesOf,
    describe,
    expand,
    grantedActions,
    grantsOf,
    isRisky,
    organization,
    type PermissionTypes,
    ROLE_NAMES,
    roleOf,
    search,
} from "./permissions";
import * as styles from "./styles";

const json = organization();

export default function PermissionsAdmin() {
    const [model] = useState(() =>
        createTreeModel<PermissionTypes, typeof features>(json, { features }),
    );
    // The checks are the app's state, as a form field's value is: the tree shows them and reports
    // every change it makes; presets and Discard set them, and the tree follows (a granted action
    // is disabled, so it stays checked). The list starts as the model's, with the cascade's parents.
    const [checkedItemIds, setCheckedItemIds] = useState<readonly string[]>(
        () => model.state.checkedItemIds,
    );
    // what is saved: the granted actions at the last Save
    const [saved, setSaved] = useState(() =>
        grantedActions(model, json.checkedItemIds ?? []),
    );
    const current = useMemo(
        () => grantedActions(model, checkedItemIds),
        [model, checkedItemIds],
    );
    const changes = useMemo(
        () => changesOf(model, saved, current),
        [model, saved, current],
    );
    const role = roleOf(current);
    const [query, setQuery] = useState("");
    const found = useTreeState((_state, current) => search(current, query), {
        model,
    });
    // what the rules refused, or what was done
    const [notice, setNotice] = useState("");
    const dialog = useRef<HTMLDialogElement>(null);
    const summaryId = useId();

    const run = (result: { ok: boolean; error?: { message: string } }) =>
        setNotice(result.ok ? "" : (result.error?.message ?? ""));

    const save = () => {
        setSaved(current);
        setNotice("Saved.");
        dialog.current?.close();
    };

    return (
        <div className={styles.frame}>
            <div className={styles.toolbar}>
                <label className={styles.field}>
                    <span className={styles.fieldLabel}>Role</span>
                    <select
                        value={role}
                        className={styles.select}
                        onChange={(event) =>
                            event.target.value !== "Custom" &&
                            setCheckedItemIds(grantsOf(event.target.value))
                        }
                    >
                        {ROLE_NAMES.map((name) => (
                            <option key={name} value={name}>
                                {name}
                            </option>
                        ))}
                        <option value="Custom" disabled>
                            Custom
                        </option>
                    </select>
                </label>
                <span className={styles.searchField}>
                    <Search aria-hidden className={styles.searchIcon} />
                    <input
                        type="search"
                        aria-label="Search permissions"
                        placeholder="Search"
                        value={query}
                        className={styles.search}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            // the folders around the matches open
                            expand(
                                model,
                                search(model, event.target.value).aroundIds,
                            );
                        }}
                    />
                </span>
                {query.trim() !== "" && (
                    <span className={styles.matches} data-testid="matches">
                        {found.matchIds.size}{" "}
                        {found.matchIds.size === 1 ? "match" : "matches"}
                    </span>
                )}
            </div>
            <div className={styles.body}>
                <Tree.Root<PermissionTypes, typeof features>
                    model={model}
                    checkedItemIds={checkedItemIds}
                    onCheckedItemIdsChange={setCheckedItemIds}
                    aria-label="Permissions"
                    className={styles.root}
                >
                    <Tree.Items<PermissionTypes>>
                        {(item) => (
                            <PermissionItem
                                item={item}
                                model={model}
                                saved={saved}
                                found={found}
                                onToggle={(itemId) =>
                                    run(
                                        model.run("item.toggle-check", {
                                            itemId,
                                        }),
                                    )
                                }
                            />
                        )}
                    </Tree.Items>
                </Tree.Root>
                <section aria-label="Changes" className={styles.summary}>
                    <h2 className={styles.summaryTitle}>Changes</h2>
                    <p
                        id={summaryId}
                        className={styles.summaryText}
                        data-testid="changes"
                    >
                        {changes.added.length === 0 &&
                        changes.removed.length === 0
                            ? "No changes"
                            : `${changes.added.length} added, ${changes.removed.length} removed`}
                    </p>
                    <ul className={styles.areas}>
                        {changes.byArea.map((area) => (
                            <li key={area.area} className={styles.area}>
                                <span>{area.area}</span>
                                <span className={styles.counts}>
                                    {area.added > 0 && (
                                        <span className={styles.added}>
                                            +{area.added}
                                        </span>
                                    )}
                                    {area.removed > 0 && (
                                        <span className={styles.removed}>
                                            −{area.removed}
                                        </span>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <div className={styles.actions}>
                        <Clickable.Button
                            variant="outline"
                            size="sm"
                            disabled={
                                changes.added.length +
                                    changes.removed.length ===
                                0
                            }
                            onClick={() => {
                                setCheckedItemIds(saved);
                                setNotice("Discarded.");
                            }}
                        >
                            <RotateCcw aria-hidden />
                            Discard
                        </Clickable.Button>
                        <Clickable.Button
                            variant="outline"
                            size="sm"
                            disabled={
                                changes.added.length +
                                    changes.removed.length ===
                                0
                            }
                            onClick={() =>
                                // granting a risky action asks first
                                changes.risky.length > 0
                                    ? dialog.current?.showModal()
                                    : save()
                            }
                        >
                            <Save aria-hidden />
                            Save
                        </Clickable.Button>
                    </div>
                    <p
                        role="status"
                        data-testid="notice"
                        className={styles.notice}
                    >
                        {notice}
                    </p>
                </section>
            </div>
            <dialog
                ref={dialog}
                aria-labelledby={`${summaryId}-title`}
                className={styles.dialog}
            >
                <h2 id={`${summaryId}-title`} className={styles.dialogTitle}>
                    Grant risky permissions?
                </h2>
                <ul className={styles.riskyList}>
                    {changes.risky.map((change) => (
                        <li key={change.id}>
                            {change.area} · {change.name}
                        </li>
                    ))}
                </ul>
                <div className={styles.actions}>
                    <Clickable.Button
                        variant="outline"
                        size="sm"
                        onClick={() => dialog.current?.close()}
                    >
                        Cancel
                    </Clickable.Button>
                    <Clickable.Button
                        size="sm"
                        className={styles.danger}
                        onClick={save}
                    >
                        Grant and save
                    </Clickable.Button>
                </div>
            </dialog>
        </div>
    );
}

interface PermissionItemProps {
    item: ItemOf<PermissionTypes>;
    model: PermissionModel;
    saved: readonly string[];
    found: ReturnType<typeof search>;
    onToggle: (itemId: string) => void;
}

/** A row: the check, the icon, the name, then a lock, a risk mark and the change since the save. */
function PermissionItem({
    item,
    model,
    saved,
    found,
    onToggle,
}: PermissionItemProps) {
    const { state } = useTreeItem(item);
    const descriptionId = useId();
    const checkedIds = useTreeState(
        (current) => new Set(current.checkedItemIds),
        {
            model,
        },
    );
    const savedNow = item.kind === "action" && saved.includes(item.id);
    const change =
        item.kind !== "action" || savedNow === state.checked
            ? undefined
            : state.checked
              ? "added"
              : "removed";
    const description = [
        describe(model, item, checkedIds),
        change === "added" ? "Added" : change === "removed" ? "Removed" : "",
    ]
        .filter(Boolean)
        .join(", ");
    const searching = found.matchIds.size > 0;
    return (
        <Tree.Item
            item={item}
            aria-describedby={descriptionId}
            // the search's highlight is the app's: data attributes its styles read
            data-match={found.matchIds.has(item.id) ? "" : undefined}
            data-dimmed={
                searching &&
                !found.matchIds.has(item.id) &&
                !found.aroundIds.has(item.id)
                    ? ""
                    : undefined
            }
            className={styles.item}
        >
            <Tree.ItemContent className={styles.row}>
                <Tree.Toggle className={styles.toggle}>
                    <ChevronRight aria-hidden />
                </Tree.Toggle>
                {/* the app's own check control: the item carries aria-checked, and Space toggles
                    it too; a granted action is disabled, so neither unchecks it */}
                <span
                    aria-hidden
                    data-tree-no-drag=""
                    data-testid="check"
                    data-checked={state.checked ? "" : undefined}
                    data-indeterminate={state.indeterminate ? "" : undefined}
                    data-disabled={state.disabled ? "" : undefined}
                    className={styles.checkbox}
                    onClick={() => !state.disabled && onToggle(item.id)}
                >
                    <Check aria-hidden className={styles.checkIcon} />
                    <Minus aria-hidden className={styles.mixedIcon} />
                </span>
                <KindIcon item={item} />
                <span className={styles.label}>{item.label}</span>
                <span id={descriptionId} hidden>
                    {description}
                </span>
                {item.kind === "action" && item.data.grantedBy && (
                    <Lock aria-hidden className={styles.lock} />
                )}
                {isRisky(item) && (
                    <TriangleAlert aria-hidden className={styles.risk} />
                )}
                {change && (
                    <span
                        aria-hidden
                        data-testid="change"
                        className={styles.change[change]}
                    >
                        {change === "added" ? "+" : "−"}
                    </span>
                )}
            </Tree.ItemContent>
            <Tree.Group<PermissionTypes>>
                {(child) => (
                    <PermissionItem
                        item={child}
                        model={model}
                        saved={saved}
                        found={found}
                        onToggle={onToggle}
                    />
                )}
            </Tree.Group>
        </Tree.Item>
    );
}
