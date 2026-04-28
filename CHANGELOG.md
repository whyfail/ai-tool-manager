# Changelog

## v1.4.0 (2026-04-28)

### 新功能

- **工具卸载功能**：新增工具卸载功能，支持通过 brew/npm/winget/scoop 卸载已安装的工具
  - 工具卡片右上角新增卸载按钮（仅对已安装且检测到安装方式的工具显示）
  - 卸载前弹出确认对话框，卸载过程中显示 loading 遮罩
  - 卸载后仅更新当前工具状态，不影响其他工具

### 修复

- **nvmd shim 检测**：修复通过 nvmd (nvm-desktop) 安装的工具卸载后仍显示为已安装的问题
  - `which_binary()` 新增 `is_nvmd_shim()` 检测，识别 nvmd 的符号链接和硬拷贝 shim
  - `is_agent_installed()` / `is_tool_installed()` 移除数据目录/配置文件误判检测，仅依赖 binary 和 GUI 应用检测

### 改进

- **状态更新优化**：工具安装、更新、卸载操作改为局部状态更新，仅刷新当前操作的工具卡片，不再触发全量刷新，避免其他工具卡片闪烁

## v1.3.2 (2026-04-27)

### 新功能

- **首次加载自动检测安装方式**：工具管理页首次加载时自动检测已安装工具的安装方式（Homebrew/npm/curl 等），无需手动点击扫描
- **首次加载自动后台扫描版本号**：工具列表渲染后自动后台扫描已安装工具的版本号和最新版本号，完成后自动更新展示，无需手动操作

### 修复

- **Windows 平台工具检测**：修复 Windows 下 Trae CN、Trae、TRAE SOLO CN、Qoder 等 GUI 应用首次安装时无法被检测到的问题
  - `is_agent_installed()` 增加 Windows GUI 应用 exe 搜索检测
  - 增加应用数据目录存在性检测，首次安装未配置 MCP 时也能识别
  - 补全 `is_app_installed_windows()` 的搜索子目录，覆盖更多安装路径

### 改进

- **工具管理首屏体验**：安装方式和版本号不再需要手动扫描，列表加载后自动获取并展示
- **设置页精简**：支持的应用列表只显示应用名称，不再显示配置文件路径
- **CodeBuddy 重命名**：显示名称改为 CodeBuddy CN CLI

## v1.3.1 (2026-04-24)

### 新功能

- **终端偏好设置**：新增默认启动终端配置，支持在设置页选择 macOS 与 Windows 的首选终端

### 改进

- **macOS 启动体验**：优化 Terminal、iTerm、Warp、Ghostty 的工具启动流程，改进工作目录、命令解析与脚本执行稳定性
- **Windows 兼容性**：完善配置路径展示、工具检测、Agent 启动与终端回退逻辑，提升 Windows 下的可用性
- **工具管理性能**：首次进入工具管理页时优先返回基础安装信息，避免版本与网络检测阻塞首屏
- **后台检测更新**：首次启动时工具检测改为后台完成后推送更新，减少首页长时间停留在“正在扫描中”的情况

## v1.3.0 (2026-04-23)

### 新功能

- **数据迁移**：从旧版 `ai-tool-manager` 升级时自动迁移数据目录 `~/.ai-tool-manager/` → `~/.ai-toolkit/`，包括数据库、检测状态和 Skills 仓库，迁移后旧目录备份为 `.ai-tool-manager.bak/`

### 改进

- **项目重命名完成**：修复 Cargo.toml `[lib] name`、`main.rs` 中残留的 `ai_tool_manager` 引用，统一更新为 `ai_toolkit`
- **启动功能简化**：移除终端选择功能，统一使用系统默认终端（macOS: Terminal.app, Windows: Windows Terminal），避免辅助功能权限问题
- **删除确认优化**：MCP 服务器和 Skills 删除弹窗增加 loading 状态，防止重复点击；MCP 删除确认弹窗显示服务器名称而非 ID
- **项目描述更新**：package.json 和 Cargo.toml 的 description 更新为 "Universal MCP Server & Skills Manager for AI CLI Tools"
- **Release 流程更新**：release.yml 中的发布名称和下载文件名统一为 AI Toolkit

---

## v1.2.9 (2026-04-21)

### 改进

- **Git 技能添加流程优化**：重新设计 Git 仓库添加技能的交互流程
  - 初始仅显示 URL 输入框和"预览仓库"按钮
  - 预览后单个技能：锁定 URL，显示技能名称输入框和同步工具列表
  - 预览后多个技能：弹出选择窗口，确认后每个技能显示独立的名称输入框
  - 支持自定义技能名称作为 skills 文件夹名称
