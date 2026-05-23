import { Card, CardContent, CardHeader } from './ui/card'

export function LoadingSkeleton() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-pulse">
      {/* 仓库信息骨架 */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-6 w-48 bg-muted rounded" />
              <div className="h-4 w-72 bg-muted rounded" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 语言分布骨架 */}
      <Card>
        <CardHeader>
          <div className="h-6 w-32 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-[300px] bg-muted rounded-lg mb-6" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-muted rounded w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 贡献者骨架 */}
      <Card>
        <CardHeader>
          <div className="h-6 w-32 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-[250px] bg-muted rounded-lg mb-6" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-3">
                <div className="w-6 h-4 bg-muted rounded" />
                <div className="w-10 h-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-3 w-16 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 提交活动骨架 */}
      <Card>
        <CardHeader>
          <div className="h-6 w-32 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-[250px] bg-muted rounded-lg mb-6" />
          <div className="grid grid-cols-7 gap-1">
            {[...Array(84)].map((_, i) => (
              <div key={i} className="aspect-square bg-muted rounded-sm" />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* README 质量骨架 */}
      <Card>
        <CardHeader>
          <div className="h-6 w-40 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 bg-muted rounded-full" />
            <div className="space-y-2">
              <div className="h-5 w-16 bg-muted rounded" />
              <div className="h-3 w-40 bg-muted rounded" />
            </div>
          </div>
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-4 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
