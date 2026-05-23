import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  Github,
  Search,
  Star,
  GitFork,
  Calendar,
  AlertCircle,
  Users,
  Code,
  ExternalLink,
  Loader2,
  Eye,
  CircleDot,
  FileText,
  CheckCircle,
  XCircle,
  Download,
  Settings,
  Sparkles,
  Languages,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/ui/card";
import { Badge } from "./components/ui/badge";
import { Separator } from "./components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "./components/ui/alert";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import html2canvas from "html2canvas";
import {
  parseRepoUrl,
  fetchRepo,
  fetchLanguages,
  fetchContributors,
  fetchCommitActivity,
  fetchReadme,
} from "./services/githubApi";
import type { RepoAnalysisResult } from "./types/github";
import { ThemeToggle } from "./components/ThemeToggle";
import { SettingsDialog } from "./components/SettingsDialog";
import { LoadingSkeleton } from "./components/LoadingSkeleton";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";

// ========================
// 常量
// ========================

/** 图表配色方案 */
const CHART_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#6366f1",
] as const;

/** localStorage 中存储的最大图片/视频大小限制 (10MB) */
const MAX_MEDIA_SIZE = 10 * 1024 * 1024;

// ========================
// 类型定义
// ========================

interface ReadmeCheck {
  name: string;
  pass: boolean;
}

interface ReadmeQuality {
  score: number;
  checks: ReadmeCheck[];
}

// ========================
// 工具函数
// ========================

/**
 * 格式化大数字（如 1234 -> 1.2k，1234567 -> 1.2M）
 */
function formatNumber(num: number): string {
  if (!Number.isFinite(num) || num < 0) return "0";
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "k";
  return num.toLocaleString();
}

/**
 * 格式化日期为中文格式
 */
function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("zh-CN");
  } catch {
    return dateStr;
  }
}

/**
 * 安全解析 JSON，失败时返回 null
 */
function safeJsonParse<T>(str: string | null, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str) as T;
  } catch {
    console.warn("[App] JSON 解析失败，使用默认值");
    return fallback;
  }
}

/**
 * 安全读取 localStorage 并解析 JSON
 */
function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    console.warn(`[App] 无法读取 localStorage key: ${key}`);
    return null;
  }
}

// ========================
// 主组件
// ========================

