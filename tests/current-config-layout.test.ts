import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { parseMovesConfig } from '../bytes2json/moves'
import { parsePvpCostModeVoteConfig } from '../bytes2json/pvpCostModeVote'
import { createConfigParser } from '../utils/ConfigParserTemplate'

const fixtures = JSON.parse(fs.readFileSync(new URL('./fixtures/current-config-layout.json', import.meta.url), 'utf8'))

function isolated(run: () => void) {
  const previous = process.cwd()
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'current-config-layout-'))
  try {
    process.chdir(directory)
    run()
  } finally {
    process.chdir(previous)
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()))
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

for (const name of ['moves', 'pvpCostMode_vote'] as const) {
  const fixture = fixtures[name]
  const raw = Buffer.from(fixture.bytes_base64, 'base64')
  const parse = name === 'moves' ? parseMovesConfig : parsePvpCostModeVoteConfig
  test(`${name}: captured official record preserves every field and zero/empty values`, () => isolated(() => {
    fs.writeFileSync('input.bytes', raw)
    const result = parse('input.bytes')
    const records = name === 'moves' ? (result as ReturnType<typeof parseMovesConfig>).MovesTbl!.Moves!.Move! : (result as ReturnType<typeof parsePvpCostModeVoteConfig>).data!
    assert.equal(records.length, 1)
    assert.deepEqual(records[0], fixture.expected)
    if (name === 'pvpCostMode_vote') assert.equal('time3' in records[0], false)
  }))
  test(`${name}: trailing input is rejected before replacing valid JSON`, () => isolated(() => {
    fs.writeFileSync('input.bytes', raw)
    parse('input.bytes')
    const output = path.join('json', `${name}.json`)
    const previous = fs.readFileSync(output)
    fs.writeFileSync('input.bytes', Buffer.concat([raw, Buffer.from([0])]))
    assert.throws(() => parse('input.bytes'), /expected complete input/)
    assert.deepEqual(fs.readFileSync(output), previous)
  }))
  test(`${name}: truncated input is rejected before replacing valid JSON`, () => isolated(() => {
    fs.writeFileSync('input.bytes', raw)
    parse('input.bytes')
    const output = path.join('json', `${name}.json`)
    const previous = fs.readFileSync(output)
    for (const length of [0, 1, Math.floor(raw.length / 2), raw.length - 1]) {
      fs.writeFileSync('input.bytes', raw.subarray(0, length))
      assert.throws(() => parse('input.bytes'))
      assert.deepEqual(fs.readFileSync(output), previous)
    }
  }))
}

test('moves: preserve unknown source marker without scaling or enum guesses', () => isolated(() => {
  const fixture = fixtures.moves
  const raw = Buffer.from(fixture.bytes_base64, 'base64')
  raw.writeInt32LE(123456789, fixture.soercemove_byte_offset)
  fs.writeFileSync('input.bytes', raw)
  const record = parseMovesConfig('input.bytes').MovesTbl!.Moves!.Move![0]
  assert.equal(record.soercemove, 123456789)
  assert.equal(record.Type, fixture.expected.Type)
  assert.equal(record.info, fixture.expected.info)
}))

test('complete-input checking remains opt-in for unrelated existing schemas', () => isolated(() => {
  fs.writeFileSync('input.bytes', Buffer.from([1, 2]))
  const parse = createConfigParser({ name: 'legacy', outputPath: 'legacy.json', parse: reader => reader.boolean() })
  assert.equal(parse('input.bytes'), true)
}))
