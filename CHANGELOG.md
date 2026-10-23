# 更新记录

按版本从新到旧。每段标题就是 tag 名（`## [2026.10.12] - 2026-10-12`）——推 tag 时由
`.github/workflows/release.yml` 把这一段抽出来当 Release 报告。
所以发版的规矩只有一条：**先在文件顶上补一段，再打标签**。抽不到那一段（或那一段是空的），
Release 就退回 GitHub 自动生成的提交清单。

版本号用日期式（`2026.10.12`），与 `package.json` 的 `version`、tag 名同号。

## [2026.10.23] - 2026-10-23

### 补上 Agent 作用域注入的兜底：zero-injection

- 原来「零工具 + 零系统提示词」靠两道防线：`persona.complete` 抑制 sections、
  `tools.restrict({ allow: [] })` 摘掉继承来的工具。但 `restrict` 从不约束 own layer，
  `includeRuntimeContext: false` 也只过滤可选 context——像 Agent Teams 这类在
  `agent.ctx` 上注册工具、再挂一个 `required` 的 `systemPrompt.context` 的插件，会同时
  绕过两道防线：9 个团队工具与 `team:identity` 都会进纯对话会话。
- 新增 `plugins/zero-injection.mjs`：在 `system-prompt/assemble` 瀑布末端把 `tools`
  与 `contexts` 清空，作为「零注入」的最后一道兜底；sections 无需再动，
  `persona.complete` 已在组装引擎里把它们恢复成 persona 那一节。
- `cordis.patch.yml` 增加 `zero-injection` 行，`package.json` 补 `./zero-injection` 导出；
  `self-test.mjs` 增加三条断言（行数、包名引用、清空语义），共 12 项。

## [2026.10.17] - 2026-10-17

### 适配 dsh 0.2.1-rc.1

- 基准版本收敛为 **0.2.1-rc.1**。shipped `minimal` 相对 0.2.1-alpha.2 新增了 `tool-fs`
  （只保留 `readImage`）与 `compaction` group；本包继续**刻意不挂**这两行——它们都属于
  「往里加东西」，「零工具 + 零系统提示词」的语义不变。
- `cordis.patch.yml` 与 README/AGENTS 里的兼容口径从「两版逐字相同」改为 rc.1 单一基准。

## [2026.10.12] - 2026-10-12

### 首次发布：把原生极简模式爆改成纯对话组合

- 本包是一个 dsh 插件（bundle）：`package.json` 的 `dsh.bundle.patch` 指向包内
  `cordis.patch.yml`，后者按 Loader 行 id **覆盖** `@deepseek-ai/dsh-web-app` 那份
  `preset-minimal`。安装、更新、卸载全部交给 dsh 自己的插件管理（插件页，或
  `dsh plugin --profile <p> add github:Alm-Allen/dsh-chat-preset`）。
- 覆盖后的预设只有两行：`persona` 与 `no-global-tools`。shipped `minimal` 的
  `persistent-shell`（`pty` + `terminal-bash` / `persistent-bash` / `terminal-pwsh` /
  `persistent-pwsh`）**不再重述**——override 的 `config` 是整体替换，不重述即删除，
  这正是「零工具」的一半。
- 显示名由本包自己声明（`config.name: "Chat 模式"` + 新描述）。dsh 的
  `dsh-client-ui-agent-preset` 只在预设**没有**发布 `name` 时才回落到内置 locale 文案
  （「极简模式」/「Agent 仅使用终端工具完成任务」），写了就用自己那一份——不改名的话，
  列表里的名字与描述会与零工具的实际行为自相矛盾。`config.id` 仍是 `minimal`，
  `order` 仍是 3，所以已选过本预设的会话不受影响。
- 零系统提示词：`prefix: ''` + `complete: true` + `includeRuntimeContext: false`
  三个开关合起来，把 harness 身份段、部署 persona、Web 表面段落、plan-mode 段落、各工具
  guidance 段，以及瀑布上后续监听器追加的文本全部抑制，并关掉该 scope 下全部动态上下文
  快照。空模板在渲染时被丢弃，`renderPrompt()` 返回空串。
- 零工具的另一半：预设层不挂工具行只解决「本预设不注册工具」，宿主全局层注册的工具仍会被
  每个 agent scope 继承。随包的 `plugins/no-global-tools.mjs` 在 preset 自己的 standing
  scope 上声明 `tools.restrict({ allow: [] })`——`restrict` 过滤的正是「本 scope 继承到的
  东西」，空 `allow` 即「继承面全部不可见」，与工具名和注册时刻都无关。
  用 `restrict` 而不是快照式 `deny` 名单，是为了避开竞态：preset 的行在 `tools` 服务一出现
  就激活，而提供方可能 `await` 之后才异步注册工具，快照名单会在那之前生成并因此为空，一条
  限制都不设。
- 刻意不挂的行：`compaction`（不折叠、不摘要、不改写历史——代价是长对话最终会撞上上下文
  窗口，这正是「纯对话」的直接语义）、`agent-instructions`（会把 AGENTS.md 读成系统提示词）、
  `skill-filesystem` / `tool-skill`（注入技能目录并加一个工具），以及全部 `tool-*`、
  `command-*`、`plan-mode`、`present`、委派与 workflow 行。
- 两版兼容：`minimal` 的 shipped 在 `0.2.0-rc.2` 与 `0.2.1-alpha.2` 里**逐字相同**
  （已核对：两版都是 61 行，同样的 persona 与 persistent-shell），所以本文件没有「版本特有
  行」要取舍，比雅言/仓颉那两份省事得多。本文件引用的两行两版都可用。
- 离线自测 `plugins/self-test.mjs` 把这份契约固化成 10 项断言：覆盖形态、`config.id`、
  自定义显示名、顶层行恰好两项、没有任何额外行、persona 的三个开关、零工具那半按包名
  引用自己、包入口存在。
