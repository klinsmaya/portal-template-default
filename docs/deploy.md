# 发布与部署

平台由两部分组成，发布顺序固定：先插件，后门户，最后给角色开门户入口。

## 1. 定责业务插件 `@ziqu/plugin-dingze`

源码在 `server-plugins/plugin-dingze`。改动后先在 `package.json` 里提升版本号，再执行：

```bash
NOCOBASE_SRC=<与服务器同版本的 NocoBase 源码目录> \
NOCOBASE_API_URL=https://<host>/api \
NOCOBASE_TOKEN=<管理员 API 令牌> \
server-plugins/scripts/deploy-dingze.sh
```

脚本会构建插件包、安装或更新插件，并轮询到新版本启用为止。首次启用时插件会创建 5 个系统角色：`dz_consult_admin`、`dz_consultant`、`dz_ent_admin`、`dz_ent_member`、`dz_ops`。

## 2. AI 门户 `dingze`

门户的开发目录就是本仓库。首次在一个环境上发布：

```bash
nb portal create dingze --template <本仓库路径> --title "自驱战略 · 定三责" --path <任意空目录>
nb portal config dingze --path <本仓库路径>
nb portal deploy dingze
nb portal info dingze -j   # 读回：developmentPath 应为本仓库
```

之后每次发布只需 `nb portal deploy dingze`（构建当前代码并上传 `dist`，不会推送源码）。

- 部署会把本次环境的 API 地址写进 `.env` / `.env.local`（均已忽略，不提交）。
- 经代理访问服务器的环境里，Node 自带的 `fetch` 默认不走代理，上传 `dist` 会被中断；这时用 `NODE_USE_ENV_PROXY=1 nb portal deploy dingze`。

## 3. 角色的门户入口

新门户默认没有任何角色可以进入（登录后显示“无权访问此门户”）。给 5 个定责角色开入口，只影响 `dingze`，不改动其他门户：

```bash
for r in dz_consult_admin dz_consultant dz_ent_admin dz_ent_member dz_ops; do
  nb api acl roles multi-portals add --role-name "$r" --body '["dingze"]' -j
  nb api acl roles multi-portals list --role-name "$r" -j   # 读回应包含 "dingze"
done
```

注意：在 2.4.0-alpha.9 上，`--values '["dingze"]'` 返回成功但不会写入，必须用 `--body` 传原始数组。

## 4. 发布后检查

1. 用咨询师账号登录 `https://<host>/x/dingze/`，应进入“咨询师工作台”。
2. 用企业项目负责人账号登录，应进入“我的项目”，并能打开工作区与数字咨询师。
3. 用运营管理员账号登录，侧栏应有“运营管理”。
