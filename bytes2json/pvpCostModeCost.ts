import {
  createSimpleListParser,
  text,
  int,
  type FieldSchema,
} from '../utils/ConfigParserTemplate'

export interface IPvpCostModeCostInfo {
  cost: number
  id: number
  name: string
  pet: string
  time: string
  subkeyMonth: number
  subkeyTotal: number
}

export interface PvpCostModeCostConfig {
  data?: IPvpCostModeCostInfo[]
}

const pvpCostModeCostInfoSchema: FieldSchema = [
  ['cost', int()],
  ['id', int()],
  ['name', text()],
  ['pet', text()],
  ['subkeyMonth', int()],
  ['subkeyTotal', int()],
  ['time', text()],
]

export const parsePvpCostModeCostConfig = createSimpleListParser<
  IPvpCostModeCostInfo,
  PvpCostModeCostConfig
>({
  name: 'pvpCostMode_cost',
  outputPath: './json/pvpCostMode_cost.json',
  dataKey: 'data',
  itemSchema: pvpCostModeCostInfoSchema,
})
