/**
 * 调试日志工具
 * 用于追踪 AI 消息流和思考链渲染问题
 */

// 启用/禁用调试日志
const DEBUG_ENABLED = true

// 日志前缀，方便在控制台过滤
export const LOG_PREFIXES = {
  STREAM: '[STREAM-DEBUG]',
  PRELOAD: '[PRELOAD-DEBUG]',
  CHAT_STORE: '[CHAT-STORE-DEBUG]',
  APP: '[APP-DEBUG]',
  MARKDOWN: '[MARKDOWN-DEBUG]',
} as const

/**
 * 格式化显示长内容
 */
export function formatContent(content: string, maxLength = 500): string {
  if (content.length <= maxLength) return content
  return content.slice(0, maxLength) + `... (${content.length} total chars)`
}

/**
 * 记录消息流各阶段的状态
 */
export class StreamDebugger {
  private stageStartTime: Map<string, number> = new Map()

  /**
   * 开始计时某个阶段
   */
  startStage(stage: string) {
    if (!DEBUG_ENABLED) return
    this.stageStartTime.set(stage, Date.now())
    console.log(`[STREAM-TIMING] Stage "${stage}" started`)
  }

  /**
   * 结束计时某个阶段
   */
  endStage(stage: string) {
    if (!DEBUG_ENABLED) return
    const startTime = this.stageStartTime.get(stage)
    if (startTime) {
      const duration = Date.now() - startTime
      console.log(`[STREAM-TIMING] Stage "${stage}" completed in ${duration}ms`)
      this.stageStartTime.delete(stage)
    }
  }

  /**
   * 记录思考标签检测
   */
  logThinkingDetection(content: string, tagType: 'chinese' | 'english' | 'none', matches: number) {
    if (!DEBUG_ENABLED) return
    console.log(`[THINKING-DEBUG] Tag type: ${tagType}, Matches: ${matches}`)
    console.log(`[THINKING-DEBUG] Content preview: ${formatContent(content, 200)}`)
  }

  /**
   * 记录内容转换
   */
  logContentTransform(stage: string, before: string, after: string) {
    if (!DEBUG_ENABLED) return
    console.log(`[CONTENT-TRANSFORM] Stage: ${stage}`)
    console.log(`[CONTENT-TRANSFORM] Before (${before.length} chars): ${formatContent(before, 200)}`)
    console.log(`[CONTENT-TRANSFORM] After (${after.length} chars): ${formatContent(after, 200)}`)
  }
}

export const streamDebugger = new StreamDebugger()

/**
 * 控制台调试帮助信息
 */
export function printDebugHelp() {
  console.log('%c=== Tina 调试日志帮助 ===', 'font-weight: bold; color: #0066cc')
  console.log('%c过滤特定类型的日志:', 'font-weight: bold')
  console.log('  - 主进程流式数据: 过滤 "[STREAM-DEBUG]"')
  console.log('  - 预加载层: 过滤 "[PRELOAD-DEBUG]"')
  console.log('  - 状态管理: 过滤 "[CHAT-STORE-DEBUG]"')
  console.log('  - 应用层: 过滤 "[APP-DEBUG]"')
  console.log('  - Markdown渲染: 过滤 "[MARKDOWN-DEBUG]"')
  console.log('  - 思考链检测: 过滤 "[THINKING-DEBUG]"')
  console.log('  - 时间统计: 过滤 "[STREAM-TIMING]"')
  console.log('%c', 'font-weight: bold')
  console.log('%c快速过滤所有调试日志: 在控制台搜索 "DEBUG"', 'color: #666')
  console.log('%c快速过滤时间信息: 在控制台搜索 "TIMING"', 'color: #666')
}
