import type {
  GitHubRepo,
  GitHubContributor,
  LanguageStats,
  CommitActivity,
  ParsedRepoUrl,
} from "../types/github";

const GITHUB_API_BASE = "https://api.github.com";

// ========================
// 工具函数
// ========================

/**
 * 安全读取 localStorage，防止 JSON 解析异常
 */
function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    console.warn(`[GitHub API] 无法读取 localStorage key: ${key}`);
    return null;
  }
}

/**
 * 构建 GitHub API 请求头
 * 如果用户配置了 Personal Access Token，自动附加认证信息提升 API 限额
 */
function getHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  const token = safeGetItem("github_token");
  if (token) {
    headers["Authorization"] = `token ${token}`;
  }
  return headers;
}

// ========================
// URL 解析
// ========================

/**
 * 解析 GitHub 仓库 URL，支持多种输入格式：
 *   - https://github.com/owner/repo
 *   - https://github.com/owner/repo.git
 *   - https://github.com/owner/repo/tree/main
 *   - github.com/owner/repo
 *   - owner/repo
 *
 * 返回 { owner, repo } 或 null 表示无法解析
 */
export function parseRepoUrl(url: string): ParsedRepoUrl | null {
  const trimmed = url.trim();

  // 严格按优先级匹配：完整 URL -> 带路径 URL -> 短域名 -> 纯 owner/repo
  const patterns = [
    // 1. 标准仓库首页（可带 .git 后缀或尾部斜杠）
    /^https:\/\/github\.com\/([^\/]+)\/([^\/\s#?]+?)(?:\.git)?\/?$/,
    // 2. 仓库子页面（如 /tree/main, /blob/...）
    /^https:\/\/github\.com\/([^\/]+)\/([^\/\s#?]+?)(?:\.git)?\/.*$/,
    // 3. 省略协议的短域名
    /^github\.com\/([^\/]+)\/([^\/\s#?]+?)(?:\.git)?\/?$/,
    // 4. 纯 owner/repo 格式
    /^([^\/\s]+)\/([^\/\s#?]+?)(?:\.git)?$/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) {
      const owner = match[1];
      const repo = match[2].replace(/\.git$/, "");
      // 过滤明显无效的 owner/repo（如单字符、过长名称）
      if (owner.length >= 1 && owner.length <= 39 && repo.length >= 1 && repo.length <= 100) {
        return { owner, repo };
      }
    }
  }
  return null;
}

// ========================
// Base64 UTF-8 解码
// ========================

/**
 * GitHub API 返回的 README 内容为 Base64 编码的 UTF-8 文本
 * atob 只能处理 Latin1 字符，遇到中文等多字节字符会乱码
 * 使用 TextDecoder 进行正确的 UTF-8 解码
 */
function decodeBase64UTF8(base64: string): string {
  try {
    // 去除可能的换行符，GitHub 的 Base64 内容可能带换行
    const cleaned = base64.replace(/\s/g, "");
    const binaryStr = atob(cleaned);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    // 降级处理：如果 TextDecoder 不可用，尝试直接 atob
    console.warn(
      "[GitHub API] Base64 UTF-8 解码失败，回退到 atob"
    );
    return atob(base64);
  }
}

// ========================
// 通用 API 请求封装
// ========================

/**
 * GitHub REST API 通用请求封装
 * 自动处理速率限制、404、认证等常见错误
 */
async function fetchGitHub<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${GITHUB_API_BASE}${path}`, {
      headers: getHeaders(),
    });
  } catch (err) {
    throw new Error(
      `网络请求失败，请检查网络连接${
        err instanceof Error ? `：${err.message}` : ""
      }`
    );
  }

  // API 速率限制处理
  if (response.status === 403) {
    const rateLimitRemaining = response.headers.get("x-ratelimit-remaining");
    if (rateLimitRemaining === "0") {
      const resetTime = response.headers.get("x-ratelimit-reset");
      const resetDate = resetTime
        ? new Date(parseInt(resetTime) * 1000).toLocaleString("zh-CN")
        : "稍后";
      throw new Error(
        `GitHub API 速率限制已用完（未认证用户每小时仅 60 次请求）。\n` +
          `重置时间：${resetDate}\n` +
          `建议：在设置中添加 GitHub Personal Access Token 可将限额提升至 5000 次/小时。`
      );
    }
    throw new Error(
      `访问被拒绝（HTTP 403）。请检查仓库是否存在或是否有访问权限。`
    );
  }

  // 仓库不存在
  if (response.status === 404) {
    throw new Error(
      "仓库不存在或无法访问，请检查仓库链接是否正确（确保仓库为公开仓库）。"
    );
  }

  // 其他 HTTP 错误
  if (!response.ok) {
    throw new Error(
      `GitHub API 请求失败：HTTP ${response.status} ${response.statusText}`
    );
  }

  // 安全解析 JSON
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error("API 返回数据格式异常，请稍后重试。");
  }
}

// ========================
// 具体 API 方法
// ========================

/**
 * 获取仓库基本信息（stars、forks、描述等）
 */
export async function fetchRepo(
  owner: string,
  repo: string
): Promise<GitHubRepo> {
  return fetchGitHub<GitHubRepo>(`/repos/${owner}/${repo}`);
}

/**
 * 获取仓库代码语言分布统计
 */
export async function fetchLanguages(
  owner: string,
  repo: string
): Promise<LanguageStats> {
  return fetchGitHub<LanguageStats>(`/repos/${owner}/${repo}/languages`);
}

/**
 * 获取贡献者排行（Top 10）
 */
export async function fetchContributors(
  owner: string,
  repo: string
): Promise<GitHubContributor[]> {
  return fetchGitHub<GitHubContributor[]>(
    `/repos/${owner}/${repo}/contributors?per_page=10`
  );
}

/**
 * 获取提交活动统计（最近 52 周每周提交数据）
 * GitHub 的 commit_activity 端点可能在首次请求时返回 202
 * （数据还在计算中），此时返回空数组让用户稍后重试
 */
export async function fetchCommitActivity(
  owner: string,
  repo: string
): Promise<CommitActivity[]> {
  const data = await fetchGitHub<
    CommitActivity[] | { message?: string }
  >(`/repos/${owner}/${repo}/stats/commit_activity`);

  // GitHub API 在数据未就绪时可能返回对象而非数组
  if (!Array.isArray(data)) {
    console.warn("[GitHub API] 提交活动数据暂未就绪:", data);
    return [];
  }
  return data;
}

/**
 * 获取 README 文件内容
 * 返回解码后的 Markdown 文本，或 null 表示仓库没有 README
 */
export async function fetchReadme(
  owner: string,
  repo: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/readme`,
      { headers: getHeaders() }
    );

    if (!response.ok) {
      // 没有 README 文件不是错误，静默返回 null
      return null;
    }

    const data = await response.json();

    // GitHub API 返回的 content 是 Base64 编码的 UTF-8 文本
    if (data.content && typeof data.content === "string") {
      return decodeBase64UTF8(data.content);
    }

    return null;
  } catch {
    // README 获取失败不阻塞主流程
    console.warn(`[GitHub API] 获取 ${owner}/${repo} 的 README 失败`);
    return null;
  }
}

// ========================
// 类型导出
// ========================

export interface AnalysisError {
  message: string;
  type: "parse" | "network" | "api" | "rate_limit";
}
