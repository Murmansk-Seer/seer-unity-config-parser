# Parser pipeline-state governance

Status: implemented and verified locally; no remote activation.
Baseline: cfb145e7a857603a04628888564216b7bc32e1d9 (pure-history candidate accepted).

## Responsibility and scope

`main` keeps maintenance code and actual JSON changes. `.build-state/parser/last-release-hashes.json` on a separate `pipeline-state` branch owns the canonical last successful output inventory. The existing shared state action is pinned to e50f91b8dc44002ce0e15cad50e88f2bd34d6210; preserve its predecessor checks, state-only path guard and no-op behavior. No cache timestamp is a data version. Unknown historical payload versions and 27 legacy output ownership entries are preserved, not deleted or relabeled.

## Behavior

- Inventories contain sorted filename/SHA256/size entries over LF-normalized UTF-8 JSON bytes (CRLF checkout spelling is not a data change), no filesystem or poll timestamps. Touching identical files produces identical bytes.
- CI restores the paired state branch before parsing and requires a valid previous inventory. Missing/corrupt/duplicate entries fail before publication. The initial local state seed is delivered separately from the feature commit.
- Existing update/export/strict parse/merge/validate order remains. Failed stages never publish data or state.
- Data publication stages only top-level `json/*.json`, refuses unexpected staged files, records actual input package version and parser-source SHA in an English/Chinese commit, and uses ordinary fast-forward push. Concurrent main updates reject rather than rewrite generated data.
- Advance state only after successful/no-op data publication. State concurrency remains compare-and-append, never forced. A rejected state publish may be retried from a fresh checkout without duplicating an already published JSON commit.
- An unchanged poll changes neither main nor state. No release assets, notification mechanisms, APIs or production configuration are added.

## Verification gates

Exercise real temporary bare Git remotes only: bootstrap seed, byte-identical/touched files, real JSON change, deleted JSON, malformed JSON/cache, duplicate inventory names, missing required state, unrelated staged files, concurrent main and state writers, repeated publish and publication failure. Re-run existing layout/network/Autocard tests and both frozen official packages; JSON parser bytes must stay unchanged. Save/restore full bundles and only the necessary main/state candidate refs before local delivery. No push to a service is authorized.

Python publication code and its Git integration tests use the standard BasedPyright mode, matching the organization code repositories. The scope is explicit; no historical extractor diagnostics are suppressed or declared verified.

Local evidence: 14 inventory tests + 12 data-publisher Git tests, existing8layout/15network/Autocard checks, two actual official154JSON replays, and7shared-action caller transitions pass. Python Ruff/standard BasedPyright have0findings. These are local validations, not historical or production claims.
