import { useState, useEffect, useRef, useCallback } from "react";
import {
  Settings,
  Key,
  Eye,
  EyeOff,
  X,
  Check,
  Image,
  Video,
  Palette,
  Upload,
  Trash2,
  Sun,
  Moon,
  Monitor,
  Paintbrush,
  ImageIcon,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  useTheme,
  type ThemeMode,
  type BackgroundMode,
  applyCustomColorsToDOM,
  removeCustomColorsFromDOM,
} from "../contexts/ThemeContext";

// ========================
// 类型定义
// ========================

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
}

// ========================
// 常量
// ========================

/** 文件上传大小限制：10MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** 预设配色方案 */
const PRESET_THEMES = [
  { name: "默认蓝", primary: "#3b82f6", secondary: "#60a5fa", accent: "#93c5fd" },
  { name: "暗夜紫", primary: "#8b5cf6", secondary: "#a78bfa", accent: "#c4b5fd" },
  { name: "森林绿", primary: "#10b981", secondary: "#34d399", accent: "#6ee7b7" },
  { name: "日落橙", primary: "#f59e0b", secondary: "#fbbf24", accent: "#fcd34d" },
  { name: "玫瑰红", primary: "#ef4444", secondary: "#f87171", accent: "#fca5a5" },
  { name: "青柠绿", primary: "#84cc16", secondary: "#a3e635", accent: "#d9f99d" },
  { name: "赛博朋克", primary: "#ec4899", secondary: "#f472b6", accent: "#f9a8d4" },
  { name: "极简灰", primary: "#6b7280", secondary: "#9ca3af", accent: "#d1d5db" },
];

/** localStorage key 常量 */
const STORAGE_KEYS = {
  TOKEN: "github_token",
  CUSTOM_COLORS: "custom_colors",
  BG_MEDIA_TYPE: "bg_media_type",
  BG_IMAGE: "bg_image",
  BG_VIDEO: "bg_video",
} as const;

// ========================
// 工具函数
// ========================

/**
 * 安全写入 localStorage，捕获可能的异常（容量满、隐私模式等）
 */
function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`[Settings] 无法写入 localStorage (${key}):`, err);
    return false;
  }
}

/**
 * 安全读取 localStorage
 */
function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * 安全解析 JSON，返回 fallback 或 null
 */
function safeJsonParse<T>(key: string, fallback: T): T {
  const raw = safeGetItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    console.warn(`[Settings] JSON 解析失败 (${key})`);
    return fallback;
  }
}

/**
 * 将文件读取为 data URL
 */
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

