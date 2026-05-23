import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

// ========================
// 类型定义
// ========================

export type ThemeMode = "light" | "dark" | "system";

/** 背景样式模式 */
export type BackgroundMode = "theme" | "colors" | "custom";

interface ThemeContextValue {
  /** 当前主题模式 */
  themeMode: ThemeMode;
  /** 切换主题模式 */
  setThemeMode: (mode: ThemeMode) => void;
  /** 在 light → dark → system 之间循环 */
  cycleTheme: () => void;
  /** 当前背景样式模式 */
  bgMode: BackgroundMode;
  /** 设置背景样式模式（由 SettingsDialog 同步） */
  setBgMode: (mode: BackgroundMode) => void;
  /** 浅深色切换是否可用（仅在主题模式下可用） */
  isThemeSwitchEnabled: boolean;
}

// ========================
// 常量
// ========================

const THEME_STORAGE_KEY = "theme_mode";
const BG_MODE_STORAGE_KEY = "bg_mode";

// ========================
// Context
// ========================

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ========================
// 工具函数
// ========================

function getStoredThemeMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
    // 兼容旧版 'theme' key
    const oldTheme = localStorage.getItem("theme");
    if (oldTheme === "dark") return "dark";
    if (oldTheme === "light") return "light";
  } catch {
    // localStorage 不可用
  }
  return "system";
}

function getStoredBgMode(): BackgroundMode {
  try {
    const stored = localStorage.getItem(BG_MODE_STORAGE_KEY);
    if (stored === "theme" || stored === "colors" || stored === "custom") {
      return stored;
    }
  } catch {
    // localStorage 不可用
  }
  return "theme";
}

/**
 * 将 hex 颜色转为 HSL 分量字符串（格式: "H S% L%"）
 */
