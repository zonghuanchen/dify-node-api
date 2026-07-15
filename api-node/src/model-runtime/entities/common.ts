/**
 * Internationalized text object.
 * Mirrors Python graphon.model_runtime.entities.common_entities.I18nObject.
 */
export interface I18nObject {
  en_US: string
  zh_Hans?: string | null
}

/**
 * Resolve the best available display string from an I18nObject,
 * preferring en_US and falling back to zh_Hans.
 */
export function resolveI18n(obj: I18nObject | undefined | null, lang?: string): string {
  if (!obj) return ''
  if (lang === 'zh_Hans' && obj.zh_Hans) return obj.zh_Hans
  return obj.en_US ?? obj.zh_Hans ?? ''
}
