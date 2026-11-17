import { describe, expect, it } from "vitest";
import type { CommandEvent } from "../../src/commands/types";
import { veto } from "../../src/commands/types";
import { type FileTypes, filesModel } from "../fixture";

describe("the model's surface", () => {
    it("is exactly the verbs, plus use, subscribe, dispatch and the state", () => {
        const model = filesModel();
        const prototypeKeys = Object.getOwnPropertyNames(
            Object.getPrototypeOf(model),
        ).filter((key) => key !== "constructor");
        const ownFunctions = Object.keys(model).filter(
            (key) =>
                typeof (model as unknown as Record<string, unknown>)[key] ===
                "function",
        );
        expect(
            new Set([...prototypeKeys].filter((key) => !key.startsWith("_"))),
        ).toEqual(
            new Set([
                "state",
                "get",
                "is",
                "use",
                "subscribe",
                "run",
                "can",
                "check",
                "dispatch",
                // the bus's own machinery (private in TypeScript)
                "enqueueOrExecute",
                "drain",
                "execute",
                "runChain",
                "chain",
                "emit",
            ]),
        );
        expect(ownFunctions.sort()).toEqual(
            [
                "can",
                "check",
                "dispatch",
                "get",
                "is",
                "run",
                "subscribe",
                "use",
            ].sort(),
        );
    });

    it("binds its methods", () => {
        const { run, get } = filesModel();
        expect(run("item.collapse", { itemId: "src" }).ok).toBe(true);
        expect(get("visible-items")).toHaveLength(2);
    });
});

describe("never throws on bad input", () => {
    const model = filesModel();
    const dispatch = (input: unknown) => model.dispatch(input);

    it("unknown_command", () => {
        expect(dispatch({ command: "item.fly", payload: {} })).toMatchObject({
            ok: false,
            error: { code: "unknown_command", path: "/command" },
        });
    });

    it("invalid_payload, with the path of each problem", () => {
        expect(
            dispatch({ command: "item.expand", payload: { itemId: 3, x: 1 } }),
        ).toMatchObject({
            ok: false,
            error: {
                code: "invalid_payload",
                path: "/payload/itemId",
                issues: [
                    { path: "/payload/itemId", message: "must be a string" },
                    { path: "/payload/x", message: "is not allowed" },
                ],
            },
        });
        expect(dispatch("nope")).toMatchObject({
            ok: false,
            error: { code: "invalid_payload" },
        });
        expect(dispatch({ command: "item.expand" })).toMatchObject({
            ok: false,
            error: { code: "invalid_payload", path: "/payload" },
        });
        expect(dispatch({ command: "item.expand", payload: {} })).toMatchObject(
            { ok: false, error: { path: "/payload/itemId" } },
        );
        expect(
            dispatch({
                command: "item.focus",
                payload: { itemId: "app" },
                extra: 1,
            }),
        ).toMatchObject({ ok: false, error: { path: "/extra" } });
        expect(model.run("item.expand", { itemId: 3 } as never)).toMatchObject({
            ok: false,
            error: { code: "invalid_payload", path: "/itemId" },
        });
    });

    it("not_found and refused", () => {
        expect(
            dispatch({ command: "item.expand", payload: { itemId: "x" } }),
        ).toMatchObject({
            ok: false,
            error: { code: "not_found", path: "/payload/itemId" },
        });
        expect(
            dispatch({ command: "item.expand", payload: { itemId: "app" } }),
        ).toMatchObject({ ok: false, error: { code: "refused" } });
    });

    it("a transient step of a command that is not one", () => {
        expect(
            dispatch({
                command: "item.remove",
                payload: { itemIds: ["app"] },
                transient: true,
            }),
        ).toMatchObject({
            ok: false,
            error: { code: "invalid_payload", path: "/transient" },
        });
        expect(
            model.run("item.collapse", { itemId: "src" }, { transient: true })
                .ok,
        ).toBe(true);
    });

    it("vetoed, middleware_error and queued", () => {
        const fresh = filesModel();
        const removeVeto = fresh.use((ctx) =>
            ctx.command === "item.remove" ? veto("kept") : undefined,
        );
        expect(fresh.run("item.remove", { itemIds: ["app"] })).toEqual({
            ok: false,
            error: { code: "vetoed", message: "kept" },
        });
        removeVeto();
        const removeThrow = fresh.use(() => {
            throw new Error("boom");
        });
        expect(fresh.run("item.collapse", { itemId: "src" })).toMatchObject({
            ok: false,
            error: { code: "middleware_error", message: "boom" },
        });
        removeThrow();
        let queued: unknown;
        const removeQueue = fresh.use((ctx, next) => {
            if (ctx.command === "item.collapse" && !ctx.dryRun) {
                queued = fresh.run("item.focus", { itemId: "src" });
            }
            return next();
        });
        fresh.run("item.collapse", { itemId: "src" });
        removeQueue();
        expect(queued).toMatchObject({ ok: false, error: { code: "queued" } });
        // it ran once the collapse committed
        expect(fresh.state.focusedItemId).toBe("src");
    });
});

