import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseAutocardBuffConfig } from '../bytes2json/autocardBuff'
import { parseAutocardSkinConfig } from '../bytes2json/autocardSkin'

function int(value: number) {
  const data = Buffer.alloc(4)
  data.writeInt32LE(value)
  return data
}

function text(value: string) {
  const data = Buffer.from(value, 'utf8')
  const length = Buffer.alloc(2)
  length.writeUInt16LE(data.length)
  return Buffer.concat([length, data])
}

const previous = process.cwd()
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'autocard-schema-'))
try {
  process.chdir(directory)
  fs.writeFileSync('buff.bytes', Buffer.concat([
    Buffer.from([1]), int(1), int(1), int(2), int(3), int(4), int(5),
    text('效果描述'), text('卡牌'), text('a_b'), text('icon'), int(10001),
  ]))
  const buff = parseAutocardBuffConfig('buff.bytes').data![0]
  assert.equal(buff.id, 10001)
  assert.equal(buff.IsGrowthEffect, 4)
  assert.equal(buff.IsPlaceEffect, 5)
  assert.equal(buff.buffDes, '效果描述')
  assert.equal(buff.buffObject, '卡牌')
  assert.equal(buff.buffParam, 'a_b')
  fs.writeFileSync('skin.bytes', Buffer.concat([
    Buffer.from([1]), int(1), int(60), text('获取方式'), int(50001), int(1),
    int(520000), text('card_50001'), text(''), int(2), text(''), int(0), int(7),
    text('熔火之心'), int(-123), text('2_史诗'), int(2),
  ]))
  const skin = parseAutocardSkinConfig('skin.bytes').data![0]
  assert.equal(skin.session, 7)
  assert.equal(skin.skinName, '熔火之心')
  assert.equal(skin.stat, -123)
  assert.equal(skin.type, 2)
  assert.throws(() => {
    fs.writeFileSync('truncated.bytes', fs.readFileSync('skin.bytes').subarray(0, 15))
    parseAutocardSkinConfig('truncated.bytes')
  })
  console.log('Autocard schema regression checks passed')
} finally {
  process.chdir(previous)
  fs.rmSync(directory, { recursive: true, force: true })
}
