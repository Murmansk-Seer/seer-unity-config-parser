import {
  createSimpleListParser,
  text,
  int,
  type FieldSchema,
} from '../utils/ConfigParserTemplate'

export interface IAutocardBuffInfo {
  effectIcon: string
  buffObject: string
  buffParam: string
  buffDes: string
  id: number
  IsDeathEffect: number
  IsPlaceEffect: number
  IsBfBattleEffect: number
  IsColdWaveEffect: number
  IsGrowthEffect: number
}

export interface AutocardBuffConfig {
  data?: IAutocardBuffInfo[]
}

const autocardBuffInfoSchema: FieldSchema = [
  ['IsBfBattleEffect', int()],
  ['IsColdWaveEffect', int()],
  ['IsDeathEffect', int()],
  ['IsGrowthEffect', int()],
  ['IsPlaceEffect', int()],
  ['buffDes', text()],
  ['buffObject', text()],
  ['buffParam', text()],
  ['effectIcon', text()],
  ['id', int()],
]

export const parseAutocardBuffConfig = createSimpleListParser<
  IAutocardBuffInfo,
  AutocardBuffConfig
>({
  name: 'autocardBuff',
  outputPath: './json/autocardBuff.json',
  dataKey: 'data',
  itemSchema: autocardBuffInfoSchema,
})