// ========================
// SettingsDialog 组件
// ========================

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  // --- 共享主题状态 ---
  const { themeMode, setThemeMode, bgMode, setBgMode } = useTheme();

  // --- Token 相关 ---
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- 自定义颜色 ---
  const [customColors, setCustomColors] = useState<ThemeColors>({
    primary: "#3b82f6",
    secondary: "#60a5fa",
    accent: "#93c5fd",
    background: "#ffffff",
  });

  // --- 自定义背景 ---
  const [bgMediaType, setBgMediaType] = useState<"image" | "video">("image");
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [bgVideo, setBgVideo] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // ========================
  // 初始化：一次性加载所有设置
  // ========================

  useEffect(() => {
    // Token
    const storedToken = safeGetItem(STORAGE_KEYS.TOKEN);
    if (storedToken) setToken(storedToken);

    // 自定义颜色
    const colors = safeJsonParse<ThemeColors>(STORAGE_KEYS.CUSTOM_COLORS, {
      primary: "#3b82f6",
      secondary: "#60a5fa",
      accent: "#93c5fd",
      background: "#ffffff",
    });
    setCustomColors(colors);

    // 自定义背景
    const storedMediaType = safeGetItem(STORAGE_KEYS.BG_MEDIA_TYPE);
    if (storedMediaType === "image" || storedMediaType === "video") {
      setBgMediaType(storedMediaType);
    }

    const storedBgImage = safeGetItem(STORAGE_KEYS.BG_IMAGE);
    if (storedBgImage) setBgImage(storedBgImage);

    const storedBgVideo = safeGetItem(STORAGE_KEYS.BG_VIDEO);
    if (storedBgVideo) setBgVideo(storedBgVideo);

    // cleanup：组件卸载时清除定时器
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // ========================
  // Token 操作
  // ========================

  const handleSaveToken = () => {
    if (!token.trim()) return;
    safeSetItem(STORAGE_KEYS.TOKEN, token.trim());
    setSaved(true);

    // 清理之前的定时器
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaved(false), 2000);
  };

  const handleClearToken = () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
    } catch {
      // 忽略
    }
    setToken("");
    setSaved(false);
  };

  // ========================
  // 背景模式切换（互斥）
  // ========================

  const removeBackgroundElement = () => {
    const existingBg = document.getElementById("custom-background");
    if (existingBg) existingBg.remove();
  };

  const resetColorVariables = () => {
    removeCustomColorsFromDOM();
  };

  const switchBgMode = (mode: BackgroundMode) => {
    // 清除所有效果
    removeBackgroundElement();
    resetColorVariables();

    // 通过 Context 统一更新 bgMode（自动写入 localStorage + 处理主题逻辑）
    setBgMode(mode);

    switch (mode) {
      case "theme":
        // Context 的 setBgMode 已自动重新应用当前主题
        break;
      case "colors":
        applyColors(customColors);
        break;
      case "custom":
        // 应用已上传的背景
        const savedMediaType = safeGetItem(STORAGE_KEYS.BG_MEDIA_TYPE);
        if (savedMediaType === "image") {
          const savedImage = safeGetItem(STORAGE_KEYS.BG_IMAGE);
          if (savedImage) applyBackground("image", savedImage);
        } else if (savedMediaType === "video") {
          const savedVideo = safeGetItem(STORAGE_KEYS.BG_VIDEO);
          if (savedVideo) applyBackground("video", savedVideo);
        }
        break;
    }
  };

  // ========================
  // 主题模式切换
  // ========================

  const handleThemeModeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  // ========================
  // 自定义颜色
  // ========================

  const applyColors = (colors: ThemeColors) => {
    applyCustomColorsToDOM(colors);
  };

  const handleColorChange = (key: keyof ThemeColors, value: string) => {
    const newColors = { ...customColors, [key]: value };
    setCustomColors(newColors);
    safeSetItem(STORAGE_KEYS.CUSTOM_COLORS, JSON.stringify(newColors));
    if (bgMode === "colors") applyColors(newColors);
  };

  const applyPresetTheme = (preset: (typeof PRESET_THEMES)[number]) => {
    const newColors: ThemeColors = {
      primary: preset.primary,
      secondary: preset.secondary,
      accent: preset.accent,
      background: "#ffffff",
    };
    setCustomColors(newColors);
    safeSetItem(STORAGE_KEYS.CUSTOM_COLORS, JSON.stringify(newColors));
    if (bgMode === "colors") applyColors(newColors);
  };

  // ========================
  // 自定义背景
  // ========================

  const applyBackground = (type: string, data: string | null) => {
    removeBackgroundElement();

    if (!data) return;

    if (type === "image") {
      const bg = document.createElement("div");
      bg.id = "custom-background";
      bg.className = "custom-bg-image";
      bg.style.cssText = `
        position: fixed; top: 0; left: 0;
        width: 100%; height: 100%;
        background-image: url(${data});
        background-size: cover;
        background-position: center;
        opacity: 0.3;
        pointer-events: none;
        z-index: 0;
      `;
      document.body.appendChild(bg);
    } else if (type === "video") {
      const video = document.createElement("video");
      video.id = "custom-background";
      video.src = data;
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.style.cssText = `
        position: fixed; top: 0; left: 0;
        width: 100%; height: 100%;
        object-fit: cover;
        opacity: 0.3;
        pointer-events: none;
        z-index: 0;
      `;
      video.addEventListener("error", () => video.remove(), { once: true });
      document.body.appendChild(video);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 文件大小校验
    if (file.size > MAX_FILE_SIZE) {
      alert(
        `图片文件过大（${(file.size / 1024 / 1024).toFixed(1)}MB），请选择小于 ${MAX_FILE_SIZE / 1024 / 1024}MB 的文件。`
      );
      // 重置 input 以便重新选择同一文件
      e.target.value = "";
      return;
    }

    // 文件类型校验
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      alert("不支持的图片格式，请选择 JPG、PNG、GIF 或 WebP 格式。");
      e.target.value = "";
      return;
    }

    try {
      const dataUrl = await readFileAsDataURL(file);

      // 检查 data URL 大小（Base64 编码会增大 ~33%）
      if (dataUrl.length > MAX_FILE_SIZE * 2) {
        alert("图片过大，请选择更小的图片文件。");
        e.target.value = "";
        return;
      }

      setBgImage(dataUrl);
      setBgMediaType("image");
      const saved1 = safeSetItem(STORAGE_KEYS.BG_IMAGE, dataUrl);
      const saved2 = safeSetItem(STORAGE_KEYS.BG_MEDIA_TYPE, "image");

      if (!saved1 || !saved2) {
        alert("保存失败，可能是存储空间不足。请尝试使用更小的图片。");
      }

      if (bgMode === "custom") applyBackground("image", dataUrl);
    } catch {
      alert("图片读取失败，请重试。");
    }

    // 重置 input
    e.target.value = "";
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 文件大小校验
    if (file.size > MAX_FILE_SIZE) {
      alert(
        `视频文件过大（${(file.size / 1024 / 1024).toFixed(1)}MB），请选择小于 ${MAX_FILE_SIZE / 1024 / 1024}MB 的文件。`
      );
      e.target.value = "";
      return;
    }

    // 文件类型校验
    const allowedTypes = ["video/mp4", "video/webm"];
    if (!allowedTypes.includes(file.type)) {
      alert("不支持的视频格式，请选择 MP4 或 WebM 格式。");
      e.target.value = "";
      return;
    }

    try {
      const dataUrl = await readFileAsDataURL(file);

      if (dataUrl.length > MAX_FILE_SIZE * 3) {
        alert("视频过大，请选择更小的视频文件。上传视频将作为 Base64 存储，建议使用短小的循环视频。");
        e.target.value = "";
        return;
      }

      setBgVideo(dataUrl);
      setBgMediaType("video");
      const saved1 = safeSetItem(STORAGE_KEYS.BG_VIDEO, dataUrl);
      const saved2 = safeSetItem(STORAGE_KEYS.BG_MEDIA_TYPE, "video");

      if (!saved1 || !saved2) {
        alert("保存失败，可能是存储空间不足。建议使用短小的循环视频（< 2MB）。");
      }

      if (bgMode === "custom") applyBackground("video", dataUrl);
    } catch {
      alert("视频读取失败，请重试。");
    }

    e.target.value = "";
  };

  const handleRemoveBackground = () => {
    setBgImage(null);
    setBgVideo(null);
    try {
      localStorage.removeItem(STORAGE_KEYS.BG_IMAGE);
      localStorage.removeItem(STORAGE_KEYS.BG_VIDEO);
    } catch {
      // 忽略
    }
    removeBackgroundElement();
  };

  // ========================
  // Escape 键关闭
  // ========================

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // ========================
  // 条件渲染
  // ========================

  if (!open) return null;

  const modeOptions: {
    key: BackgroundMode;
    label: string;
    desc: string;
    icon: React.ReactNode;
  }[] = [
    {
      key: "theme",
      label: "主题模式",
      desc: "选择浅色或深色主题",
      icon: <Sun className="w-5 h-5" />,
    },
    {
      key: "colors",
      label: "自定义配色",
      desc: "选择预设主题或自定义颜色",
      icon: <Paintbrush className="w-5 h-5" />,
    },
    {
      key: "custom",
      label: "自定义背景",
      desc: "上传图片或视频作为背景",
      icon: <ImageIcon className="w-5 h-5" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        role="presentation"
      />

      {/* Dialog */}
      <Card className="relative z-10 w-full max-w-lg mx-4 animate-scale-in dark:bg-slate-800 max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 sticky top-0 bg-card dark:bg-slate-800 z-10 border-b">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            <CardTitle>设置</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="关闭设置"
          >
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>

        <CardContent className="pt-4">
          <Tabs defaultValue="appearance" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="appearance" className="text-xs sm:text-sm">
                <Palette className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">外观</span>
              </TabsTrigger>
              <TabsTrigger value="token" className="text-xs sm:text-sm">
                <Key className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">Token</span>
              </TabsTrigger>
            </TabsList>

            {/* ========== 外观设置 ========== */}
            <TabsContent value="appearance" className="space-y-5 mt-4">
              {/* 模式选择：三选一 */}
              <div className="space-y-3">
                <label className="text-sm font-medium">背景样式</label>
                <div className="space-y-2">
                  {modeOptions.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => switchBgMode(opt.key)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                        bgMode === opt.key
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-transparent bg-muted/50 hover:bg-muted"
                      }`}
                    >
                      <div
                        className={`p-2 rounded-md ${
                          bgMode === opt.key
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {opt.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{opt.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {opt.desc}
                        </div>
                      </div>
                      {bgMode === opt.key && (
                        <Check className="w-4 h-4 text-primary shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* --- 主题模式选项 --- */}
              {bgMode === "theme" && (
                <div className="space-y-3 pl-1 border-l-2 border-primary/30 ml-2">
                  <label className="text-sm font-medium">选择主题</label>
                  <div className="flex gap-2">
                    <Button
                      variant={themeMode === "light" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleThemeModeChange("light")}
                      className="flex-1"
                    >
                      <Sun className="w-4 h-4 mr-1" />
                      浅色
                    </Button>
                    <Button
                      variant={themeMode === "dark" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleThemeModeChange("dark")}
                      className="flex-1"
                    >
                      <Moon className="w-4 h-4 mr-1" />
                      深色
                    </Button>
                    <Button
                      variant={themeMode === "system" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleThemeModeChange("system")}
                      className="flex-1"
                    >
                      <Monitor className="w-4 h-4 mr-1" />
                      跟随系统
                    </Button>
                  </div>
                </div>
              )}

              {/* --- 自定义配色选项 --- */}
              {bgMode === "colors" && (
                <div className="space-y-4 pl-1 border-l-2 border-primary/30 ml-2">
                  {/* 预设主题 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">预设配色</label>
                    <div className="grid grid-cols-4 gap-2">
                      {PRESET_THEMES.map((preset) => (
                        <button
                          key={preset.name}
                          onClick={() => applyPresetTheme(preset)}
                          className="relative h-12 rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-colors"
                          title={preset.name}
                        >
                          <div
                            className="absolute inset-0"
                            style={{
                              background: `linear-gradient(135deg, ${preset.primary} 50%, ${preset.secondary} 50%)`,
                            }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 自定义颜色选择器 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">自定义颜色</label>
                    <div className="grid grid-cols-2 gap-3">
                      {(
                        [
                          { key: "primary" as const, label: "主色" },
                          { key: "secondary" as const, label: "辅助色" },
                          { key: "accent" as const, label: "强调色" },
                          { key: "background" as const, label: "背景色" },
                        ] as const
                      ).map(({ key, label }) => (
                        <div
                          key={key}
                          className="flex items-center gap-2"
                        >
                          <label className="text-xs text-muted-foreground w-16">
                            {label}
                          </label>
                          <input
                            type="color"
                            value={customColors[key]}
                            onChange={(e) =>
                              handleColorChange(key, e.target.value)
                            }
                            className="w-8 h-8 rounded cursor-pointer border-0"
                            aria-label={label}
                          />
                          <span className="text-xs font-mono">
                            {customColors[key]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* --- 自定义背景选项 --- */}
              {bgMode === "custom" && (
                <div className="space-y-4 pl-1 border-l-2 border-primary/30 ml-2">
                  {/* 背景预览 */}
                  {(bgImage || bgVideo) && (
                    <div className="relative rounded-lg overflow-hidden h-32">
                      {bgMediaType === "image" && bgImage && (
                        <img
                          src={bgImage}
                          alt="背景预览"
                          className="w-full h-full object-cover"
                        />
                      )}
                      {bgMediaType === "video" && bgVideo && (
                        <video
                          src={bgVideo}
                          className="w-full h-full object-cover"
                          muted
                          autoPlay
                          loop
                          playsInline
                        />
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="text-white text-sm">当前背景</span>
                      </div>
                    </div>
                  )}

                  {/* 上传图片 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Image className="w-4 h-4" />
                      上传背景图片
                    </label>
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      onClick={() => imageInputRef.current?.click()}
                      className="w-full"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      选择图片
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      支持 JPG、PNG、GIF、WebP 格式（最大 {MAX_FILE_SIZE / 1024 / 1024}MB）
                    </p>
                  </div>

                  {/* 上传视频 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Video className="w-4 h-4" />
                      上传背景视频
                    </label>
                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/mp4,video/webm"
                      onChange={handleVideoUpload}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      onClick={() => videoInputRef.current?.click()}
                      className="w-full"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      选择视频
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      支持 MP4、WebM 格式（最大 {MAX_FILE_SIZE / 1024 / 1024}MB），视频将自动静音循环播放
                    </p>
                  </div>

                  {/* 移除背景 */}
                  {(bgImage || bgVideo) && (
                    <Button
                      variant="destructive"
                      onClick={handleRemoveBackground}
                      className="w-full"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      移除背景
                    </Button>
                  )}

                  {/* 空状态提示 */}
                  {!bgImage && !bgVideo && (
                    <div className="text-center py-6 text-muted-foreground">
                      <Image className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">暂无自定义背景</p>
                      <p className="text-xs">
                        上传图片或视频作为页面背景
                      </p>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ========== Token 设置 ========== */}
            <TabsContent value="token" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-muted-foreground" />
                  <label className="text-sm font-medium">
                    GitHub Personal Access Token
                  </label>
                </div>
                <CardDescription className="text-xs">
                  添加 Token 可将 API 请求限额从 60 次/小时提升至 5000
                  次/小时。前往 GitHub Settings → Developer settings →
                  Personal access tokens 生成（无需勾选任何权限即可用于公开仓库查询）。
                </CardDescription>
                <div className="relative">
                  <Input
                    type={showToken ? "text" : "password"}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="pr-10 font-mono text-sm"
                    autoComplete="off"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowToken(!showToken)}
                    aria-label={showToken ? "隐藏 Token" : "显示 Token"}
                  >
                    {showToken ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveToken}
                    disabled={!token.trim()}
                    className="flex-1"
                  >
                    {saved ? (
                      <>
                        <Check className="w-4 h-4 mr-1" />
                        已保存
                      </>
                    ) : (
                      "保存 Token"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleClearToken}
                    disabled={!token}
                  >
                    清除
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
