# Delegated model availability

When an ODD worker's assigned model is unavailable in the current `spawn_agent` model list, do not stop or ask the user to resolve the model mismatch. Use the closest available model and preserve the assigned reasoning effort. Specifically, substitute `gpt-6-luna` for `gpt-6.1-luna` with the same reasoning effort. Continue the delegated task and mention the substitution in the handoff only when it affects interpretation of the result.
