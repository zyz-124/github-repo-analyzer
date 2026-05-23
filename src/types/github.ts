export interface GitHubRepo {
  id: number
  name: string
  full_name: string
  description: string | null
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  language: string | null
  owner: {
    login: string
    avatar_url: string
    html_url: string
  }
  created_at: string
  updated_at: string
  pushed_at: string
  html_url: string
  default_branch: string
  subscribers_count: number
  license: {
    name: string
    spdx_id: string
  } | null
}

export interface GitHubContributor {
  login: string
  avatar_url: string
  contributions: number
  html_url: string
}

export type LanguageStats = Record<string, number>

export interface CommitActivity {
  days: number[]
  total: number
  week: number
}

export interface RepoAnalysisResult {
  repo: GitHubRepo
  languages: LanguageStats
  contributors: GitHubContributor[]
  commitActivity: CommitActivity[]
  readme: string | null
}

export interface ParsedRepoUrl {
  owner: string
  repo: string
}
