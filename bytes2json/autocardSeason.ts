import {
  createSimpleListParser,
  text,
  int,
  type FieldSchema,
} from '../utils/ConfigParserTemplate'

export interface IAutocardSeasonInfo {
  Drawing_times: string
  battletimes_userinfo: string
  currscores_userinfo: string
  id: number
  maxscores_userinfo: string
  name: string
  rankgroup: string
  reward_useinfo: string
  scorereward1: string
  scorereward2: string
  scorereward3: string
  scorereward4: string
  scorereward5: string
  scorereward6: string
  seasonreward1: string
  seasonreward2: string
  seasonreward3: string
  seasonreward4: string
  seasonreward5: string
  seasonreward6: string
}

export interface AutocardSeasonConfig {
  data?: IAutocardSeasonInfo[]
}

const autocardSeasonInfoSchema: FieldSchema = [
  ['Drawing_times', text()],
  ['battletimes_userinfo', text()],
  ['currscores_userinfo', text()],
  ['id', int()],
  ['maxscores_userinfo', text()],
  ['name', text()],
  ['rankgroup', text()],
  ['reward_useinfo', text()],
  ['scorereward1', text()],
  ['scorereward2', text()],
  ['scorereward3', text()],
  ['scorereward4', text()],
  ['scorereward5', text()],
  ['scorereward6', text()],
  ['seasonreward1', text()],
  ['seasonreward2', text()],
  ['seasonreward3', text()],
  ['seasonreward4', text()],
  ['seasonreward5', text()],
  ['seasonreward6', text()],
]

export const parseAutocardSeasonConfig = createSimpleListParser<
  IAutocardSeasonInfo,
  AutocardSeasonConfig
>({
  name: 'autocardSeason',
  outputPath: './json/autocardSeason.json',
  dataKey: 'data',
  itemSchema: autocardSeasonInfoSchema,
})
