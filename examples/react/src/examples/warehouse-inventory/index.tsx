"use client";

import {
    type AnnounceEvent,
    createTreeModel,
    type ItemOf,
    Tree,
    useTreeState,
} from "@fragiola/tree-react";
import { DropIndicator } from "@fragiola/tree-react/drag-and-drop";
import { VirtualItems } from "@fragiola/tree-react/virtualization";
import {
    ChevronRight,
    ChevronsDownUp,
    ListChecks,
    TriangleAlert,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Clickable } from "#/components/atoms/clickable";
import { Details } from "./details";
import { features, type WarehouseModel } from "./features";
import { KindIcon } from "./kind-icon";
import * as styles from "./styles";
import {
    expandToLowStock,
    formatUnits,
    STORAGE_NAMES,
    stockTotals,
    storageRules,
    type WarehouseTypes,
    warehouse,
    zoneOf,
} from "./warehouse";

const ZONE_OPTIONS = [
    { id: "", label: "All zones" },
    { id: "dry", label: "Dry goods" },
    { id: "cold", label: "Cold storage" },
    { id: "frozen", label: "Freezer" },
    { id: "hazmat", label: "Hazmat cage" },
    { id: "returns", label: "Returns" },
];

export default function WarehouseInventory() {
    const [model] = useState(() =>
        createTreeModel<WarehouseTypes, typeof features>(warehouse(), {
            features,
        }),
    );
    const [announce] = useState(() => announcer(model));
    useEffect(() => storageRules(model), [model]);
    // the zone the app highlights: its rows stay, the others dim (the tree is not filtered)
    const [zoneId, setZoneId] = useState("");
    const low = useTreeState(
        (_state, current) => stockTotals(current).lowProductIds.length,
        { model },
    );
    return (
        <div className={styles.frame}>
            <div className={styles.toolbar}>
                <Clickable.Button
                    variant="outline"
                    size="sm"
                    onClick={() => expandToLowStock(model)}
                >
                    <ListChecks aria-hidden />
                    Expand to low stock
                </Clickable.Button>
                <Clickable.Button
                    variant="outline"
                    size="sm"
                    onClick={() => model.run("tree.collapse-all", {})}
                >
                    <ChevronsDownUp aria-hidden />
                    Collapse all
                </Clickable.Button>
                <select
                    aria-label="Highlight zone"
                    value={zoneId}
                    className={styles.select}
                    onChange={(event) => setZoneId(event.target.value)}
                >
                    {ZONE_OPTIONS.map((zone) => (
                        <option key={zone.id} value={zone.id}>
                            {zone.label}
                        </option>
                    ))}
                </select>
                <span className={styles.lowCount} data-testid="low-stock">
                    <TriangleAlert aria-hidden />
                    {low} low on stock
                </span>
            </div>
            <div className={styles.body}>
                <Tree.Root<WarehouseTypes, typeof features>
                    model={model}
                    announce={announce}
                    aria-label="Warehouse locations"
                    className={styles.root}
                >
                    {/* flat rows: each item carries its level, position and set size */}
                    <VirtualItems<WarehouseTypes>>
                        {(item) => <LocationRow item={item} zoneId={zoneId} />}
                    </VirtualItems>
                    <DropIndicator className={styles.dropIndicator} />
                    <Tree.LiveRegion className={styles.liveRegion} />
                </Tree.Root>
                <Details model={model} />
            </div>
        </div>
    );
}

/** A location's row: its icon, its name, and its stock (derived once per state, for every row). */
function LocationRow({
    item,
    zoneId,
}: {
    item: ItemOf<WarehouseTypes>;
    zoneId: string;
}) {
    const stock = useTreeState<
        WarehouseTypes,
        { units: number; low: number } | undefined
    >((_state, current) => stockTotals(current).byItemId.get(item.id));
    const inZone = useTreeState<WarehouseTypes, boolean>(
        (_state, current) =>
            zoneId === "" || zoneOf(current, item.id)?.id === zoneId,
    );
    // the stock describes the row; the label alone is its accessible name
    const stockId = useId();
    const units = stock?.units ?? 0;
    const lowStock =
        item.kind === "product" && item.data.quantity < item.data.minimum;
    const description =
        item.kind === "product"
            ? `${formatUnits(units)} units${lowStock ? `, low stock (minimum ${item.data.minimum})` : ""}, needs ${STORAGE_NAMES[item.data.storage]}`
            : item.kind === "bin"
              ? `${Math.round((units / item.data.capacity) * 100)}% full, ${formatUnits(units)} of ${item.data.capacity} units`
              : `${formatUnits(units)} units${stock?.low ? `, ${stock.low} low on stock` : ""}`;
    return (
        <Tree.Item
            item={item}
            aria-describedby={stockId}
            // the zone highlight is the app's: a data attribute its styles read
            data-dimmed={inZone ? undefined : ""}
            className={styles.item}
        >
            <Tree.ItemContent className={styles.row}>
                <Tree.Toggle className={styles.toggle}>
                    <ChevronRight aria-hidden />
                </Tree.Toggle>
                <KindIcon item={item} />
                <span className={styles.label}>{item.label}</span>
                <span id={stockId} hidden>
                    {description}
                </span>
                {item.kind === "bin" ? (
                    <span aria-hidden className={styles.fill}>
                        <span
                            className={styles.fillBar(
                                units / item.data.capacity,
                            )}
                            style={{
                                width: `${Math.min(100, (units / item.data.capacity) * 100)}%`,
                            }}
                        />
                    </span>
                ) : (
                    <span aria-hidden className={styles.units}>
                        {formatUnits(units)}
                    </span>
                )}
                {(lowStock ||
                    (item.kind !== "product" && (stock?.low ?? 0) > 0)) && (
                    <span aria-hidden className={styles.low}>
                        <TriangleAlert />
                        {item.kind === "product" ? null : stock?.low}
                    </span>
                )}
            </Tree.ItemContent>
        </Tree.Item>
    );
}

/** The live region's text: each step of a drag, and why nothing takes a product here. */
function announcer(model: WarehouseModel) {
    const label = (itemId: string | null) =>
        itemId === null
            ? "the warehouse"
            : (model.get("item-by", { id: itemId })?.label ?? itemId);
    const needs = (itemIds: readonly string[]) => {
        const item = model.get("item-by", { id: itemIds[0] ?? "" });
        return item?.kind === "product"
            ? ` It needs ${STORAGE_NAMES[item.data.storage]}.`
            : "";
    };
    return (event: AnnounceEvent): string | undefined => {
        switch (event.type) {
            case "drag-start":
                return `Picked up ${event.itemIds.map(label).join(", ")}.${needs(event.itemIds)}`;
            case "drag-over":
                return event.target
                    ? event.target.position === "inside"
                        ? `Drop into ${label(event.target.itemId)}.`
                        : `Drop ${event.target.position} ${label(event.target.itemId)}.`
                    : `No bin here takes it.${needs(event.itemIds)}`;
            case "drop":
                return `Moved ${event.itemIds.map(label).join(", ")}.`;
            case "drag-cancel":
                return "Move cancelled.";
            default:
                return undefined;
        }
    };
}
