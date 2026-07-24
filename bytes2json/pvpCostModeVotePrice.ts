import {
  createSimpleListParser,
  int,
  type FieldSchema,
} from '../utils/ConfigParserTemplate'

export interface IPvpCostModeVotePriceInfo {
  id: number
  price: number
  rank: number
}

export interface PvpCostModeVotePriceConfig {
  data?: IPvpCostModeVotePriceInfo[]
}

const pvpCostModeVotePriceInfoSchema: FieldSchema = [
  ['id', int()],
  ['price', int()],
  ['rank', int()],
]

export const parsePvpCostModeVotePriceConfig = createSimpleListParser<
  IPvpCostModeVotePriceInfo,
  PvpCostModeVotePriceConfig
>({
  name: 'pvpCostMode_votePrice',
  outputPath: './json/pvpCostMode_votePrice.json',
  dataKey: 'data',
  itemSchema: pvpCostModeVotePriceInfoSchema,
})
