import type { UiLocale, SupportedLocale } from "@wcode/contracts";
import { enUS } from "./locales/en-US.js";
import { zhCN } from "./locales/zh-CN.js";
import {
  DEFAULT_LOCALE,
  detectLocale,
  isSupportedLocale,
  isUiLocale,
  resolveLocale,
  SUPPORTED_LOCALES,
} from "./locale.js";
import type { WCodeCopy } from "./types.js";

export {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  detectLocale,
  isSupportedLocale,
  isUiLocale,
  resolveLocale,
};
export type { LocaleDetectionInput } from "./locale.js";
export type { CliCopy, TuiCopy, UiLocale, SupportedLocale, WCodeCopy } from "./types.js";

const CATALOGS: Record<SupportedLocale, WCodeCopy> = {
  "en-US": enUS,
  "zh-CN": zhCN,
};

export function getWCodeCopy(locale?: UiLocale | string, detected?: string | null): WCodeCopy {
  return CATALOGS[resolveLocale(locale, detected)];
}