describe("middleware", () => {
    it("narrows the payload on the command, and can rewrite it (validated again)", () => {
        const model = filesModel();
        model.use((ctx, next) => {
            if (ctx.command === "item.rename") {
                ctx.payload = {
                    ...ctx.payload,
                    label: ctx.payload.label.trim(),
                };
            }
            return next();
        });
        model.run("item.rename", { itemId: "app", label: "  main.ts  " });
        expect(model.get("item-by", { id: "app" })?.label).toBe("main.ts");
        expect(
            model.run("item.rename", { itemId: "app", label: "   " }),
        ).toMatchObject({
            ok: false,
            error: {
                code: "invalid_payload",
                message: expect.stringContaining("rewritten"),
            },
        });
    });

    it("sees dryRun for can and check, and ctx.get reads the draft", () => {
        const model = filesModel();
        const seen: boolean[] = [];
        model.use((ctx, next) => {
            seen.push(ctx.dryRun);
            if (ctx.command === "item.move") {
                expect(ctx.get("item-by", { id: "readme" })?.label).toBe(
                    "readme.md",
                );
                expect(ctx.get("item-parent-by", { itemId: "a" })?.id).toBe(
                    "utils",
                );
            }
            return next();
        });
        model.can("item.collapse", { itemId: "src" });
        model.check("item.collapse", { itemId: "src" });
        model.run("item.move", {
            itemIds: ["readme"],
            to: { parentItemId: null, index: 0 },
        });
        expect(seen).toEqual([true, true, false]);
        expect(model.state.expandedItemIds).toEqual(["src"]);
    });

    it("runs outermost first and observes the result", () => {
        const model = filesModel();
        const order: string[] = [];
        model.use((_ctx, next) => {
            order.push("outer");
            const result = next();
            order.push(`outer saw ${result.ok}`);
            return result;
        });
        model.use((_ctx, next) => {
            order.push("inner");
            return next();
        });
        model.run("item.collapse", { itemId: "src" });
        expect(order).toEqual(["outer", "inner", "outer saw true"]);
    });
});

describe("events and batches", () => {
    it("one event per commit, with before and after; none for a dry run or a failure", () => {
        const model = filesModel();
        const events: CommandEvent<FileTypes>[] = [];
        model.subscribe((event) => events.push(event));
        const before = model.state;
        model.run(
            "item.collapse",
            { itemId: "src" },
            { meta: { source: "test" } },
        );
        model.can("item.expand", { itemId: "src" });
        model.run("item.expand", { itemId: "app" });
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            command: "item.collapse",
            payload: { itemId: "src" },
            result: { itemId: "src" },
            transient: false,
            meta: { source: "test" },
        });
        expect(events[0]?.before).toBe(before);
        expect(events[0]?.after).toBe(model.state);
    });

    it("shares every untouched item", () => {
        const model = filesModel();
        const before = model.state;
        model.run("item.rename", { itemId: "app", label: "main.ts" });
        const after = model.state;
        expect(after.items.readme).toBe(before.items.readme);
        expect(after.items.src).toBe(before.items.src);
        expect(after.items.app).not.toBe(before.items.app);
        expect(after.rootItemIds).toBe(before.rootItemIds);
        model.run("item.collapse", { itemId: "src" });
        expect(model.state.items).toBe(after.items);
    });

    it("a batch is atomic: one event when all succeed, nothing when one fails", () => {
        const model = filesModel({ settings: { selectionMode: "multiple" } });
        const events: CommandEvent<FileTypes>[] = [];
        model.subscribe((event) => events.push(event));
        const result = model.run("batch", {
            commands: [
                { command: "item.expand", payload: { itemId: "utils" } },
                { command: "item.focus", payload: { itemId: "a" } },
                { command: "item.select", payload: { itemId: "a" } },
            ],
        });
        expect(result).toEqual({
            ok: true,
            value: {
                results: [
                    { itemId: "utils" },
                    { itemId: "a" },
                    { selectedItemIds: ["a"] },
                ],
            },
        });
        expect(events).toHaveLength(1);
        expect(events[0]?.commands?.map((step) => step.command)).toEqual([
            "item.expand",
            "item.focus",
            "item.select",
        ]);
        const before = model.state;
        expect(
            model.run("batch", {
                commands: [
                    { command: "item.collapse", payload: { itemId: "src" } },
                    { command: "item.expand", payload: { itemId: "app" } },
                ],
            }),
        ).toMatchObject({
            ok: false,
            error: { code: "refused", path: "/commands/1/payload/itemId" },
        });
        expect(model.state).toBe(before);
        expect(events).toHaveLength(1);
        expect(
            model.dispatch({
                command: "batch",
                payload: { commands: [{ command: "item.fly", payload: {} }] },
            }),
        ).toMatchObject({
            ok: false,
            error: {
                code: "unknown_command",
                path: "/payload/commands/0/command",
            },
        });
    });

    it("every middleware sees the batch's commands, and a veto inside one fails it all", () => {
        const model = filesModel();
        const seen: string[] = [];
        model.use((ctx, next) => {
            seen.push(`${ctx.command}${ctx.inBatch ? " (in batch)" : ""}`);
            if (ctx.command === "item.focus") return veto();
            return next();
        });
        const result = model.run("batch", {
            commands: [
                { command: "item.collapse", payload: { itemId: "src" } },
                { command: "item.focus", payload: { itemId: "src" } },
            ],
        });
        expect(result).toMatchObject({ ok: false, error: { code: "vetoed" } });
        expect(seen).toEqual([
            "batch",
            "item.collapse (in batch)",
            "item.focus (in batch)",
        ]);
        expect(model.state.expandedItemIds).toEqual(["src"]);
    });
});

describe("the command catalogue", () => {
    it("lists every command with a description and self-contained schemas", () => {
        const commands = filesModel().get("commands");
        expect(commands.length).toBeGreaterThanOrEqual(27);
        for (const info of commands) {
            expect(info.description.length, info.name).toBeGreaterThan(20);
            expect(JSON.stringify(info.payloadSchema)).not.toContain("$ref");
            expect(info.payloadSchema.type).toBe("object");
            expect(info.resultSchema.type).toBe("object");
            expect(Object.isFrozen(info.payloadSchema)).toBe(true);
        }
        expect(commands.map((info) => info.name)).toContain("item.move");
    });
});
