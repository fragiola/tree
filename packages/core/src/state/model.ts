// The tree model and its command bus. From Dockable (fragiola/dockable,
// packages/core/src/state/model.ts), same author and licence.
import { COMMAND_DEFINITIONS } from "../commands/catalogue";
import { fail, invalid, type ReduceContext } from "../commands/define";
import type {
    BatchStep,
    CommandContext,
    CommandContextGetKey,
    CommandEvent,
    CommandListener,
    CommandName,
    CommandResult,
    Middleware,
    PayloadOf,
    ResultOf,
    RunOptions,
} from "../commands/types";
import type { JsonSchema } from "../schema/types";
import { isObject, validate } from "../schema/validator";
import { Draft } from "./draft";
import { type CreateId, IdSource } from "./ids";
import type { TreeJson } from "./json";
import {
    buildState,
    type DataSchemas,
    dataIssues,
    TreeValidationError,
} from "./load";
import {
    type ModelGetKey,
    type ModelGetPayload,
    type ModelGetResult,
    type ModelIsKey,
    type ModelIsPayload,
    type QueryArgs,
    queryGet,
    queryIs,
} from "./queries";
import { itemOf, parentOf } from "./structure";
import type { AnyTypes, KindOf, TreeState, TreeTypes } from "./types";

/** Options of {@link createTreeModel}. */
export interface TreeModelOptions<T extends TreeTypes = AnyTypes> {
    /** generates the id of an item created without one; default `` `item-${n}` `` */
    createId?: CreateId | undefined;
    /** a JSON Schema per item kind: the document, `item.add`, `item.set-data` and `item.set-children` validate `data` */
    dataSchemas?: { [K in KindOf<T>]?: JsonSchema } | undefined;
    /** freeze every state object (default true) */
    freeze?: boolean | undefined;
}

/**
 * What the app adds to a dispatched command: never read from the untrusted input, so `meta` can
 * say who asked (`{ source: "assistant" }`) for middleware to decide on.
 */
export interface DispatchOptions {
    meta?: Readonly<Record<string, unknown>> | undefined;
}

/**
 * The tree model: the tree's data and its rules. An immutable state that only commands change,
 * usable in plain Node (no DOM). Every member is one verb:
 *
 * - `run` changes the tree (a command, through the middleware chain); `dispatch` is `run` for
 *   untrusted JSON;
 * - `can` answers whether `run` would succeed; `check` returns what it would return;
 * - `get` reads (`model.get("item-by", { id })`); `is` asks a yes/no question
 *   (`model.is("item-expanded", { itemId })`);
 * - `use` adds a middleware around every command; `subscribe` listens to every commit.
 *
 * Every method is bound: it can be passed around on its own.
 */
export interface TreeModel<T extends TreeTypes = AnyTypes> {
    /** the current state (immutable; a new object after every change) */
    readonly state: TreeState<T>;

    /** changes the tree: runs a command (typed) through the middleware chain; never throws on bad input */
    run<C extends CommandName>(
        command: C,
        payload: PayloadOf<T, C>,
        options?: RunOptions,
    ): CommandResult<ResultOf<T, C>>;
    /**
     * `run` for a command given as untrusted JSON `{ command, payload, transient? }`, validated;
     * `options.meta` (the app's, not the input's) reaches middleware and listeners
     */
    dispatch(input: unknown, options?: DispatchOptions): CommandResult<unknown>;
    /** whether `run` would succeed now (nothing is committed or emitted) */
    can<C extends CommandName>(
        command: C,
        payload: PayloadOf<T, C>,
        options?: RunOptions,
    ): boolean;
    /** what `run` would return (its value, or why it is refused), without committing or emitting */
    check<C extends CommandName>(
        command: C,
        payload: PayloadOf<T, C>,
        options?: RunOptions,
    ): CommandResult<ResultOf<T, C>>;
    /** reads from the current state: an item, its children, the visible items, the JSON, … */
    get<K extends ModelGetKey>(
        key: K,
        ...payload: QueryArgs<ModelGetPayload<T, K>>
    ): ModelGetResult<T, K>;
    /** asks a yes/no question about the current state */
    is<K extends ModelIsKey>(key: K, payload: ModelIsPayload<K>): boolean;
    /** adds a middleware around every command (the first added runs outermost); returns its remover */
    use(middleware: Middleware<T>): () => void;
    /** listens to every committed command (one event per commit); returns its remover */
    subscribe(listener: CommandListener<T>): () => void;
}

