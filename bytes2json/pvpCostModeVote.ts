import {
  createSimpleListParser,
  text,
  int,
  type FieldSchema,
} from '../utils/ConfigParserTemplate'

export interface IPvpCostModeVoteInfo {
  adjust: string
  id: number
  number: number
  pool: number
  ranklimit1: number
  ranklimit2: number
  resultpet: string
  time1: number
  time2: number
  time3: number
  type: number
  votepet: string
}

export interface PvpCostModeVoteConfig {
  data?: IPvpCostModeVoteInfo[]
}

const pvpCostModeVoteInfoSchema: FieldSchema = [
  ['adjust', text()],
  ['id', int()],
  ['number', int()],
  ['pool', int()],
  ['ranklimit1', int()],
  ['ranklimit2', int()],
  ['resultpet', text()],
  ['time1', int()],
  ['time2', int()],
  ['time3', int()],
  ['type', int()],
  ['votepet', text()],
]

export const parsePvpCostModeVoteConfig = createSimpleListParser<
  IPvpCostModeVoteInfo,
  PvpCostModeVoteConfig
>({
  name: 'pvpCostMode_vote',
  outputPath: './json/pvpCostMode_vote.json',
  dataKey: 'data',
  itemSchema: pvpCostModeVoteInfoSchema,
})
