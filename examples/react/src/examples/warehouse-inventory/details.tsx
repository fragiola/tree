import {
    type ItemOf,
    type TreeModel,
    useTreeState,
} from "@fragiola/tree-react";
import { ArrowRightLeft } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { Clickable } from "#/components/atoms/clickable";
import type { WarehouseModel } from "./features";
import * as styles from "./styles";
import {
    ancestorIds,
    binsFor,
    formatUnits,
    STORAGE_NAMES,
    stockTotals,
    type WarehouseTypes,
} from "./warehouse";

/** The selected location or product: where it is, its stock, and what can be done with it. */
export function Details({ model }: { model: WarehouseModel }) {
    // the selection is the tree's: one item at a time, read from the model
    const item = useTreeState(
        (state, current) => {
            const [selectedId] = state.selectedItemIds;
            return selectedId === undefined
                ? undefined
                : current.get("item-by", { id: selectedId });
        },
        { model },
    );
    return (
        <section aria-label="Details" className={styles.details}>
            {item ? (
                <ItemDetails key={item.id} model={model} item={item} />
            ) : (
                <p className={styles.empty}>Select a location or a product.</p>
            )}
        </section>
    );
}

function ItemDetails({
    model,
    item,
}: {
    model: TreeModel<WarehouseTypes>;
    item: ItemOf<WarehouseTypes>;
}) {
    const stock = useTreeState(
        (_state, current) => stockTotals(current).byItemId.get(item.id),
        { model },
    );
    const path = useTreeState(
        (_state, current) =>
            ancestorIds(current, item.id)
                .map((id) => current.get("item-by", { id })?.label ?? id)
                .join(" › "),
        { model },
    );
    const units = stock?.units ?? 0;
    return (
        <>
            <p className={styles.path}>{path}</p>
            <h2 className={styles.title}>{item.label}</h2>
            <dl className={styles.facts}>
                {item.kind === "product" ? (
                    <>
                        <Fact term="SKU" value={item.data.sku} />
                        <Fact
                            term="Needs"
                            value={STORAGE_NAMES[item.data.storage]}
                        />
                        <Fact
                            term="Minimum"
                            value={`${item.data.minimum} units`}
                        />
                    </>
                ) : item.kind === "bin" ? (
                    <>
                        <Fact
                            term="Fill"
                            value={`${formatUnits(units)} of ${item.data.capacity} units`}
                        />
                        <Fact
                            term="Products"
                            value={String(item.childItemIds?.length ?? 0)}
                        />
                    </>
                ) : (
                    <>
                        <Fact term="Units" value={formatUnits(units)} />
                        <Fact
                            term="Low on stock"
                            value={String(stock?.low ?? 0)}
                        />
                    </>
                )}
            </dl>
            {item.kind === "product" && (
                <ProductActions model={model} item={item} />
            )}
        </>
    );
}

function Fact({ term, value }: { term: string; value: string }) {
    return (
        <div className={styles.fact}>
            <dt className={styles.term}>{term}</dt>
            <dd className={styles.value}>{value}</dd>
        </div>
    );
}

/** A product's quantity and its place: both go through commands, so the storage rules decide. */
function ProductActions({
    model,
    item,
}: {
    model: TreeModel<WarehouseTypes>;
    item: Extract<ItemOf<WarehouseTypes>, { kind: "product" }>;
}) {
    const quantityId = useId();
    const binId = useId();
    const [quantity, setQuantity] = useState(String(item.data.quantity));
    const [target, setTarget] = useState("");
    // what the rules refused, or what was done
    const [notice, setNotice] = useState("");
    // the bins the rules accept for it, asked of the model (`model.can`) once per state
    const bins = useTreeState((_state, current) => binsFor(current, item.id), {
        model,
        isEqual: (a, b) =>
            a.map((bin) => bin.id).join() === b.map((bin) => bin.id).join(),
    });

    const updateQuantity = (event: FormEvent) => {
        event.preventDefault();
        const result = model.run("item.set-data", {
            itemId: item.id,
            data: { ...item.data, quantity: Number(quantity) },
        });
        setNotice(result.ok ? "Quantity updated." : result.error.message);
    };
    const move = (event: FormEvent) => {
        event.preventDefault();
        if (target === "") return;
        const result = model.run("item.move", {
            itemIds: [item.id],
            // last in the bin
            to: {
                parentItemId: target,
                index: model.get("child-items-by", { itemId: target }).length,
            },
        });
        setNotice(result.ok ? "Moved." : result.error.message);
        setTarget("");
    };
    return (
        <>
            <form className={styles.form} onSubmit={updateQuantity}>
                <label htmlFor={quantityId} className={styles.term}>
                    Quantity
                </label>
                <div className={styles.formRow}>
                    <input
                        id={quantityId}
                        type="number"
                        min={0}
                        step={1}
                        value={quantity}
                        className={styles.input}
                        onChange={(event) => setQuantity(event.target.value)}
                    />
                    <Clickable.Button type="submit" variant="outline" size="sm">
                        Update
                    </Clickable.Button>
                </div>
            </form>
            <form className={styles.form} onSubmit={move}>
                <label htmlFor={binId} className={styles.term}>
                    Move to
                </label>
                <div className={styles.formRow}>
                    <select
                        id={binId}
                        value={target}
                        className={styles.select}
                        onChange={(event) => setTarget(event.target.value)}
                    >
                        <option value="">Choose a bin…</option>
                        {bins.map((bin) => (
                            <option key={bin.id} value={bin.id}>
                                {bin.label}
                            </option>
                        ))}
                    </select>
                    <Clickable.Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        disabled={target === ""}
                    >
                        <ArrowRightLeft aria-hidden />
                        Move
                    </Clickable.Button>
                </div>
            </form>
            <p
                role="status"
                data-testid="details-notice"
                className={styles.notice}
            >
                {notice}
            </p>
        </>
    );
}
