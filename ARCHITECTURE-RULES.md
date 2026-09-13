# Architecture rules

## No God Files

Do not create or extend a God File: a source file/module that accumulates unrelated responsibilities or becomes the central place for UI, domain logic, persistence, networking, configuration, security, and orchestration.

Rules:
- Keep one coherent responsibility per module.
- Prefer explicit interfaces between domains.
- Split a module when responsibilities become unrelated or changes routinely affect unrelated behavior.
- Refactor before adding another responsibility to an already overloaded module.
- Do not use a rigid line-count limit as the sole criterion; responsibility and coupling are the primary criteria.
- Generated, binary, asset, save/world, lock and vendor files are exempt.
- New or modified source code must preserve this rule.

Agents must report an architecture split when a task would otherwise require adding an unrelated responsibility to an existing module.