export function hexToHsl(hex: string): string {
  // 去掉 # 前缀
  let h = hex.replace(/^#/, "");
  // 支持简写 #RGB → #RRGGBB
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  let s = 0;
  let hue = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        hue = ((b - r) / d + 2) / 6;
        break;
      case b:
        hue = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(hue * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * 将自定义配色应用到标准 CSS 变量
 * 在"自定义配色"模式下覆盖 --primary、--secondary、--accent、--background 等
 */
export function applyCustomColorsToDOM(colors: {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
}) {
  const root = document.documentElement;
  const p = hexToHsl(colors.primary);
  const s = hexToHsl(colors.secondary);
  const a = hexToHsl(colors.accent);
  const bg = hexToHsl(colors.background);

  // 覆盖标准 shadcn/ui 变量
  root.style.setProperty("--primary", p);
  root.style.setProperty("--primary-foreground", "0 0% 100%");
  root.style.setProperty("--secondary", s);
  root.style.setProperty("--secondary-foreground", "0 0% 100%");
  root.style.setProperty("--accent", a);
  root.style.setProperty("--accent-foreground", "0 0% 100%");
  root.style.setProperty("--background", bg);
  root.style.setProperty("--foreground", "0 0% 3.9%");
  root.style.setProperty("--card", bg);
  root.style.setProperty("--card-foreground", "0 0% 3.9%");
  root.style.setProperty("--popover", bg);
  root.style.setProperty("--popover-foreground", "0 0% 3.9%");
  root.style.setProperty("--border", hexToHsl(darkenHex(colors.background, 0.15)));
  root.style.setProperty("--input", hexToHsl(darkenHex(colors.background, 0.15)));
  root.style.setProperty("--ring", p);
  root.style.setProperty("--muted", hexToHsl(lightenHex(colors.background, 0.05)));
  root.style.setProperty("--muted-foreground", "0 0% 45.1%");

  // 同时保留旧的自定义变量（向后兼容）
  root.style.setProperty("--custom-primary", colors.primary);
  root.style.setProperty("--custom-secondary", colors.secondary);
  root.style.setProperty("--custom-accent", colors.accent);
  root.style.setProperty("--custom-background", colors.background);
}

/** 清除由 applyCustomColorsToDOM 设置的标准变量行内覆盖 */
export function removeCustomColorsFromDOM() {
  const root = document.documentElement;
  const vars = [
    "--primary", "--primary-foreground",
    "--secondary", "--secondary-foreground",
    "--accent", "--accent-foreground",
    "--background", "--foreground",
    "--card", "--card-foreground",
    "--popover", "--popover-foreground",
    "--border", "--input", "--ring",
    "--muted", "--muted-foreground",
    "--custom-primary", "--custom-secondary",
    "--custom-accent", "--custom-background",
  ];
  vars.forEach((v) => root.style.removeProperty(v));
}

/** 将 hex 加深指定比例 */
function darkenHex(hex: string, amount: number): string {
  const r = Math.round(Math.max(0, parseInt(hex.slice(1, 3), 16) * (1 - amount)));
  const g = Math.round(Math.max(0, parseInt(hex.slice(3, 5), 16) * (1 - amount)));
  const b = Math.round(Math.max(0, parseInt(hex.slice(5, 7), 16) * (1 - amount)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/** 将 hex 变浅指定比例 */
function lightenHex(hex: string, amount: number): string {
  const r = Math.round(Math.min(255, parseInt(hex.slice(1, 3), 16) + (255 - parseInt(hex.slice(1, 3), 16)) * amount));
  const g = Math.round(Math.min(255, parseInt(hex.slice(3, 5), 16) + (255 - parseInt(hex.slice(3, 5), 16)) * amount));
  const b = Math.round(Math.min(255, parseInt(hex.slice(5, 7), 16) + (255 - parseInt(hex.slice(5, 7), 16)) * amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * 应用主题到 DOM 的 class
 * 仅在背景模式为 "theme" 时生效；
 * 当使用自定义配色或背景时，移除 dark class（由自定义设置接管视觉）
 */
function applyThemeToDOM(mode: ThemeMode, currentBgMode: BackgroundMode) {
  if (currentBgMode !== "theme") {
    // 自定义模式下强制移除 dark class，让自定义配色/背景完全控制视觉
    document.documentElement.classList.remove("dark");
    return;
  }
  const isDark =
    mode === "dark" ||
    (mode === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

// ========================
// Provider
// ========================

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(getStoredThemeMode);
  const [bgMode, setBgModeState] = useState<BackgroundMode>(getStoredBgMode);

  // 初始化：应用主题 + 监听系统主题变化
  useEffect(() => {
    const mode = getStoredThemeMode();
    const bg = getStoredBgMode();
    setThemeModeState(mode);
    setBgModeState(bg);

    // 自定义配色模式下，加载并应用存储的颜色
    if (bg === "colors") {
      try {
        const stored = localStorage.getItem("custom_colors");
        if (stored) {
          const colors = JSON.parse(stored);
          if (colors.primary && colors.secondary && colors.accent && colors.background) {
            applyCustomColorsToDOM(colors);
          }
        }
      } catch {
        // JSON 解析失败静默处理
      }
    }

    applyThemeToDOM(mode, bg);

    // system 模式下监听系统主题变化
    if (mode === "system" && bg === "theme") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyThemeToDOM("system", bg);
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, []);

  // 跨标签页同步（storage 事件在跨标签页时触发）
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY) {
        const mode = getStoredThemeMode();
        const bg = getStoredBgMode();
        setThemeModeState(mode);
        setBgModeState(bg);
        applyThemeToDOM(mode, bg);
      }
      if (e.key === BG_MODE_STORAGE_KEY) {
        const bg = getStoredBgMode();
        setBgModeState(bg);
        // 切换回主题模式时重新应用 light/dark
        if (bg === "theme") {
          const mode = getStoredThemeMode();
          applyThemeToDOM(mode, bg);
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // 当 themeMode 变化时重新应用 (确保 system 模式的 mediaQuery 监听正确)
  useEffect(() => {
    if (themeMode === "system" && bgMode === "theme") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyThemeToDOM("system", bgMode);
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, [themeMode, bgMode]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    const bg = getStoredBgMode();
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
      // 兼容旧版 key
      if (mode !== "system") {
        localStorage.setItem("theme", mode);
      }
    } catch {
      // 静默处理
    }
    applyThemeToDOM(mode, bg);
  }, []);

  const cycleTheme = useCallback(() => {
    const bg = getStoredBgMode();
    // 仅在主题模式下允许循环切换
    if (bg !== "theme") return;

    setThemeModeState((prev) => {
      const next: ThemeMode =
        prev === "light" ? "dark" : prev === "dark" ? "system" : "light";
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
        if (next !== "system") localStorage.setItem("theme", next);
      } catch {
        // 静默处理
      }
      applyThemeToDOM(next, bg);
      return next;
    });
  }, []);

  const setBgMode = useCallback((mode: BackgroundMode) => {
    setBgModeState(mode);
    try {
      localStorage.setItem(BG_MODE_STORAGE_KEY, mode);
    } catch {
      // 静默处理
    }

    if (mode === "theme") {
      // 切换回主题模式：清除自定义颜色覆盖，重新应用浅深色
      removeCustomColorsFromDOM();
      const currentTheme = getStoredThemeMode();
      applyThemeToDOM(currentTheme, mode);
    } else {
      // 自定义配色/背景模式：移除 dark class，由自定义设置控制视觉
      // 具体的颜色/背景应用由 SettingsDialog 的 switchBgMode 在 setBgMode 之后执行
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const isThemeSwitchEnabled = bgMode === "theme";

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        setThemeMode,
        cycleTheme,
        bgMode,
        setBgMode,
        isThemeSwitchEnabled,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

// ========================
// Hook
// ========================

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme 必须在 ThemeProvider 内部使用");
  }
  return ctx;
}
