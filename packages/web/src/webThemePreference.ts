import type { Theme } from "@wcode/ui";

const WEB_THEME_VALUES: readonly Theme[] = ["light", "dark", "zai-light", "zai-dark", "system"];
const THEME_STORAGE_KEY = "wcode-theme";

/** 与 packages/ui/src/useTheme.ts 的 normalizeThemePreference 同义：旧值归一到 Zai 主题名。 */
function normalizeTheme(theme: Theme): Theme {
  if (theme === "dark") return "zai-dark";
  if (theme === "light") return "zai-light";
  return theme;
}

/**
 * 读取浏览器本地保存的主题偏好。
 *
 * Web 入口此前把默认主题固定在 Zai dark；改成跟随系统后，未设置过偏好的浏览器
 * 会跟随操作系统亮暗，显式选择过的主题仍以 localStorage 为准。
 * 未知值（旧版本写入的、被外部改坏的）回落到调用方给定的默认主题。
 */
export function resolveWebThemePreference(defaultTheme: Theme = "system"): Theme {
  const saved =
    typeof localStorage === "undefined" ? null : localStorage.getItem(THEME_STORAGE_KEY);
  return normalizeTheme(WEB_THEME_VALUES.find((theme) => theme === saved) ?? defaultTheme);
}
