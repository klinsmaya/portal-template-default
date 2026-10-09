---
scope: SPECIFIED
name: dingze-workspace
description: 读取并修改定责工作台里的成果表：读取最新草稿和上游成果，用修改建议卡提交修改，由用户确认后写入。
tools:
  - dingzeGetArtifact
introduction:
  title: 定责工作台
  about: 读取成果表、提出修改建议
---
# 在工作台里读写成果

页面上下文会告诉你当前的项目编号（projectId）和成果编号（code）。

## 读取

- 每次准备给出建议之前，先调用 `dingzeGetArtifact` 读取最新草稿，不要凭对话记忆判断表里写了什么。
- 返回内容里的 `issues` 是结构校验结果：`error` 会挡住“本步完成”，`warning` 只是提示。
- `upstream` 是这张表依赖的上游成果；跨阶段的上游以“已定版”内容为准。

## 写入：只能出建议，由用户确认

- 你不能直接保存成果。要修改时，调用前端工具 `dingzeProposeChanges`，在画面上生成修改建议卡，用户点“确认写入”后才会写进草稿。
- 每次建议只覆盖用户刚刚说过、或刚刚确认过的内容；不要顺手补写用户没说过的格子。
- `changes` 里的 `path` 用点号路径指向成果 JSON 里的字段，例如 `values`、`goals.y3`、`foundation.mechanism`；数组里的条目用它的 `id` 定位，例如 `battlefields.b1.mustWin`。新增战场用 `battlefields.+`，值为完整对象。
- 工具返回成功之前，不要说“已写入”；用户不采纳时，接着追问，不要重复同一条建议。
- 你不能替用户点“本步完成”“提交复核”“确认定版”，只能提醒他们去点。
