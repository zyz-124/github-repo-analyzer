import { Moon, Sun, Monitor, Paintbrush, ImageIcon } from "lucide-react";
import { Button } from "./ui/button";
import { useTheme } from "../contexts/ThemeContext";

/**
 * 主题切换按钮
 * - 主题模式下：循环切换 light → dark → system → light
 * - 自定义配色/背景模式下：显示当前模式指示，禁用切换
 */
export function ThemeToggle() {
  const { themeMode, cycleTheme, bgMode, isThemeSwitchEnabled } = useTheme();

  // 自定义模式下的图标和提示
  if (!isThemeSwitchEnabled) {
    const customIcon =
      bgMode === "colors" ? (
        <Paintbrush className="w-5 h-5" />
      ) : (
        <ImageIcon className="w-5 h-5" />
      );

    const customLabel =
      bgMode === "colors"
        ? "当前：自定义配色模式，浅深色切换已禁用"
        : "当前：自定义背景模式，浅深色切换已禁用";

    const customHint =
      bgMode === "colors"
        ? "使用自定义配色中，切换浅深色功能已暂时禁用"
        : "使用自定义背景中，切换浅深色功能已暂时禁用";

    return (
      <Button
        variant="ghost"
        size="icon"
        disabled
        className="rounded-full opacity-60 cursor-not-allowed transition-all duration-300"
        title={customLabel}
        aria-label={customHint}
      >
        {customIcon}
      </Button>
    );
  }

  // 主题模式下的正常切换
  const icon =
    themeMode === "light" ? (
      <Sun className="w-5 h-5 transition-transform duration-300" />
    ) : themeMode === "dark" ? (
      <Moon className="w-5 h-5 transition-transform duration-300" />
    ) : (
      <Monitor className="w-5 h-5 transition-transform duration-300" />
    );

  const label = {
    light: "当前：浅色模式",
    dark: "当前：深色模式",
    system: "当前：跟随系统",
  }[themeMode];

  const nextLabel = {
    light: "切换到深色模式",
    dark: "切换到跟随系统",
    system: "切换到浅色模式",
  }[themeMode];

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      className="rounded-full hover:bg-accent transition-all duration-300 hover:scale-110"
      title={`${label}。点击${nextLabel}`}
      aria-label={nextLabel}
    >
      {icon}
    </Button>
  );
}
