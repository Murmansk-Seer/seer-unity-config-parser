# Current move and peak-vote binary layouts

The current adapters are verified with official ConfigPackages `20261105230633` and `20261106181039`. `moves`
contains a signed 32-bit `soercemove` after `SideEffectArg` and before `Type`.
The exact source spelling is retained without assigning a meaning or scale.
`pvpCostMode_vote` reads `type` immediately after `time2`; the old `time3`
slot is absent. Older layouts remain in their original historical commits;
these adapters do not guess the input version or retry another schema.

Evidence / 证据：

- Official bundle SHA256: `6ffa46b114e399ebabbda5772af41f3f5f31767417bed62e94378e1a5fc9932f`.
- The fixture records provenance and exact full-table SHA256 values. Its small
  binary samples contain actual first-record bytes, with only the record count
  changed to one; they retain the original presence flags and Moves root text.
- All 27,414 move records (548,280 field comparisons) and both vote records
  (26 field comparisons) match the independent static Solaris parsers at
  `fbd7a257aac358cb4f3c4f6d68fb71feb842eb86`. Both streams are fully consumed;
  IDs are unique. Ten moves have nonzero source markers.
- This is real-package and independent-parser evidence, not a claim that this
  change re-decompiled the client. No relationship or numeric unit is inferred.

两张表启用写出前完整读取校验。截断、额外尾部字节或其他解析错误会抛出异常，
已有 JSON 不会被该次失败覆盖；其他解析器保持现有行为。完整生产流水线仍须
经过严格 main、合并和 JSON 校验后才能更新快照。部分输出不构成成功发布。

Run `pnpm run test:config-layout` and `pnpm exec tsx scripts/test-autocard-parsers.ts`.
The tests cover exact captured values, zeros, empty strings, unknown source
markers, truncation, trailing bytes and preservation of the last valid output.

Both frozen packages complete strict main, item merging and JSON validation
with 154 outputs in isolated directories. The two affected input files have
identical hashes in both packages. Latest upstream main was checked at
`32a1270003d14bff6495c6a9ba71359e46f145f8` and fails on the same two inputs.
The original fork guard rejects the failed batch; no partial snapshot is adopted.
