# Agent development rules

## Architecture: no God Files

Never add unrelated responsibilities to an existing source module. Keep UI, game/domain logic, networking, persistence, configuration, security and orchestration separated. Split modules when responsibilities or coupling become unrelated. Prefer explicit interfaces and small cohesive modules.

Do not apply a rigid line-count limit blindly; responsibility and coupling matter more. Generated/binary/save/world/vendor assets are exempt.

Before declaring a task complete, check that the change did not increase architectural coupling or turn a module into a new God File.
