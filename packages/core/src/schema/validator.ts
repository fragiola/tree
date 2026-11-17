// From Dockable (fragiola/dockable, packages/core/src/schema/validator.ts), same author and licence.
import type { JsonSchema, ValidationIssue } from "./types";

/**
 * The problems of a value that is not plain JSON (a cycle, a function, `undefined` inside it, a
 * BigInt, a non-finite number, a class instance): data the state cannot hold or write back.
 */
export function jsonIssues(value: unknown, path = ""): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const seen = new Set<object>();
    const visit = (node: unknown, at: string) => {
        if (
            node === null ||
            typeof node === "string" ||
            typeof node === "boolean"
        )
            return;
        if (typeof node === "number") {
            if (!Number.isFinite(node))
                issues.push({ path: at, message: "must be a finite number" });
            return;
        }
        if (typeof node !== "object") {
            issues.push({
                path: at,
                message: `must be JSON, not ${typeof node}`,
            });
            return;
        }
        if (seen.has(node)) {
            issues.push({ path: at, message: "must be JSON, not a cycle" });
            return;
        }
        const prototype = Object.getPrototypeOf(node);
        if (
            !Array.isArray(node) &&
            prototype !== Object.prototype &&
            prototype !== null
        ) {
            issues.push({ path: at, message: "must be a plain object" });
            return;
        }
        seen.add(node);
        for (const [key, child] of Object.entries(node))
            visit(child, joinPointer(at, key));
        seen.delete(node);
    };
    if (value !== undefined) visit(value, path);
    return issues;
}

/** Escapes a key for a JSON pointer (RFC 6901). */
export function pointerSegment(key: string | number): string {
    return String(key).replace(/~/g, "~0").replace(/\//g, "~1");
}

/** Appends a key to a JSON pointer. */
export function joinPointer(path: string, key: string | number): string {
    return `${path}/${pointerSegment(key)}`;
}

/** A JSON object: not an array, not null. */
export function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describe(value: unknown): string {
    return JSON.stringify(value) ?? String(value);
}

function typeMatches(type: string, value: unknown): boolean {
    switch (type) {
        case "object":
            return isObject(value);
        case "array":
            return Array.isArray(value);
        case "string":
            return typeof value === "string";
        case "number":
            return typeof value === "number" && Number.isFinite(value);
        case "integer":
            return Number.isInteger(value);
        case "boolean":
            return typeof value === "boolean";
        case "null":
            return value === null;
        default:
            return true;
    }
}

const ARTICLE: Record<string, string> = {
    object: "an object",
    array: "an array",
    string: "a string",
    number: "a number",
    integer: "an integer",
    boolean: "a boolean",
    null: "null",
};

function deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) {
        return true;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        return (
            a.length === b.length && a.every((item, i) => deepEqual(item, b[i]))
        );
    }
    if (isObject(a) && isObject(b)) {
        const keys = Object.keys(a);
        return (
            keys.length === Object.keys(b).length &&
            keys.every((key) => deepEqual(a[key], b[key]))
        );
    }
    return false;
}

/** Whether a list holds the same JSON value twice (keys in a set: lists of ids are long). */
function hasRepeats(values: readonly unknown[]): boolean {
    const seen = new Set<string>();
    for (const value of values) {
        const key =
            typeof value === "string"
                ? `s${value}`
                : `j${JSON.stringify(value)}`;
        if (seen.has(key)) {
            return true;
        }
        seen.add(key);
    }
    return false;
}

function resolveRef(root: JsonSchema, ref: string): JsonSchema | undefined {
    const match = /^#\/\$defs\/(.+)$/.exec(ref);
    const name = match?.[1]?.replace(/~1/g, "/").replace(/~0/g, "~");
    return name === undefined ? undefined : root.$defs?.[name];
}

/**
 * Validates `value` against `schema` (the subset in {@link JsonSchema}) and returns every problem,
 * each with a JSON pointer relative to `path`. `root` is the document local `$ref`s resolve in.
 */
export function validate(
    schema: JsonSchema,
    value: unknown,
    path = "",
    root: JsonSchema = schema,
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    check(schema, value, path, root, issues);
    return issues;
}

