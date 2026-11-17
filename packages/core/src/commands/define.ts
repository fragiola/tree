// From Dockable (fragiola/dockable, packages/core/src/commands/define.ts), same author and licence.
import type { JsonSchema, ValidationIssue } from "../schema/types";
import type { Draft } from "../state/draft";
import type { AnyTypes, TreeState } from "../state/types";
import type {
    CommandError,
    CommandErrorCode,
    CommandName,
    CommandResult,
    PayloadOf,
    ResultOf,
} from "./types";

/** What a reducer can use besides the draft. */
export interface ReduceContext {
    readonly draft: Draft;
    /** validates an item's `data` against its kind's registered schema (undefined: valid) */
    validateData(
        kind: string,
        data: unknown,
        path: string,
    ): Failure | undefined;
    /** builds a whole state from a document at `path` (for `tree.load`) */
    loadTree(
        json: unknown,
        path: string,
    ): { ok: true; state: TreeState } | Failure;
    /** runs one command of a batch on the same draft, through the middleware chain */
    runInBatch(
        command: string,
        payload: unknown,
        path: string,
    ): CommandResult<unknown>;
}

/** A built-in command: its description, schemas and reducer. */
export interface CommandDefinition<C extends CommandName = CommandName> {
    readonly name: C;
    readonly description: string;
    readonly payloadSchema: JsonSchema;
    readonly resultSchema: JsonSchema;
    /** whether it may run as a transient step of a continuous gesture */
    readonly transient: boolean;
    /** applies the command to the draft, or returns why it cannot */
    readonly reduce: (
        payload: PayloadOf<AnyTypes, C>,
        context: ReduceContext,
    ) => CommandResult<ResultOf<AnyTypes, C>>;
}

export function ok<R>(value: R): { readonly ok: true; readonly value: R } {
    return { ok: true, value };
}

/** Why a command did not apply. */
export type Failure = { readonly ok: false; readonly error: CommandError };

export function fail(
    code: CommandErrorCode,
    message: string,
    path?: string,
    issues?: readonly ValidationIssue[],
): Failure {
    const error: { -readonly [K in keyof CommandError]: CommandError[K] } = {
        code,
        message,
    };
    if (path !== undefined) {
        error.path = path;
    }
    if (issues !== undefined) {
        error.issues = issues;
    }
    return { ok: false, error };
}

/** The `invalid_payload` failure of schema issues (the first one's message and path), if any. */
export function invalid(
    issues: readonly ValidationIssue[],
    prefix = "",
): Failure | undefined {
    const [first] = issues;
    return (
        first &&
        fail("invalid_payload", `${prefix}${first.message}`, first.path, issues)
    );
}

/**
 * Declares a command: its payload is typed by its name, and its schemas keep their literal types
 * (the type tests read them with `FromSchema`).
 */
export function defineCommand<
    C extends CommandName,
    const P extends JsonSchema,
    const R extends JsonSchema,
>(
    definition: CommandDefinition<C> & {
        readonly payloadSchema: P;
        readonly resultSchema: R;
    },
): Omit<CommandDefinition<C>, "payloadSchema" | "resultSchema"> & {
    readonly payloadSchema: P;
    readonly resultSchema: R;
} {
    return definition;
}
