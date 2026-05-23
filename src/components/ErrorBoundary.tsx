import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** 自定义降级 UI，不传则使用默认样式 */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React 错误边界组件
 *
 * 捕获子组件树中的 JavaScript 错误，防止整个应用白屏崩溃。
 * 提供友好的错误展示和重试按钮。
 *
 * 注意：错误边界无法捕获以下错误：
 * - 事件处理器中的错误（需要自行 try-catch）
 * - 异步代码中的错误（setTimeout、Promise 等）
 * - 服务端渲染中的错误
 * - 错误边界自身抛出的错误
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 生产环境可将错误上报到监控服务
    console.error("[ErrorBoundary] 捕获到未处理的错误:", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  /** 重置错误状态，尝试重新渲染 */
  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // 如果提供了自定义降级 UI，使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 默认错误展示
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full space-y-6 text-center">
            {/* 错误图标 */}
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-destructive" />
              </div>
            </div>

            {/* 错误信息 */}
            <div>
              <h1 className="text-2xl font-bold mb-2">应用发生错误</h1>
              <p className="text-muted-foreground mb-6">
                抱歉，页面遇到了意外问题。这通常是由于临时故障导致的。
              </p>
            </div>

            {/* 错误详情（开发环境可见） */}
            {import.meta.env.DEV && this.state.error && (
              <Alert variant="destructive" className="text-left">
                <AlertTitle>错误详情</AlertTitle>
                <AlertDescription className="mt-1 text-xs font-mono whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                  {this.state.error.message}
                  {"\n\n"}
                  {this.state.error.stack?.split("\n").slice(0, 5).join("\n")}
                </AlertDescription>
              </Alert>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-3 justify-center">
              <Button onClick={this.handleReset} size="lg" className="btn-press">
                <RefreshCw className="w-4 h-4 mr-2" />
                重试
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => window.location.reload()}
              >
                刷新页面
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              如果问题持续出现，请尝试清除浏览器缓存或重启应用。
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
