# Tina

Tina 是一个跨平台的 AI 聊天桌面应用，基于 Electron、React 19 和 TypeScript 构建。

## 特性

- 多供应商支持：OpenAI、Anthropic、OpenRouter、Ollama、LM Studio、硅基流动、DeepSeek、月之暗面、智谱等
- 流式对话与推理内容展示
- 图片附件支持
- Markdown 渲染（代码高亮、LaTeX 数学公式、Mermaid 图表）
- 对话管理与导出
- 深色/浅色主题切换
- 本地 SQLite 数据持久化

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 类型检查与构建
npm run build

# 运行测试
npm test

# 运行测试（监听模式）
npm run test:watch

# 打包应用
npm run dist

# 代码检查
npm run lint
```

## 技术栈

- **Electron** - 跨平台桌面框架
- **React 19** - UI 框架
- **TypeScript** - 类型安全
- **Zustand** - 状态管理
- **SQLite** - 本地数据存储（通过 `node:sqlite`）
- **Vite** - 构建工具
- **Vitest** - 测试框架

## 项目结构

```
src/
├── main/           # Electron 主进程
├── preload/        # 预加载脚本
├── renderer/       # 渲染器（React UI）
│   ├── components/ # UI 组件
│   ├── lib/        # 工具函数
│   └── store/      # 状态管理
├── shared/         # 主进程与渲染器共享类型
└── App.tsx         # 根组件
```

## 许可证

MIT
