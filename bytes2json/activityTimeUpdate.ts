import {
  createSimpleListParser,
  text,
  int,
  type FieldSchema,
} from '../utils/ConfigParserTemplate'

export interface IActivityTimeUpdateConfigInfo {
  beginning: string
  ending: string
  id: number
  name: string
  parameters1: number
  parameters2: number
  parameters3: number
  parameters4: number
  parametersDesc: string
}

export interface ActivityTimeUpdateConfig {
  data?: IActivityTimeUpdateConfigInfo[]
}

const activityTimeUpdateConfigInfoSchema: FieldSchema = [
  ['beginning', text()],
  ['ending', text()],
  ['id', int()],
  ['name', text()],
  ['parameters1', int()],
  ['parameters2', int()],
  ['parameters3', int()],
  ['parameters4', int()],
  ['parametersDesc', text()],
]

export const parseActivityTimeUpdateConfig = createSimpleListParser<
  IActivityTimeUpdateConfigInfo,
  ActivityTimeUpdateConfig
>({
  name: 'Activity_TimeUpdateConfig',
  outputPath: './json/Activity_TimeUpdateConfig.json',
  dataKey: 'data',
  itemSchema: activityTimeUpdateConfigInfoSchema,
})
