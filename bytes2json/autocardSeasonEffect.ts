import {
  createSimpleListParser,
  text,
  int,
  type FieldSchema,
} from '../utils/ConfigParserTemplate'

export interface IAutocardSeasonEffectInfo {
  BuffDisplay: string
  BuffId: string
  BuffParam: string
  effectName: string
  effectTxt: string
  CountNum: number
  DefaultNum: number
  effectGroup: number
  id: number
  opTurn: number
  picID: number
  season: number
  stageLevel: number
}

export interface AutocardSeasonEffectConfig {
  data?: IAutocardSeasonEffectInfo[]
}

const autocardSeasonEffectInfoSchema: FieldSchema = [
  ['BuffDisplay', text()],
  ['BuffId', text()],
  ['BuffParam', text()],
  ['CountNum', int()],
  ['DefaultNum', int()],
  ['effectGroup', int()],
  ['effectName', text()],
  ['effectTxt', text()],
  ['id', int()],
  ['opTurn', int()],
  ['picID', int()],
  ['season', int()],
  ['stageLevel', int()],
]

export const parseAutocardSeasonEffectConfig = createSimpleListParser<
  IAutocardSeasonEffectInfo,
  AutocardSeasonEffectConfig
>({
  name: 'autocardSeasonEffect',
  outputPath: './json/autocardSeasonEffect.json',
  dataKey: 'data',
  itemSchema: autocardSeasonEffectInfoSchema,
})