function prefixed(
    result: CommandResult<unknown>,
    prefix: string,
): CommandResult<unknown> {
    if (result.ok || prefix === "") {
        return result;
    }
    const { error: failure } = result;
    return {
        ok: false,
        error: {
            ...failure,
            ...(failure.path !== undefined
                ? { path: `${prefix}${failure.path}` }
                : {}),
            ...(failure.issues
                ? {
                      issues: failure.issues.map((issue) => ({
                          path: `${prefix}${issue.path}`,
                          message: issue.message,
                      })),
                  }
                : {}),
        },
    };
}

/** Where a command's errors point: into its payload, and at its transient flag. */
interface ErrorPaths {
    readonly payload: string;
    readonly transient: string;
}

/** One top-level execution: the draft it runs on, and what it collects (the steps of a batch). */
interface Execution {
    readonly draft: Draft;
    readonly dryRun: boolean;
    readonly options: RunOptions;
    readonly steps: BatchStep[];
    /** an exception a reducer threw: rethrown once the chain unwound */
    thrown: { error: unknown } | undefined;
}

class Model<T extends TreeTypes> implements TreeModel<T> {
    /** the committed state: what queries read and commands start from */
    private committed: TreeState;
    private readonly ids: IdSource;
    private readonly dataSchemas: DataSchemas | undefined;
    private readonly freeze: boolean;
    private readonly middleware: Middleware<T>[] = [];
    private readonly listeners = new Set<CommandListener<T>>();
    private inFlight = 0;
    /** dry runs under way (`can`, `check`): a command a middleware issues then is one too */
    private dryRuns = 0;
    private readonly queue: (() => void)[] = [];
    private readonly events: CommandEvent<T>[] = [];
    private delivering = false;

    constructor(state: TreeState, ids: IdSource, options: TreeModelOptions<T>) {
        this.committed = state;
        this.ids = ids;
        this.dataSchemas = options.dataSchemas as DataSchemas | undefined;
        this.freeze = options.freeze ?? true;
        // the bus can be passed around detached: `const { run } = model`
        this.run = this.run.bind(this);
        this.dispatch = this.dispatch.bind(this);
        this.can = this.can.bind(this);
        this.check = this.check.bind(this);
        this.get = this.get.bind(this);
        this.is = this.is.bind(this);
        this.use = this.use.bind(this);
        this.subscribe = this.subscribe.bind(this);
    }

    get state(): TreeState<T> {
        return this.committed as unknown as TreeState<T>;
    }

    get<K extends ModelGetKey>(
        key: K,
        ...payload: QueryArgs<ModelGetPayload<T, K>>
    ): ModelGetResult<T, K> {
        return queryGet(this.committed, key, payload[0]) as ModelGetResult<
            T,
            K
        >;
    }

    is<K extends ModelIsKey>(key: K, payload: ModelIsPayload<K>): boolean {
        return queryIs(this.committed, key, payload);
    }

    use(middleware: Middleware<T>): () => void {
        this.middleware.push(middleware);
        return () => {
            const at = this.middleware.indexOf(middleware);
            if (at >= 0) {
                this.middleware.splice(at, 1);
            }
        };
    }

    subscribe(listener: CommandListener<T>): () => void {
        const wrapper: CommandListener<T> = (event) => listener(event);
        this.listeners.add(wrapper);
        return () => {
            this.listeners.delete(wrapper);
        };
    }

    run<C extends CommandName>(
        command: C,
        payload: PayloadOf<T, C>,
        options?: RunOptions,
    ): CommandResult<ResultOf<T, C>> {
        return this.enqueueOrExecute(
            command,
            payload,
            options,
            "",
        ) as CommandResult<ResultOf<T, C>>;
    }

    can<C extends CommandName>(
        command: C,
        payload: PayloadOf<T, C>,
        options?: RunOptions,
    ): boolean {
        return this.check(command, payload, options).ok;
    }

    check<C extends CommandName>(
        command: C,
        payload: PayloadOf<T, C>,
        options?: RunOptions,
    ): CommandResult<ResultOf<T, C>> {
        return this.execute(
            command,
            payload,
            options ?? {},
            true,
            "",
        ) as CommandResult<ResultOf<T, C>>;
    }

