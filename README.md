# dsh-chat-preset

把 **DeepSeek Harness（dsh）** 的原生 **极简模式（minimal）** 爆改成 **Chat 模式（chat）**：
最纯净的纯对话组合——**零工具、零系统提示词注入**。模型每一次请求只看到对话历史与新的用户
消息本身，没有系统提示词、没有工具说明、没有任何动态上下文。

本包**不新增预设条目**，而是按 Loader 行 id **覆盖**随 dsh 出货的 `preset-minimal`：预设列表里
原来那一格换成了 Chat 模式，`config.id` 仍是 `minimal`（会话保存的是它），位置（`order: 3`）
也照旧。停用或卸载本包即回到原版「极简模式」。

显示名是覆盖声明自己声明的：dsh 只在预设**没有**发布 `name` 时才回落到内置文案
（「极简模式」/「Agent 仅使用终端工具完成任务」），写了 `config.name` 就用自己那一份。不改名
的话，列表里的名字与描述会与零工具的实际行为自相矛盾。

本仓库是一个 **dsh 插件（bundle）**，不是安装脚本：`package.json` 里的 `dsh.bundle.patch`
指向包内的 `cordis.patch.yml`，后者覆盖 `preset-minimal` 那一行。安装、更新、卸载都交给
dsh 自己的插件管理。

## 纯净到什么程度

| 注入来源 | 原生极简模式 | Chat 模式 |
|---|---|---|
| harness 身份段 | 有 | **无** |
| 部署 persona | 一句话 | **空** |
| 工具 guidance 段 | 终端工具的用法说明 | **无**（一个工具都没有） |
| 技能目录 / AGENTS.md | 不挂 | **不挂** |
| 运行时上下文快照（沙箱策略、审批策略、委派说明） | 关 | **关** |
| 可用工具 | 持久终端 | **零** |

两条机制合起来做到这件事：

**一、零系统提示词。** `persona` 行用 `prefix: ''` + `complete: true` +
`includeRuntimeContext: false`。空前缀让那条空模板成为该 agent 唯一的系统提示词段落，
`complete` 在 `system-prompt/assemble` 瀑布之后把 sections 复原为这一节本身——harness 身份段、
部署 persona、Web 表面段落、plan-mode 段落、各工具 guidance 段，以及瀑布上后续监听器追加的
文本，全部被抑制。`includeRuntimeContext: false` 再关掉该 scope 下全部动态上下文快照。
空模板在渲染时被丢弃，最终 `renderPrompt()` 返回空串。

**二、零工具。** 预设层一行 `tool-*` 都不挂，只解决了「本预设不注册工具」；宿主全局层注册的
工具仍会默认对每个 agent scope 可见。随包的 `plugins/no-global-tools.mjs` 在 preset 自己的
standing scope 上声明 `tools.restrict({ allow: [] })`——`restrict` 过滤的正是「本 scope
**继承到**的东西」（全局层加祖先 scope 链上的每一层），空 `allow` 就是「继承面全部不可见」，
与工具名和注册时刻都无关。

## 安装

**插件页**：打开 dsh 的 **插件** 页 → **添加插件** → 输入

```
github:Alm-Allen/dsh-chat-preset
```

**命令行**（`--profile` 换成你的 profile 名，网页端通常是 `web`）：

```sh
dsh plugin --profile web add github:Alm-Allen/dsh-chat-preset

# 锁死到某个 commit —— 后续推送就改不了你装到的东西
dsh plugin --profile web add github:Alm-Allen/dsh-chat-preset#<commit-sha>
```

装完重启 dsh、刷新页面，到 **设置 → Agent 预设** 里原「极简模式」那一格现在写着
「**Chat 模式**」，选它即可。列表里**不会多出条目**。

- **桌面端**：桌面应用的 profile 是 `desktop`，CLI 对它有额外限制（要先完全退出应用再执行）。
  桌面端直接用**插件**页添加最省事。
- **本地改着玩**：`dsh plugin --profile web add link:<本仓库绝对路径>` 装的是符号链接，
  改完重启即生效。
- **不用它了**：`dsh plugin --profile web remove @alm-allen/dsh-chat-preset`，
  或直接在插件页停用/卸载。

升级到最新：

