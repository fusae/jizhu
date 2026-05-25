# 记住 (TieJi)

> 粘贴即任务，到点就提醒。

复制微信聊天 → `Cmd+Shift+T` → AI 自动提取要点和截止时间 → 确认保存。到期前 1 小时、15 分钟、到期时系统通知提醒。

## 安装

### macOS

下载 [最新 DMG](https://github.com/fusae/tieji/releases) 安装。

### 从源码运行

```bash
git clone https://github.com/fusae/tieji.git
cd tieji
npm install
DEEPSEEK_API_KEY=sk-xxx npm start
```

## 功能

- **粘贴即解析** — 复制聊天内容，AI 自动提取「要做什么」和「截止时间」
- **自然语言时间** — 支持「明天下午 6 点」「周五」「下周三」
- **三级提醒** — 截止前 1 小时、15 分钟、到点弹系统通知
- **菜单栏常驻** — macOS 菜单栏显示待办数量
- **全局快捷键** — `Cmd+Shift+T` (Mac) / `Ctrl+Shift+T` (Win)
- **跨平台** — macOS + Windows

## AI 配置

设置环境变量 `DEEPSEEK_API_KEY` 启用 AI 自动解析。未配置时不影响手动填写。

## 技术

- Electron + TypeScript
- better-sqlite3
- chrono-node (时间解析)
- DeepSeek API (AI 解析)

## 开发

```bash
npm run build   # 编译 TypeScript
npm start       # 启动应用
npm run pack:mac  # 打包 macOS
npm run pack:win  # 打包 Windows
```
