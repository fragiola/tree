import type { ExampleMeta } from "../meta-types";

export default {
    title: "Command console",
    description:
        "Drive the tree with JSON commands, as an AI assistant or a script would: every command is listed from the model, and dispatch validates the input.",
    category: "model-api",
    order: 2,
    features: [
        'model.get("commands")',
        "model.dispatch",
        "meta",
        "CommandResult",
    ],
    docs: "/docs/guides/ai-and-automation",
} satisfies ExampleMeta;