function AppContent() {
  // --- 共享主题状态 ---
  const { themeMode } = useTheme();

  // --- 核心状态 ---
  const [repoUrl, setRepoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RepoAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [readmeQuality, setReadmeQuality] = useState<ReadmeQuality | null>(
    null
  );

  // --- UI 状态 ---
  const [sharing, setSharing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translatedDesc, setTranslatedDesc] = useState<string | null>(null);

  // --- Refs ---
  const resultRef = useRef<HTMLDivElement>(null);
  /** AbortController 用于取消进行中的翻译请求，避免竞态条件 */
  const translateAbortRef = useRef<AbortController | null>(null);
  /** 背景 DOM 元素引用，用于 cleanup */
  const bgElementRef = useRef<HTMLElement | null>(null);

  // ========================
  // 初始化：背景 & 主题
  // ========================

  useEffect(() => {
    // 清理上一次的背景元素（防止 StrictMode 双重挂载导致重复）
    const existingBg = document.getElementById("custom-background");
    if (existingBg) existingBg.remove();

    const bgType = safeGetItem("bg_type") as
      | "none"
      | "image"
      | "video"
      | null;

    if (bgType === "image") {
      const bgImage = safeGetItem("bg_image");
      if (bgImage) {
        const bg = document.createElement("div");
        bg.id = "custom-background";
        bg.className = "custom-bg-image";
        bg.style.cssText = `
          position: fixed; top: 0; left: 0;
          width: 100%; height: 100%;
          background-image: url(${bgImage});
          background-size: cover;
          background-position: center;
          opacity: 0.3;
          pointer-events: none;
          z-index: 0;
        `;
        document.body.appendChild(bg);
        bgElementRef.current = bg;
      }
    } else if (bgType === "video") {
      const bgVideo = safeGetItem("bg_video");
      if (bgVideo) {
        const video = document.createElement("video");
        video.id = "custom-background";
        video.src = bgVideo;
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
        // 视频加载失败时静默处理
        video.addEventListener(
          "error",
          () => {
            console.warn("[App] 背景视频加载失败，已移除");
            video.remove();
          },
          { once: true }
        );
        document.body.appendChild(video);
        bgElementRef.current = video;
      }
    }

    // 自定义颜色由 ThemeContext 统一管理，此处不再重复初始化

    // Cleanup：组件卸载时移除背景元素
    return () => {
      if (bgElementRef.current && bgElementRef.current.parentNode) {
        bgElementRef.current.remove();
        bgElementRef.current = null;
      }
    };
  }, []);

  // ========================
  // README 质量检测
  // ========================

  const checkReadmeQuality = useCallback(
    (readme: string | null): ReadmeQuality => {
      if (!readme) {
        return {
          score: 0,
          checks: [
            { name: "存在 README 文件", pass: false },
            { name: "包含项目标题", pass: false },
            { name: "包含项目描述", pass: false },
            { name: "包含安装说明", pass: false },
            { name: "包含使用说明", pass: false },
            { name: "包含贡献指南", pass: false },
            { name: "包含许可证信息", pass: false },
            { name: "README 长度足够", pass: false },
          ],
        };
      }

      const checks: ReadmeCheck[] = [
        { name: "存在 README 文件", pass: true },
        {
          name: "包含项目标题",
          pass: /#{1,2}\s+\S/m.test(readme),
        },
        { name: "包含项目描述", pass: readme.length > 200 },
        {
          name: "包含安装说明",
          pass:
            /(npm\s+)?install|yarn\s+add|pip\s+install|gem\s+install|go\s+get|cargo\s+install|安装/.test(
              readme
            ),
        },
        {
          name: "包含使用说明",
          pass:
            /usage|getting\s+started|quick\s*start|使用|示例|快速开始|documentation/.test(
              readme
            ),
        },
        {
          name: "包含贡献指南",
          pass:
            /contribut|贡献|pull\s*request|CONTRIBUTING|pr\s/i.test(readme),
        },
        {
          name: "包含许可证信息",
          pass:
            /license|licence|许可|许可证|MIT|Apache|GPL|BSD/i.test(readme),
        },
        { name: "README 长度足够", pass: readme.length > 500 },
      ];

      const score = Math.round(
        (checks.filter((c) => c.pass).length / checks.length) * 100
      );
      return { score, checks };
    },
    []
  );

  // ========================
  // 描述翻译（带竞态保护）
  // ========================

  const translateText = useCallback(async (text: string) => {
    if (!text) return;

    // 取消之前的翻译请求
    translateAbortRef.current?.abort();
    const controller = new AbortController();
    translateAbortRef.current = controller;

    setTranslating(true);
    setTranslatedDesc(null);

    try {
      const response = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
          text
        )}&langpair=en|zh-CN`,
        { signal: controller.signal }
      );

      if (controller.signal.aborted) return;

      const data = await response.json();

      if (controller.signal.aborted) return;

      if (data.responseStatus === 200 && data.responseData?.translatedText) {
        setTranslatedDesc(data.responseData.translatedText);
      } else {
        // 翻译失败时保留原文
        setTranslatedDesc(text);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // 被取消的请求，什么也不做
        return;
      }
      // 网络错误时保留原文
      if (!controller.signal.aborted) {
        setTranslatedDesc(text);
      }
    } finally {
      if (!controller.signal.aborted) {
        setTranslating(false);
      }
    }
  }, []);

  // ========================
  // 核心分析流程
  // ========================

  const handleAnalyze = useCallback(async () => {
    const trimmedUrl = repoUrl.trim();
    if (!trimmedUrl) {
      setError("请输入 GitHub 仓库链接");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setReadmeQuality(null);
    setTranslatedDesc(null);

    // 取消进行中的翻译
    translateAbortRef.current?.abort();

    try {
      const parsed = parseRepoUrl(trimmedUrl);
      if (!parsed) {
        throw new Error(
          "无法解析仓库链接，请使用以下格式之一：\n" +
            "• https://github.com/owner/repo\n" +
            "• owner/repo"
        );
      }

      const { owner, repo } = parsed;

      // 并行请求所有数据，失败项不回滚整体
      const [repoData, languages, contributors, commitActivity, readme] =
        await Promise.all([
          fetchRepo(owner, repo),
          fetchLanguages(owner, repo),
          fetchContributors(owner, repo),
          fetchCommitActivity(owner, repo).catch(
            (): typeof commitActivity => {
              console.warn("[App] 获取提交活动数据失败");
              return [];
            }
          ),
          fetchReadme(owner, repo).catch(
            (): null => {
              console.warn("[App] 获取 README 失败");
              return null;
            }
          ),
        ]);

      setReadmeQuality(checkReadmeQuality(readme));

      setResult({
        repo: repoData,
        languages,
        contributors,
        commitActivity,
        readme,
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "分析过程中发生未知错误，请稍后重试";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [repoUrl, checkReadmeQuality]);

  // ========================
  // 分享/截图功能
  // ========================

  const handleShare = useCallback(async () => {
    if (!resultRef.current || !result) return;

    setSharing(true);
    try {
      // 根据当前主题选择合适的背景色
      const isDark =
        themeMode === "dark" ||
        (themeMode === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      const bgColor = isDark ? "#0f172a" : "#f8fafc";

      const canvas = await html2canvas(resultRef.current, {
        backgroundColor: bgColor,
        scale: 2,
        useCORS: true, // 跨域图片（如头像）支持
        logging: false,
      });

      const link = document.createElement("a");
      const safeName = result.repo.full_name.replace(/[\/\\:*?"<>|]/g, "_");
      link.download = `${safeName}_analysis.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("[App] 截图生成失败:", err);
      alert("生成图片失败，请重试。如持续失败，可尝试减小窗口后再试。");
    } finally {
      setSharing(false);
    }
  }, [result]);

  // ========================
  // 派生数据（图表用）
  // ========================

  const languageChartData = useMemo(() => {
    if (!result) return [];
    const entries = Object.entries(result.languages);
    if (entries.length === 0) return [];

    const total = entries.reduce((a, [, b]) => a + b, 0);
    if (total === 0) return [];

    return entries
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({
        name,
        value,
        percentage: ((value / total) * 100).toFixed(1),
      }));
  }, [result]);

  const commitChartData = useMemo(() => {
    if (!result || !Array.isArray(result.commitActivity)) return [];
    const activity = result.commitActivity;
    if (activity.length === 0) return [];

    return activity.slice(-12).map((week, i) => ({
      week: `第${i + 1}周`,
      commits: week.total,
    }));
  }, [result]);

  /** 提交热图数据：最近12周 x 7天 */
  const commitHeatmapData = useMemo(() => {
    if (!result || !Array.isArray(result.commitActivity)) return [];
    return result.commitActivity
      .slice(-12)
      .flatMap((week) => week.days);
  }, [result]);

  // ========================
  // 快捷键
  // ========================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K 打开搜索框聚焦
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>(
          'input[placeholder*="GitHub 仓库"]'
        );
        input?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ========================
  // 渲染
  // ========================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 animate-gradient">
      {/* 背景模糊叠加层 */}
      <div className="fixed inset-0 bg-overlay z-0" />

      {/* 导航栏 */}
      <nav className="border-b glass sticky top-0 z-50 relative">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Github className="w-8 h-8 text-primary" />
              <Sparkles className="w-3 h-3 absolute -top-1 -right-1 text-yellow-500 animate-pulse" />
            </div>
            <div>
              <span className="text-xl font-bold gradient-text">
                GitHub Repo Analyzer
              </span>
              <span className="hidden sm:inline text-xs text-muted-foreground ml-2">
                ✨ 探索开源世界
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              className="hover:bg-accent transition-all duration-300"
              aria-label="打开设置"
            >
              <Settings className="w-5 h-5" />
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* 主内容区 */}
      <main className="container mx-auto px-4 py-12 relative z-10">
        {/* 标题区 */}
        <div className="text-center mb-12 animate-slide-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            开源仓库分析利器
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="gradient-text">分析任意</span> GitHub 仓库
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            输入仓库链接，获取代码语言分布、贡献者活跃度、提交频率等可视化分析
          </p>
        </div>

        {/* 搜索框 */}
        <Card
          className="max-w-2xl mx-auto mb-12 card-hover animate-slide-up"
          style={{ animationDelay: "0.1s" }}
        >
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="输入 GitHub 仓库链接，如: https://github.com/facebook/react"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="pl-10 h-12 text-base"
                  onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                  disabled={loading}
                  autoComplete="url"
                  aria-label="GitHub 仓库链接"
                />
              </div>
              <Button
                onClick={handleAnalyze}
                disabled={loading || !repoUrl.trim()}
                size="lg"
                className="btn-press transition-all duration-200 shrink-0"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    分析中...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    分析
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 错误提示 */}
        {error && (
          <Alert
            variant="destructive"
            className="max-w-2xl mx-auto mb-8 animate-slide-up"
          >
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>出错了</AlertTitle>
            <AlertDescription className="whitespace-pre-line">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* 加载骨架屏 */}
        {loading && <LoadingSkeleton />}

        {/* 分析结果 */}
        {result && (
          <div ref={resultRef} className="space-y-8 max-w-5xl mx-auto">
            {/* 仓库基本信息 */}
            <Card className="card-hover animate-slide-up">
              <CardHeader>
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <img
                      src={result.repo.owner.avatar_url}
                      alt={`${result.repo.owner.login} 头像`}
                      className="w-16 h-16 rounded-full ring-2 ring-primary/20"
                      loading="lazy"
                      onError={(e) => {
                        // 头像加载失败时显示占位符
                        (e.target as HTMLImageElement).src =
                          "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect fill='%23e2e8f0' width='100' height='100'/><text x='50' y='55' text-anchor='middle' fill='%2394a3b8' font-size='40'>?</text></svg>";
                      }}
                    />
                    <div>
                      <CardTitle className="text-2xl">
                        <a
                          href={result.repo.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline flex items-center gap-2 hover:text-primary transition-colors"
                        >
                          {result.repo.full_name}
                          <ExternalLink className="w-4 h-4 text-muted-foreground" />
                        </a>
                      </CardTitle>
                      <CardDescription className="mt-1 text-base flex items-center gap-2 flex-wrap">
                        <span className="line-clamp-2">
                          {translatedDesc ||
                            result.repo.description ||
                            "暂无描述"}
                        </span>
                        {result.repo.description &&
                          !translating &&
                          !translatedDesc && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                translateText(result.repo.description!)
                              }
                              className="h-auto p-0 text-xs text-muted-foreground hover:text-primary shrink-0"
                              aria-label="翻译仓库描述"
                            >
                              <Languages className="w-3 h-3 mr-1" />
                              翻译
                            </Button>
                          )}
                        {translating && (
                          <span className="text-xs text-muted-foreground flex items-center shrink-0">
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            翻译中...
                          </span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  {result.repo.language && (
                    <Badge
                      variant="secondary"
                      className="text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      <Code className="w-3 h-3 mr-1" />
                      {result.repo.language}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard
                    icon={<Star className="w-5 h-5 text-yellow-500" />}
                    label="Stars"
                    value={formatNumber(result.repo.stargazers_count)}
                  />
                  <StatCard
                    icon={<GitFork className="w-5 h-5 text-blue-500" />}
                    label="Forks"
                    value={formatNumber(result.repo.forks_count)}
                  />
                  <StatCard
                    icon={<Eye className="w-5 h-5 text-green-500" />}
                    label="Watchers"
                    value={formatNumber(result.repo.subscribers_count)}
                  />
                  <StatCard
                    icon={<CircleDot className="w-5 h-5 text-red-500" />}
                    label="Issues"
                    value={formatNumber(result.repo.open_issues_count)}
                  />
                </div>
                <Separator className="my-4" />
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    创建于 {formatDate(result.repo.created_at)}
                  </span>
                  <span className="flex items-center gap-1">
                    更新于 {formatDate(result.repo.updated_at)}
                  </span>
                  {result.repo.license && (
                    <span>许可证: {result.repo.license.name}</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 语言分布 - 饼图 */}
            {languageChartData.length > 0 && (
              <Card
                className="card-hover animate-slide-up"
                style={{ animationDelay: "0.1s" }}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                      <Code className="w-4 h-4 text-white" />
                    </div>
                    代码语言分布
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={languageChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percentage }) =>
                            `${name} ${percentage}%`
                          }
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                          animationBegin={0}
                          animationDuration={800}
                        >
                          {languageChartData.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={CHART_COLORS[index % CHART_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) =>
                            formatNumber(value) + " 字节"
                          }
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* 语言进度条 */}
                  <div className="space-y-3 mt-6">
                    {languageChartData.map((item, index) => (
                      <div key={item.name}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{item.name}</span>
                          <span className="text-muted-foreground">
                            {formatNumber(item.value)} 字节 ({item.percentage}
                            %)
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${item.percentage}%`,
                              backgroundColor:
                                CHART_COLORS[index % CHART_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 语言分布为空时的提示 */}
            {result && languageChartData.length === 0 && (
              <Card
                className="card-hover animate-slide-up"
                style={{ animationDelay: "0.1s" }}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                      <Code className="w-4 h-4 text-white" />
                    </div>
                    代码语言分布
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-center text-muted-foreground py-8">
                    暂无语言统计数据
                  </p>
                </CardContent>
              </Card>
            )}

            {/* 贡献者 */}
            <Card
              className="card-hover animate-slide-up"
              style={{ animationDelay: "0.2s" }}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Users className="w-4 h-4 text-white" />
                  </div>
                  贡献者排行
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.contributors.length > 0 ? (
                  <>
                    {/* 柱状图 */}
                    <div className="h-[250px] w-full mb-6">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={result.contributors.slice(0, 5)}
                          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="login" />
                          <YAxis />
                          <Tooltip
                            formatter={(value: number) => [
                              `${value} 次提交`,
                              "贡献",
                            ]}
                          />
                          <Bar
                            dataKey="contributions"
                            fill="#8b5cf6"
                            radius={[4, 4, 0, 0]}
                            animationBegin={0}
                            animationDuration={800}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    {/* 贡献者列表 */}
                    <div className="space-y-3">
                      {result.contributors.map((contributor, index) => (
                        <a
                          key={contributor.login}
                          href={contributor.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted transition-colors group"
                        >
                          <span className="text-sm font-bold text-muted-foreground w-6">
                            #{index + 1}
                          </span>
                          <img
                            src={contributor.avatar_url}
                            alt={`${contributor.login} 头像`}
                            className="w-10 h-10 rounded-full ring-2 ring-transparent group-hover:ring-primary/50 transition-all"
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect fill='%23e2e8f0' width='100' height='100'/><text x='50' y='55' text-anchor='middle' fill='%2394a3b8' font-size='40'>?</text></svg>";
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium group-hover:text-primary transition-colors truncate">
                              {contributor.login}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {contributor.contributions} 次提交
                            </div>
                          </div>
                          <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </a>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    暂无贡献者数据
                  </p>
                )}
              </CardContent>
            </Card>

            {/* 提交活动 */}
            <Card
              className="card-hover animate-slide-up"
              style={{ animationDelay: "0.3s" }}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-white" />
                  </div>
                  提交活动
                </CardTitle>
              </CardHeader>
              <CardContent>
                {commitChartData.length > 0 ? (
                  <>
                    {/* 柱状图 */}
                    <div className="h-[250px] w-full mb-6">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={commitChartData}
                          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="week" />
                          <YAxis />
                          <Tooltip
                            formatter={(value: number) => [
                              `${value} 次`,
                              "提交",
                            ]}
                          />
                          <Bar
                            dataKey="commits"
                            fill="#10b981"
                            radius={[4, 4, 0, 0]}
                            animationBegin={0}
                            animationDuration={800}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    {/* 提交热图 */}
                    {commitHeatmapData.length > 0 && (
                      <>
                        <div className="grid grid-cols-7 gap-1">
                          {commitHeatmapData.map((count, i) => {
                            // 根据提交数量计算颜色强度
                            let color: string;
                            if (count === 0) {
                              color = "hsl(var(--muted))";
                            } else if (count <= 3) {
                              color = "#9ca3af";
                            } else if (count <= 6) {
                              color = "#6b7280";
                            } else if (count <= 10) {
                              color = "#4b5563";
                            } else {
                              color = "#1f2937";
                            }
                            return (
                              <div
                                key={i}
                                className="aspect-square rounded-sm transition-transform hover:scale-110"
                                style={{ backgroundColor: color }}
                                title={`${count} 次提交`}
                              />
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                          <span>少</span>
                          {[
                            "hsl(var(--muted))",
                            "#9ca3af",
                            "#6b7280",
                            "#4b5563",
                            "#1f2937",
                          ].map((color, i) => (
                            <div
                              key={i}
                              className="w-3 h-3 rounded-sm"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                          <span>多</span>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    提交活动数据暂不可用（GitHub 后台计算中，请稍后重试）
                  </p>
                )}
              </CardContent>
            </Card>

            {/* README 质量检查 */}
            {readmeQuality && (
              <Card
                className="card-hover animate-slide-up"
                style={{ animationDelay: "0.4s" }}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-white" />
                    </div>
                    README 质量检查
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 mb-6">
                    {/* 环形进度条 */}
                    <div className="relative w-24 h-24">
                      <svg
                        className="w-24 h-24 transform -rotate-90"
                        viewBox="0 0 80 80"
                        aria-label={`README 质量评分: ${readmeQuality.score} 分`}
                      >
                        <circle
                          cx="40"
                          cy="40"
                          r="36"
                          fill="none"
                          stroke="hsl(var(--muted))"
                          strokeWidth="6"
                        />
                        <circle
                          cx="40"
                          cy="40"
                          r="36"
                          fill="none"
                          stroke={
                            readmeQuality.score >= 80
                              ? "#10b981"
                              : readmeQuality.score >= 50
                                ? "#f59e0b"
                                : "#ef4444"
                          }
                          strokeWidth="6"
                          strokeDasharray={`${(readmeQuality.score / 100) * 226.19} 226.19`}
                          strokeLinecap="round"
                          className="transition-all duration-1000"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold">
                        {readmeQuality.score}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-lg">
                        {readmeQuality.score >= 80
                          ? "✨ 优秀"
                          : readmeQuality.score >= 50
                            ? "👍 良好"
                            : "📝 需改进"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        基于 README 内容完整性评估（共 {readmeQuality.checks.length} 项指标）
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {readmeQuality.checks.map((check) => (
                      <div
                        key={check.name}
                        className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <span>{check.name}</span>
                        {check.pass ? (
                          <CheckCircle
                            className="w-4 h-4 text-green-500"
                            aria-label="通过"
                          />
                        ) : (
                          <XCircle
                            className="w-4 h-4 text-red-500"
                            aria-label="未通过"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 分享按钮 */}
            <div
              className="flex justify-center gap-4 animate-slide-up"
              style={{ animationDelay: "0.5s" }}
            >
              <Button
                onClick={handleShare}
                disabled={sharing}
                size="lg"
                className="btn-press"
              >
                {sharing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    下载分析报告
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* 默认功能特性展示 */}
        {!result && !loading && (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            <FeatureCard
              icon="📊"
              title="语言分布"
              description="可视化展示仓库代码语言占比"
              delay={0}
            />
            <FeatureCard
              icon="👥"
              title="贡献者排行"
              description="查看最活跃的项目贡献者"
              delay={0.1}
            />
            <FeatureCard
              icon="📅"
              title="提交热图"
              description="了解项目的开发活跃度"
              delay={0.2}
            />
            <FeatureCard
              icon="📝"
              title="README 检查"
              description="评估文档完整性和质量"
              delay={0.3}
            />
          </div>
        )}

        {/* 空状态：无结果、无加载、无错误、无特性展示时 */}
        {!result && !loading && !error && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              提示：按 <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Ctrl+K</kbd> 快速聚焦搜索框
            </p>
          </div>
        )}
      </main>

      {/* 设置对话框 */}
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {/* 页脚 */}
      <footer className="border-t glass py-6 mt-12 relative z-10">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>
            © 2024 GitHub Repo Analyzer. Made with ❤️ for the open source
            community.
          </p>
        </div>
      </footer>
    </div>
  );
}

// ========================
// 子组件
// ========================

/** 功能特性展示卡片 */
function FeatureCard({
  icon,
  title,
  description,
  delay = 0,
}: {
  icon: string;
  title: string;
  description: string;
  delay?: number;
}) {
  return (
    <Card
      className="card-hover animate-slide-up hover:border-primary/50"
      style={{ animationDelay: `${delay}s` }}
    >
      <CardHeader>
        <div className="text-3xl mb-2">{icon}</div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription>{description}</CardDescription>
      </CardContent>
    </Card>
  );
}

/** 统计数据卡片 */
function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col items-center p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
      {icon}
      <span className="text-2xl font-bold mt-2">{value}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