    dispatch(
        input: unknown,
        options: DispatchOptions = {},
    ): CommandResult<unknown> {
        if (!isObject(input)) {
            return fail(
                "invalid_payload",
                "must be an object { command, payload }",
                "",
            );
        }
        const { command, payload, transient } = input;
        if (typeof command !== "string") {
            return fail("invalid_payload", "must be a string", "/command");
        }
        if (!COMMAND_DEFINITIONS.has(command)) {
            return fail(
                "unknown_command",
                `unknown command "${command}"`,
                "/command",
            );
        }
        if (!isObject(payload)) {
            return fail("invalid_payload", "must be an object", "/payload");
        }
        if (transient !== undefined && typeof transient !== "boolean") {
            return fail("invalid_payload", "must be a boolean", "/transient");
        }
        for (const key of Object.keys(input)) {
            if (key !== "command" && key !== "payload" && key !== "transient") {
                return fail("invalid_payload", "is not allowed", `/${key}`);
            }
        }
        return this.enqueueOrExecute(
            command,
            payload,
            {
                ...(transient === undefined ? {} : { transient }),
                ...(options.meta === undefined ? {} : { meta: options.meta }),
            },
            "/payload",
        );
    }

    private enqueueOrExecute(
        command: string,
        payload: unknown,
        options: RunOptions | undefined,
        prefix: string,
    ): CommandResult<unknown> {
        if (this.dryRuns > 0) {
            // issued from a middleware during `can` / `check`: nothing may commit, so it is a dry run
            return this.execute(command, payload, options ?? {}, true, prefix);
        }
        if (this.inFlight > 0) {
            // issued from a middleware: runs once the current command committed
            this.queue.push(() => {
                this.execute(command, payload, options ?? {}, false, prefix);
            });
            return fail(
                "queued",
                `"${command}" was issued while another command was running; it runs after it`,
            );
        }
        try {
            return this.execute(command, payload, options ?? {}, false, prefix);
        } finally {
            // a throwing listener or reducer must not strand the commands a middleware queued
            this.drain();
        }
    }

    private drain() {
        while (this.inFlight === 0 && this.queue.length > 0) {
            this.queue.shift()?.();
        }
    }

    private execute(
        command: string,
        payload: unknown,
        options: RunOptions,
        dryRun: boolean,
        prefix: string,
    ): CommandResult<unknown> {
        // a dry run commits nothing, not even the ids it generated
        const ids = dryRun ? this.ids.clone() : this.ids;
        const draft = new Draft(this.committed, ids);
        const execution: Execution = {
            draft,
            dryRun,
            options,
            steps: [],
            thrown: undefined,
        };
        if (dryRun) {
            this.dryRuns++;
        } else {
            this.inFlight++;
        }
        let ran: { result: CommandResult<unknown>; payload: unknown };
        try {
            ran = this.runChain(
                execution,
                command,
                payload,
                { payload: prefix, transient: "/transient" },
                false,
            );
        } finally {
            if (dryRun) {
                this.dryRuns--;
            } else {
                this.inFlight--;
            }
        }
        if (execution.thrown) {
            throw execution.thrown.error;
        }
        const { result } = ran;
        if (!result.ok || dryRun) {
            return result;
        }
        const before = this.committed as unknown as TreeState<T>;
        this.committed = draft.commit(this.freeze);
        const event: CommandEvent<T> = {
            command: command as CommandName,
            payload: ran.payload,
            result: result.value,
            before,
            after: this.committed as unknown as TreeState<T>,
            transient: options.transient === true,
            meta: options.meta,
            ...(command === "batch" ? { commands: execution.steps } : {}),
        };
        this.emit(event);
        return result;
    }