- **本地文件夹验证**：添加本地技能时自动验证文件夹是否为合规的技能目录（需包含 SKILL.md 或 skill.json），不合规则禁用添加按钮并提示原因

---

## v1.2.4 (2026-04-17)

### 修复

- **Skills 工具检测**：修复 Trae、Trae CN、TRAE SOLO CN、Qoder、Qoder CLI 在 Skills 模块中无法被检测到的的问题
- **MCP 模块工具检测**：修复 GUI 应用（Trae、Trae CN、TRAE SOLO CN、Qoder）通过 /Applications 检测不准确的问题
- **Skills 目录路径**：修正 Qoder CLI 的 Skills 路径从 `.qodercli/skills` 到 `.qoder/skills`，TRAE SOLO CN 从 `.trae-solo-cn/skills` 到 `.trae-cn/skills`
- **Skills 模块性能**：优化 `get_managed_skills` 命令执行速度，预检测已安装工具避免重复扫描
- **MCP 模块性能**：优化 `get_tool_infos` 首次加载速度，使用并行获取版本信息
- **更新重启**：修复检查更新后下载完成但应用不自动重启的问题

### 改进

- **自动检测**：工具列表为空时自动触发首次检测，无需手动刷新
- **Skills 安装流程**：优化 Git 仓库单 Skills 自动安装流程，多 Skills 选择后触发安装

---

## v1.2.0 (2026-04-16)

### 新增功能

#### Agent 快速启动
- **一键启动**：支持直接从应用内启动 AI 工具
- **多终端支持**：Terminal, iTerm2, Warp, Hyper, Kitty, Alacritty, Fig, Kaku
- **Node.js 环境自动检测**：支持 nvm, fnm, volta, nvmd 等版本管理工具
- **Windows 终端支持**：Windows Terminal, PowerShell, CMD, Git Bash

#### 工具管理
- **安装向导**：显示各工具的多种安装方式 (Homebrew, npm, curl 脚本)
- **版本检测**：自动检测已安装工具的版本
- **一键更新**：快速更新已安装的工具

#### Qoder CLI 支持
- 新增 Qoder CLI 工具支持
- 配置文件路径：`~/.qodercli/settings.json`

### 改进
- **移除 OpenClaw**：移除已停用的 OpenClaw 支持
- **Qoder 路径更新**：Qoder 配置路径更新为 `~/Library/Application Support/Qoder/SharedClientCache/mcp.json`
- **工具数量**：从 10 种增加到 11 种

### 修复
- 若干 bug 修复和稳定性提升

---

## v1.1.0 (2026-04-14)

### 新增功能

#### Skills 管理模块
- **Skills 列表管理**：新增独立的 Skills 管理面板，支持查看所有已安装的 Skills
- **批量同步**：支持选择多个 Skills 同步到多个目标工具，提高操作效率
- **Git 仓库安装**：支持从 GitHub/GitLab 仓库安装 Skills，自动解析仓库结构
- **本地导入**：支持从本地目录导入 Skills 到集中仓库
- **在线搜索**：支持从 skills.sh 在线搜索热门 Skills
- **精选推荐**：展示精选 Skills 列表，包含安装量和星标信息
- **更新检测**：自动检测有更新的 Skills（支持 Git 仓库更新）
- **一键同步**：单个技能可快速同步到选定的 AI 工具
- **选择性安装**：支持多 Skills 仓库的选择性子目录安装

#### 工具检测与同步
- **多工具支持**：支持 Qwen Code, Claude Code, Codex, Gemini CLI, OpenCode, Trae, Trae CN, TRAE SOLO CN, Qoder, CodeBuddy
- **自动发现**：启动时自动检测系统中已安装的 AI 工具
- **实时同步**：MCP 服务器配置切换实时同步到对应工具配置文件
- **冲突检测**：检测同名 Skills 在不同工具中的安装情况

### 改进
- **项目重命名**：项目更名为 AI Tool Manager
- **数据库路径**：`~/.mcp-manager/` → `~/.ai-toolkit/`
- **弹窗优化**：Skills 相关弹窗宽度优化，提升用户体验

### 修复
- 若干 bug 修复和稳定性提升

---

## v1.0.0 (2026-04-09)

### 首发版本
- MCP 服务器统一管理
- 支持 8+ 主流 AI 编程工具
- JSON 粘贴模式与智能解析
- 内置连接测试功能
- 配置文件原子写入保护
