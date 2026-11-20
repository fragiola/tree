import {
    afterNextRender,
    Component,
    computed,
    DestroyRef,
    inject,
    signal,
} from "@angular/core";
import {
    type AnnounceEvent,
    createTreeModel,
    injectTreeState,
    TREE,
} from "@fragiola/tree-angular";
import { TreeDropIndicatorDirective } from "@fragiola/tree-angular/drag-and-drop";
import {
    LucideChevronRight,
    LucidePause,
    LucidePlay,
    LucideTriangleAlert,
} from "@lucide/angular";
import { ClickableButton } from "#/components/atoms/clickable";
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

let nextInstance = 0;

@Component({
    selector: "example-warehouse-control",
    imports: [
        TREE,
        TreeDropIndicatorDirective,
        ClickableButton,
        BinTable,
        FillChart,
        KindIcon,
        Kpis,
        MovementFeed,
        LucideChevronRight,
        LucidePause,
        LucidePlay,
        LucideTriangleAlert,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.toolbar">
                <p [class]="styles.scope">
                    <span [class]="styles.scopeTerm">Scope</span>
                    <span [class]="styles.scopeValue" data-testid="scope">{{ scopePath() }}</span>
                </p>
                <button
                    kitClickable
                    variant="outline"
                    size="sm"
                    [disabled]="scopeId() === ''"
                    (click)="model.run('tree.clear-selection', {})"
                >
                    All sites
                </button>
                <span [class]="styles.status(playing())" data-testid="feed-status">{{ playing() ? "Live" : "Paused" }} · {{ formatTime(time()) }}</span>
                <button kitClickable variant="outline" size="sm" (click)="togglePlaying()">
                    @if (playing()) {
                        <svg lucidePause aria-hidden="true"></svg>
                        Pause
                    } @else {
                        <svg lucidePlay aria-hidden="true"></svg>
                        Play
                    }
                </button>
            </div>
            <div [class]="styles.body">
                <div
                    [treeRoot]="model"
                    #tree="treeRoot"
                    [announce]="announce"
                    aria-label="Warehouse network"
                    [class]="styles.root"
                >
                    <!-- a location and its children: its icon, its name, its stock and its
                         low-stock flag (the app's data attribute, read by its styles and the spec) -->
                    <ng-template [treeItems]="model" let-item>
                        <div
                            [treeItem]="item"
                            [attr.aria-describedby]="stockId(item.id)"
                            [attr.data-low]="lowOf(item.id) > 0 ? '' : null"
                            [class]="styles.item"
                        >
                            <div treeItemContent [class]="styles.row">
                                <span treeToggle [class]="styles.toggle">
                                    <svg lucideChevronRight aria-hidden="true"></svg>
                                </span>
                                <example-control-kind-icon [item]="item" />
                                <span [class]="styles.label">{{ item.label }}</span>
                                <span [id]="stockId(item.id)" hidden>{{ describe(state(), item.id) }}</span>
                                @if (item.kind === "bin") {
                                    <span aria-hidden="true" [class]="styles.fill">
                                        <span [class]="styles.fillBar(ratioOf(item.id))" [style.width.%]="ratioOf(item.id) * 100"></span>
                                    </span>
                                } @else {
                                    <span aria-hidden="true" [class]="styles.units">{{ round(ratioOf(item.id) * 100) }}%</span>
                                }
                                @if (lowOf(item.id) > 0) {
                                    <span aria-hidden="true" [class]="styles.low">
                                        <svg lucideTriangleAlert></svg>
                                        @if (item.kind !== "bin") {
                                            {{ lowOf(item.id) }}
                                        }
                                    </span>
                                }
                            </div>
                            <div treeGroup></div>
                        </div>
                    </ng-template>
                    @if (tree.state().dragging) {
                        <div treeDropIndicator [class]="styles.dropIndicator"></div>
                    }
                    <div treeLiveRegion [class]="styles.liveRegion"></div>
                </div>
                <div [class]="styles.scene">
                    <example-control-kpis [model]="model" [log]="log()" [scopeId]="scopeId()" />
                    <div [class]="styles.panels">
                        <example-control-fill-chart [model]="model" [scopeId]="scopeId()" />
                        <example-control-movement-feed [model]="model" [log]="log()" [scopeId]="scopeId()" />
                    </div>
                    <example-control-bin-table [model]="model" [scopeId]="scopeId()" />
                </div>
            </div>
        </div>
    `,
})
export default class WarehouseControl {
    protected readonly styles = styles;
    protected readonly describe = describe;
    protected readonly formatTime = formatTime;
    protected readonly round = Math.round;
    // The model is the source of truth: create it once.
    protected readonly model = createTreeModel<ControlTypes, typeof features>(
        network(),
        { features },
    );
    protected readonly announce = announcer(this.model);
    /** the model's state: every row's figures are derived from it, once per state */
    protected readonly state = injectTreeState((state) => state, {
        model: this.model,
    });
    /** the scope of the panels: the selected location, or the whole network */
    protected readonly scopeId = computed(
        () => this.state().selectedItemIds[0] ?? "",
    );
    protected readonly scopePath = computed(() => {
        this.state();
        const item = this.model.get("item-by", { id: this.scopeId() });
        return item
            ? [pathOf(this.model, item.id), item.label]
                  .filter(Boolean)
                  .join(" › ")
            : "All sites";
    });
    /** the live feed: it plays unless the reader asked for less motion, and stops while hidden */
    protected readonly playing = signal(false);
    protected readonly log = signal<LiveLog>({
        movements: [],
        states: [this.model.state],
    });
    protected readonly time = computed(
        () => this.log().movements[0]?.time ?? START_TIME,
    );
    private feed: StockFeed | undefined;
    private readonly instance = nextInstance++;

    constructor() {
        const destroyRef = inject(DestroyRef);
        destroyRef.onDestroy(storageRules(this.model));
        afterNextRender(() => {
            const feed = createStockFeed({
                bins: () => binStocks(this.model),
                autoplay: !prefersReducedMotion(),
            });
            // each tick is one batch of commands: the tree's totals and flags follow the model
            feed.subscribe((movements) => {
                applyMovements(this.model, movements);
                this.log.update((log) =>
                    logTick(log, movements, this.model.state),
                );
            });
            feed.onPlaying((playing) => this.playing.set(playing));
            this.playing.set(feed.playing);
            this.feed = feed;
            destroyRef.onDestroy(() => feed.dispose());
        });
    }

    protected togglePlaying() {
        if (this.feed?.playing) this.feed.pause();
        else this.feed?.play();
    }

    // the stock describes the row; the label alone is its accessible name
    protected stockId(itemId: string) {
        return `warehouse-control-${this.instance}-stock-${itemId}`;
    }

    protected ratioOf(itemId: string) {
        const stock = stockIn(this.state(), itemId);
        return stock.capacity === 0 ? 0 : stock.units / stock.capacity;
    }

    protected lowOf(itemId: string) {
        return stockIn(this.state(), itemId).low;
    }
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