```sh
dsh plugin --profile web update @alm-allen/dsh-chat-preset
```

## 包结构

```
dsh-chat-preset/
├── package.json                插件清单：name、exports、dsh.bundle.patch
├── cordis.patch.yml            本包贡献的组合层：覆盖原生 preset-minimal
├── locale/                     插件页显示用的元信息（en / zh）
└── plugins/
    ├── no-global-tools.mjs     摘掉继承来的全部工具（同时是包入口）
    └── self-test.mjs           离线自测：把「零工具 + 零系统提示词」固化成断言
```

## 装进 profile 之后发生了什么

1. dsh 把包装到 `<profile>/node_modules/`，并把包名写进 `dsh.profile.bundles`——这一步由
   `@deepseek-ai/dsh-plugin-manager` 完成，`dsh plugin` 与插件页是同一条路径；
2. 启动组合时，本包的 `cordis.patch.yml` 作为一层，在 profile 自有 `cordis.patch.yml`
   **之前**应用（顺序见 `@deepseek-ai/dsh-app-boot` 的 profile 装载：各 bundle 的 patch →
   profile 自己的 patch → launcher 的 `--patch`）。本包排在 `@deepseek-ai/dsh-web-app`
   **之后**，所以能覆盖后者 `insert` 出来的 `preset-minimal`；dsh 的组合结果里会标注
   `# == @deepseek-ai/dsh-web-app, patched by @alm-allen/dsh-chat-preset`；
3. 预设内部那一行按**包名**解析到包入口 `plugins/no-global-tools.mjs`；
4. 预设是 **agent 平面**的组合：它在 roster 的 standing scope 下挂载一次，选择本预设的会话按
   scope 父子关系加入；各注册表、沙箱与审批栈、持久化、模型路由仍留在宿主组合里，不受影响。

## 自测

```sh
node plugins/self-test.mjs
```

它检查这份组合有没有被改坏：覆盖形态（顶层必须是 `- id: preset-minimal`，不能有
`- insert:`）、`config.id` 是否仍是 `minimal`、有没有声明自定义显示名、顶层插件行是否恰好是
`persona` + `no-global-tools`、整份文件有没有混进任何其它行、persona 的三个开关是否齐全、
零工具那一半是否按包名引用自己、包入口是否存在。任何一条坏掉，模型的每次请求都会**静默**
多出东西来——从对话里看不出来，这正是自测存在的理由。

## 已知代价与取舍

- **不压缩历史**。`compaction` 刻意不挂：不折叠、不摘要、不改写历史。长对话最终会撞上模型
  上下文窗口——这正是「纯对话」的直接语义。需要自动压缩时，把 `standard` 预设里的整个
  `compaction` group 原样复制进 `cordis.patch.yml`（注意 `tool-result-pruner` 必须与
  `compaction-basic` 共享同一个 realm，`token-meter` 留在宿主平面）。
- **没有工具可调**。这是本模式的定义，不是缺陷。要在纯对话与干活之间切换，切回标准模式
  或 PTC 模式即可。
- **覆盖会冻结整份 `config`**。dsh 升级后 shipped 的 `minimal` 若有改动，本包不会自动跟随。
  升级后把 `cordis.patch.yml` 与 `dsh-web-app/presets/minimal.patch.yml` 对一遍即可。基准版本是
  **0.2.1-rc.1**：该版的 shipped `minimal` 比 0.2.1-alpha.2 多了 `tool-fs`（只保留
  `readImage`）与 `compaction` group；本包照旧**刻意不挂**这两行。

## 兼容性

- 零第三方依赖、零构建步骤：仓库里放的就是最终产物，所以 `github:` 直装不需要任何构建授权。
- 本包不翻译提示词、不改任何文本，只决定「注入什么、不注入什么」，所以不存在上游改写文案
  导致翻译失效的问题。
- 本包不声明任何 `@deepseek-ai/dsh*` 的 peer，因此不会被 dsh 的插件兼容性预检拦下；
  它也不注册服务、不碰沙箱与审批栈、不写任何全局配置。

## 更新记录

每个版本的更新记录在 [CHANGELOG.md](./CHANGELOG.md)——打标签发布时，Release 报告就是从它里面抽的。

## 许可

MIT
