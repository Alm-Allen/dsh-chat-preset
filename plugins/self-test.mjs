/**
 * self-test：离线校验「纯对话」这份契约。
 *
 * 本包不翻译任何文本，功能全在 cordis.patch.yml 的结构里，所以自测的对象就是那份结构：
 * 覆盖形态对不对、有没有混进工具行、persona 的零提示词开关是否齐全、零工具那半是否按
 * 包名引用自己。任何一条被改坏，模型的每一次请求都会静默地多出东西来——而"多出来"这件事
 * 从对话里看不出来，这正是本文件存在的理由。
 *
 * 用法：node plugins/self-test.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

const results = []
const check = (label, ok, detail = '') => results.push({ label, ok, detail })

// ── 覆盖形态 ─────────────────────────────────────────────────────────────────────

check(
	'覆盖而非新增',
	/^- id: preset-minimal$/m.test(patch) && !/^- insert:/m.test(patch),
	'顶层必须是 `- id: preset-minimal`（Loader 的 override），不能出现 `- insert:`'
)

check(
	'config.id 保持 minimal',
	/^\s{4}id: minimal$/m.test(patch),
	'会话保存的是 config.id；改成别的会让已选过本预设的会话找不到它'
)

check(
	'声明了自定义显示名与描述',
	/^\s{4}name: .+$/m.test(patch) && /^\s{4}description: .+$/m.test(patch),
	'不写 config.name 时 UI 会回落成内置文案「极简模式 / Agent 仅使用终端工具完成任务」，与实际行为矛盾'
)

// ── 零工具：一行工具都不许有 ──────────────────────────────────────────────────────

const pluginIds = [...patch.matchAll(/^ {6}- id: (\S+)/gm)].map((m) => m[1])
check(
	'顶层插件行恰好是 persona + no-global-tools + zero-injection',
	pluginIds.length === 3 &&
		pluginIds[0] === 'persona' &&
		pluginIds[1] === 'no-global-tools' &&
		pluginIds[2] === 'zero-injection',
	`实际：${pluginIds.join(', ') || '(空)'}`
)

const allowed = ['preset-minimal', 'persona', 'no-global-tools', 'zero-injection']
const extra = [...patch.matchAll(/^\s*- id: (\S+)/gm)]
	.map((m) => m[1])
	.filter((id) => !allowed.includes(id))
check(
	'整份 patch 里没有混进任何其它行',
	extra.length === 0,
	`多出来的行：${extra.join(', ')}——每一行都在往对话里加东西`
)

// ── 零系统提示词：三个开关缺一不可 ────────────────────────────────────────────────

check('persona：prefix 置空', /^\s{10}prefix: ''$/m.test(patch), "空模板是「零系统提示词」的取值")
check(
	'persona：complete 打开',
	/^\s{10}complete: true$/m.test(patch),
	'complete 在瀑布之后把 sections 复原为这一节本身，身份段与工具 guidance 全靠它抑制'
)
check(
	'persona：运行时上下文关闭',
	/^\s{10}includeRuntimeContext: false$/m.test(patch),
	'不关的话沙箱策略、审批策略、委派说明会作为动态上下文注入'
)

// ── 零工具的另一半：按包名引用自己 ────────────────────────────────────────────────

check(
	'no-global-tools 按包名引用',
	patch.includes(manifest.name + '/no-global-tools') && !/^\s*name: \.\//m.test(patch),
	'预设里的行以 profile 目录为解析基准，写相对路径解析不到本包'
)

check(
	'包入口存在且被 exports 声明',
	existsSync(join(root, 'plugins', 'no-global-tools.mjs')) &&
		manifest.exports['./no-global-tools'] !== undefined,
	''
)

check(
	'zero-injection 按包名引用',
	patch.includes(manifest.name + '/zero-injection'),
	'与 no-global-tools 同理：预设里的行以 profile 目录为解析基准，写相对路径解析不到本包'
)

const zeroInjection = readFileSync(join(root, 'plugins', 'zero-injection.mjs'), 'utf8')
check(
	'zero-injection 在组装末端清空 tools 与 contexts',
	existsSync(join(root, 'plugins', 'zero-injection.mjs')) &&
		manifest.exports['./zero-injection'] !== undefined &&
		/contexts: \[\]/.test(zeroInjection) &&
		/tools: \[\]/.test(zeroInjection) &&
		/system-prompt\/assemble/.test(zeroInjection),
	'agent 作用域注册的工具与 required context 绕得过 persona 与 restrict，只能在这里摘'
)

// ── 结果 ────────────────────────────────────────────────────────────────────────

let failed = 0
for (const r of results) {
	if (!r.ok) failed++
	console.log(`${r.ok ? '  ok  ' : ' FAIL '}  ${r.label}${r.ok || !r.detail ? '' : '\n         ' + r.detail}`)
}
console.log('')
if (failed === 0) {
	console.log(`全部通过（${results.length} 项）：这份组合仍然是「零工具 + 零系统提示词」。`)
} else {
	console.log(`${failed} / ${results.length} 项失败——在把它装进 profile 之前先修好。`)
	process.exit(1)
}
