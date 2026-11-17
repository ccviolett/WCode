import { getWCodeCopy, type SupportedLocale, type UiLocale } from "@wcode/i18n";

export function formatCliHelp(
  version: string,
  locale?: UiLocale,
  detectedLocale?: SupportedLocale,
): string {
  return getWCodeCopy(locale, detectedLocale).cli.help(version);
}
