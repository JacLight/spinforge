export enum BaseSettingKeys {
  name = 'name',
  config = 'config',
  theme = 'theme',
  preferences = 'preferences',
  features = 'features'
}

export type BaseSettingType = keyof typeof BaseSettingKeys;