    /**
     * Looks up, validates and runs one command through the middleware chain on the execution's
     * draft. Returns its result, its errors placed at `at`, and the payload the reducer ran with (a
     * middleware may have rewritten it).
     */
    private runChain(
        execution: Execution,
        command: string,
        payload: unknown,
        at: ErrorPaths,
        inBatch: boolean,
    ): { result: CommandResult<unknown>; payload: unknown } {
        const { draft, dryRun, options } = execution;
        const definition = COMMAND_DEFINITIONS.get(command);
        if (!definition) {
            return {
                result: fail("unknown_command", `unknown command "${command}"`),
                payload,
            };
        }
        const failed = invalid(
            validate(definition.payloadSchema, payload, at.payload),
        );
        if (failed) {
            return { result: failed, payload };
        }
        if (options.transient === true && !definition.transient) {
            return {
                result: fail(
                    "invalid_payload",
                    `"${command}" cannot run as a transient step`,
                    at.transient,
                ),
                payload,
            };
        }

        const validated = payload;
        // the command was looked up by name and the payload validated against its schema
        const context = {
            command: command as CommandName,
            payload: payload as PayloadOf<T, CommandName>,
            dryRun,
            transient: options.transient === true,
            inBatch,
            meta: options.meta,
            state: this.committed as unknown as TreeState<T>,
            get: (
                key: CommandContextGetKey,
                query?: { id?: unknown; itemId?: unknown },
            ) => {
                if (key === "item-by") {
                    const id = query?.id;
                    return typeof id === "string"
                        ? itemOf(draft.state, id)
                        : undefined;
                }
                if (key === "item-parent-by") {
                    const itemId = query?.itemId;
                    const parent =
                        typeof itemId === "string"
                            ? parentOf(draft.state, itemId)
                            : undefined;
                    return typeof parent === "string"
                        ? itemOf(draft.state, parent)
                        : undefined;
                }
                return undefined;
            },
        } as CommandContext<T>;

        const reduceContext: ReduceContext = {
            draft,
            validateData: (kind, data, path) =>
                invalid(dataIssues(this.dataSchemas, kind, data, path)),
            loadTree: (json, path) => {
                const built = buildState(
                    json,
                    { dataSchemas: this.dataSchemas, freeze: false },
                    path,
                );
                return built.ok
                    ? built
                    : (invalid(built.issues) ??
                          fail("invalid_payload", "invalid tree"));
            },
            runInBatch: (subCommand, subPayload, path) => {
                const sub = this.runChain(
                    execution,
                    subCommand,
                    subPayload,
                    {
                        payload: `${path}/payload`,
                        transient: `${path}/command`,
                    },
                    true,
                );
                const { result } = sub;
                if (!result.ok) {
                    return result.error.code === "unknown_command"
                        ? fail(
                              "unknown_command",
                              result.error.message,
                              `${path}/command`,
                          )
                        : result;
                }
                execution.steps.push({
                    command: subCommand as CommandName,
                    payload: sub.payload,
                    result: result.value,
                });
                return result;
            },
        };

        let ranWith = payload;
        const core = (): CommandResult<unknown> => {
            const rewritten =
                context.payload !== validated &&
                invalid(
                    validate(definition.payloadSchema, context.payload),
                    "rewritten by a middleware: ",
                );
            if (rewritten) {
                return rewritten;
            }
            ranWith = context.payload;
            try {
                return definition.reduce(
                    context.payload as never,
                    reduceContext,
                );
            } catch (thrown) {
                execution.thrown ??= { error: thrown };
                return fail("refused", "the command failed");
            }
        };
        const result = prefixed(this.chain(context, core), at.payload);
        return { result, payload: ranWith };
    }

    private chain(
        context: CommandContext<T>,
        core: () => CommandResult<unknown>,
    ): CommandResult<unknown> {
        const list = [...this.middleware];
        const at = (i: number): CommandResult<unknown> => {
            const middleware = list[i];
            if (!middleware) {
                return core();
            }
            let called = false;
            let nextResult: CommandResult<unknown> = fail(
                "vetoed",
                "a middleware returned no result",
            );
            const next = () => {
                if (!called) {
                    called = true;
                    nextResult = at(i + 1);
                }
                return nextResult;
            };
            let out: CommandResult<unknown> | undefined;
            try {
                out = middleware(context, next);
            } catch (thrown) {
                return fail(
                    "middleware_error",
                    thrown instanceof Error ? thrown.message : String(thrown),
                );
            }
            if (out === undefined) {
                return nextResult;
            }
            return out;
        };
        return at(0);
    }

    private emit(event: CommandEvent<T>) {
        this.events.push(event);
        if (this.delivering) {
            return;
        }
        this.delivering = true;
        let failure: { error: unknown } | undefined;
        try {
            for (
                let next = this.events.shift();
                next !== undefined;
                next = this.events.shift()
            ) {
                for (const listener of [...this.listeners]) {
                    try {
                        listener(next);
                    } catch (thrown) {
                        failure ??= { error: thrown };
                    }
                }
            }
        } finally {
            this.delivering = false;
        }
        if (failure) {
            throw failure.error;
        }
    }
}

const EMPTY_TREE: TreeJson = { version: 1, rootItemIds: [], items: {} };

/**
 * Creates a tree model from a JSON v1 document (an empty tree without one). The document is
 * validated; an invalid one throws a {@link TreeValidationError} listing every problem with its
 * JSON path.
 */
export function createTreeModel<T extends TreeTypes = AnyTypes>(
    json?: TreeJson<T>,
    options: TreeModelOptions<T> = {},
): TreeModel<T> {
    const ids = new IdSource(options.createId);
    const built = buildState(json ?? EMPTY_TREE, {
        dataSchemas: options.dataSchemas as DataSchemas | undefined,
        freeze: options.freeze ?? true,
    });
    if (!built.ok) {
        throw new TreeValidationError(built.issues);
    }
    return new Model<T>(built.state, ids, options);
}
