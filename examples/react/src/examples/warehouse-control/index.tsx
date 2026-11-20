"use client";

import {
    type AnnounceEvent,
    createTreeModel,
    type ItemOf,
    Tree,
    useTreeState,
} from "@fragiola/tree-react";
import { DropIndicator } from "@fragiola/tree-react/drag-and-drop";
import { ChevronRight, Pause, Play, TriangleAlert } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Clickable } from "#/components/atoms/clickable";
import {
    createStockFeed,
    formatTime,
    prefersReducedMotion,
    START_TIME,
    type StockFeed,
} from "../_kit/warehouse-live";
import { BinTable } from "./bin-table";
import { type ControlFeaturesModel, features } from "./features";
import { FillChart } from "./fill-chart";
import { KindIcon } from "./kind-icon";
import { Kpis } from "./kpis";
import { MovementFeed } from "./movement-feed";
import * as styles from "./styles";
import {
    applyMovements,
    binStocks,
    type ControlTypes,
    describe,
    type LiveLog,
    logTick,
    network,
    pathOf,
    STORAGE_NAMES,
    stockIn,
    storageRules,
} from "./warehouse";

export default function WarehouseControl() {
    const [model] = useState(() =>
        createTreeModel<ControlTypes, typeof features>(network(), {
            features,
        }),
    );
    const [announce] = useState(() => announcer(model));
    useEffect(() => storageRules(model), [model]);

    // the live feed: it plays unless the reader asked for less motion, and stops while hidden
    const [playing, setPlaying] = useState(() => !prefersReducedMotion());
    const [log, setLog] = useState<LiveLog>(() => ({
        movements: [],
        states: [model.state],
    }));
    const feed = useRef<StockFeed | null>(null);
    useEffect(() => {
        const created = createStockFeed({
            bins: () => binStocks(model),
            autoplay: false,
        });
        // each tick is one batch of commands: the tree's totals and flags follow the model
        created.subscribe((movements) => {
            applyMovements(model, movements);
            setLog((current) => logTick(current, movements, model.state));
        });
        feed.current = created;
        return () => {
            created.dispose();
            feed.current = null;
        };
    }, [model]);
    useEffect(() => {
        if (playing) feed.current?.play();
        else feed.current?.pause();
    }, [playing]);

    // the scope of the panels: the selected location, or the whole network
    const scopeId = useTreeState((state) => state.selectedItemIds[0] ?? "", {
        model,
    });
    const scopePath = useTreeState(
        (_state, current) => {
            const item = current.get("item-by", { id: scopeId });
            return item
                ? [pathOf(current, item.id), item.label]
                      .filter(Boolean)
                      .join(" › ")
                : "All sites";
        },
        { model },
    );
    const time = log.movements[0]?.time ?? START_TIME;

    return (
        <div className={styles.frame}>
            <div className={styles.toolbar}>
                <p className={styles.scope}>
                    <span className={styles.scopeTerm}>Scope</span>
                    <span className={styles.scopeValue} data-testid="scope">
                        {scopePath}
                    </span>
                </p>
                <Clickable.Button
                    variant="outline"
                    size="sm"
                    disabled={scopeId === ""}
                    onClick={() => model.run("tree.clear-selection", {})}
                >
                    All sites
                </Clickable.Button>
                <span
                    className={styles.status(playing)}
                    data-testid="feed-status"
                >
                    {playing ? "Live" : "Paused"} · {formatTime(time)}
                </span>
                <Clickable.Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPlaying((current) => !current)}
                >
                    {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
                    {playing ? "Pause" : "Play"}
                </Clickable.Button>
            </div>
            <div className={styles.body}>
                <Tree.Root<ControlTypes, typeof features>
                    model={model}
                    announce={announce}
                    aria-label="Warehouse network"
                    className={styles.root}
                >
                    <Tree.Items<ControlTypes>>
                        {(item) => <LocationItem item={item} />}
                    </Tree.Items>
                    <DropIndicator className={styles.dropIndicator} />
                    <Tree.LiveRegion className={styles.liveRegion} />
                </Tree.Root>
                <div className={styles.scene}>
                    <Kpis model={model} log={log} scopeId={scopeId} />
                    <div className={styles.panels}>
                        <FillChart model={model} scopeId={scopeId} />
                        <MovementFeed
                            model={model}
                            log={log}
                            scopeId={scopeId}
                        />
                    </div>
                    <BinTable model={model} scopeId={scopeId} />
                </div>
            </div>
        </div>
    );
}

/** A location and its children: its icon, its name, its stock and its low-stock flag. */
function LocationItem({ item }: { item: ItemOf<ControlTypes> }) {
    // the stock is derived once per state, for every row; the description is the row's figures
    const description = useTreeState<ControlTypes, string>((state) =>
        describe(state, item.id),
    );
    const ratio = useTreeState<ControlTypes, number>((state) => {
        const stock = stockIn(state, item.id);
        return stock.capacity === 0 ? 0 : stock.units / stock.capacity;
    });
    const low = useTreeState<ControlTypes, number>(
        (state) => stockIn(state, item.id).low,
    );
    const stockId = useId();
    const lowStock = low > 0;
    return (
        <Tree.Item
            item={item}
            aria-describedby={stockId}
            // the flag is the app's: a data attribute its styles (and the spec) read
            data-low={lowStock ? "" : undefined}
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
                            className={styles.fillBar(ratio)}
                            style={{ width: `${Math.min(100, ratio * 100)}%` }}
                        />
                    </span>
                ) : (
                    <span aria-hidden className={styles.units}>
                        {Math.round(ratio * 100)}%
                    </span>
                )}
                {lowStock && (
                    <span aria-hidden className={styles.low}>
                        <TriangleAlert />
                        {item.kind === "bin" ? null : low}
                    </span>
                )}
            </Tree.ItemContent>
            <Tree.Group<ControlTypes>>
                {(child) => <LocationItem item={child} />}
            </Tree.Group>
        </Tree.Item>
    );
}

/** The live region's text: each step of a drag, and why no aisle here takes a bin. */
function announcer(model: ControlFeaturesModel) {
    const label = (itemId: string | null) =>
        itemId === null
            ? "the network"
            : (model.get("item-by", { id: itemId })?.label ?? itemId);
    const needs = (itemIds: readonly string[]) => {
        const item = model.get("item-by", { id: itemIds[0] ?? "" });
        return item?.kind === "bin"
            ? ` Its product needs ${STORAGE_NAMES[item.data.storage]}.`
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
                    : `No aisle here takes it.${needs(event.itemIds)}`;
            case "drop":
                return `Moved ${event.itemIds.map(label).join(", ")}.`;
            case "drag-cancel":
                return "Move cancelled.";
            default:
                return undefined;
        }
    };
}