function check(
    schema: JsonSchema,
    value: unknown,
    path: string,
    root: JsonSchema,
    issues: ValidationIssue[],
): void {
    if (schema.$ref !== undefined) {
        const target = resolveRef(root, schema.$ref);
        if (!target) {
            issues.push({ path, message: `unresolved $ref ${schema.$ref}` });
            return;
        }
        check(target, value, path, root, issues);
        return;
    }
    if (schema.anyOf) {
        checkAlternatives(schema.anyOf, value, path, root, issues, false);
        return;
    }
    if (schema.oneOf) {
        checkAlternatives(schema.oneOf, value, path, root, issues, true);
        return;
    }
    if ("const" in schema && !deepEqual(value, schema.const)) {
        issues.push({
            path,
            message: `must be ${describe(schema.const)}`,
        });
        return;
    }
    if (
        schema.enum &&
        !schema.enum.some((allowed) => deepEqual(allowed, value))
    ) {
        issues.push({
            path,
            message: `must be one of ${schema.enum.map(describe).join(", ")}`,
        });
        return;
    }
    if (schema.type !== undefined && !typeMatches(schema.type, value)) {
        issues.push({
            path,
            message: `must be ${ARTICLE[schema.type] ?? schema.type}`,
        });
        return;
    }
    if (typeof value === "number") {
        if (schema.minimum !== undefined && value < schema.minimum) {
            issues.push({ path, message: `must be >= ${schema.minimum}` });
        }
        if (
            schema.exclusiveMinimum !== undefined &&
            value <= schema.exclusiveMinimum
        ) {
            issues.push({
                path,
                message: `must be > ${schema.exclusiveMinimum}`,
            });
        }
    }
    if (
        typeof value === "string" &&
        schema.minLength !== undefined &&
        value.length < schema.minLength
    ) {
        issues.push({
            path,
            message: `must have at least ${schema.minLength} character(s)`,
        });
    }
    if (Array.isArray(value)) {
        if (schema.minItems !== undefined && value.length < schema.minItems) {
            issues.push({
                path,
                message: `must have at least ${schema.minItems} item(s)`,
            });
        }
        if (schema.uniqueItems === true && hasRepeats(value)) {
            issues.push({ path, message: "must not repeat an item" });
        }
        if (schema.items) {
            for (const [i, item] of value.entries()) {
                check(schema.items, item, joinPointer(path, i), root, issues);
            }
        }
    }
    if (isObject(value)) {
        const properties = schema.properties ?? {};
        // own keys only: an inherited one (`toString`, `__proto__`) is not the document's
        for (const key of schema.required ?? []) {
            if (!Object.hasOwn(value, key) || value[key] === undefined) {
                issues.push({
                    path: joinPointer(path, key),
                    message: "is required",
                });
            }
        }
        for (const [key, child] of Object.entries(value)) {
            const property = Object.hasOwn(properties, key)
                ? properties[key]
                : undefined;
            if (property) {
                if (child !== undefined) {
                    check(
                        property,
                        child,
                        joinPointer(path, key),
                        root,
                        issues,
                    );
                }
            } else if (schema.additionalProperties === false) {
                issues.push({
                    path: joinPointer(path, key),
                    message: "is not allowed",
                });
            } else if (
                typeof schema.additionalProperties === "object" &&
                child !== undefined
            ) {
                check(
                    schema.additionalProperties,
                    child,
                    joinPointer(path, key),
                    root,
                    issues,
                );
            }
        }
    }
}

/**
 * anyOf / oneOf. When every alternative fails, the issues of the alternative that matched the
 * value's discriminator (its `type` property, when the alternatives have one) are reported, so a
 * wrong field of one shape is not drowned in the other shapes' noise.
 */
function checkAlternatives(
    alternatives: readonly JsonSchema[],
    value: unknown,
    path: string,
    root: JsonSchema,
    issues: ValidationIssue[],
    exactlyOne: boolean,
): void {
    const results = alternatives.map((alternative) =>
        validate(alternative, value, path, root),
    );
    const passing = results.filter((result) => result.length === 0).length;
    if (exactlyOne ? passing === 1 : passing > 0) {
        return;
    }
    if (passing > 1) {
        issues.push({ path, message: "must match exactly one shape" });
        return;
    }
    const discriminator = joinPointer(path, "type");
    const matched = results.filter(
        (result) => !result.some((issue) => issue.path === discriminator),
    );
    const only = matched.length === 1 ? matched[0] : undefined;
    if (only) {
        issues.push(...only);
        return;
    }
    // the one alternative the value itself fits (its problems are all deeper)
    const shaped = results.filter(
        (result) => !result.some((issue) => issue.path === path),
    );
    const fitting = shaped.length === 1 ? shaped[0] : undefined;
    if (fitting) {
        issues.push(...fitting);
        return;
    }
    const shallow = results.filter((result) =>
        result.every((issue) => issue.path === path),
    );
    if (shallow.length === results.length) {
        // no alternative got past the value itself: report its accepted forms
        const messages = [
            ...new Set(results.flat().map((issue) => issue.message)),
        ];
        issues.push({ path, message: messages.join(" or ") });
        return;
    }
    issues.push({ path, message: "does not match any allowed shape" });
}
