import {
  createSimpleListParser,
  text,
  int,
  type FieldSchema,
} from '../utils/ConfigParserTemplate'

export interface IPvpCostModeVoteInfo {
  officialsetpet: string
  adjust: number
  id: number
  previousresultshowtime: number
  ranklimit1: number
  ranklimit2: number
  subkey: number
  previousresultpet: string
  time1: number
  time2: number
  time3: number
  type: number
  votepet: string
  votenumber: number
}

export interface PvpCostModeVoteConfig {
  data?: IPvpCostModeVoteInfo[]
}

const pvpCostModeVoteInfoSchema: FieldSchema = [
  ['adjust', int()],
  ['id', int()],
  ['officialsetpet', text()],
  ['previousresultpet', text()],
  ['previousresultshowtime', int()],
  ['ranklimit1', int()],
  ['ranklimit2', int()],
  ['subkey', int()],
  ['time1', int()],
  ['time2', int()],
  ['time3', int()],
  ['type', int()],
  ['votenumber', int()],
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
