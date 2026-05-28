# .omni-runtime/ — クラウド搬入パッケージ

このディレクトリは **クラウドのGitHub Actions runner に積む `~/.claude/` の中身** です。
これを runner に展開することで、PCと同じ `claude --agent omni` がクラウドで動きます。

## 同梱物（PCの `~/.claude/` のサブセット）

| 同梱物 | 用途 |
|---|---|
| `agents/*.md` | omni本体 + 20種の専門エージェント定義 |
| `CLAUDE.md` | スリム化済みコア（846行）。司令塔のホットパス |
| `knowledge/*.md` | 領域別詳細（nha/spk/bt/pricing/gas/tools/sns/incidents/omni_build） |

## **同梱しないもの**（クラウドに置いてはいけない）

- 認証情報（`~/.claude.json`・credential系）→ クラウドは `ANTHROPIC_API_KEY` シークレットを使う
- `history.jsonl`・`settings.local.json` → ローカル運用情報
- MCPキャッシュ・履歴ログ

## 同期ルール

PC側の `~/.claude/agents/` `~/.claude/knowledge/` `~/.claude/CLAUDE.md` を更新したら、
このディレクトリにも同期してコミットする必要があります（さもないとクラウドomniが古い知識で動く）。

同期スクリプト（手動実行）:
```bash
RT=~/Desktop/HANDYMAN/omni_bot/.omni-runtime
rm -rf "$RT/agents" "$RT/knowledge" "$RT/CLAUDE.md"
cp -R ~/.claude/agents "$RT/agents"
cp -R ~/.claude/knowledge "$RT/knowledge"
cp    ~/.claude/CLAUDE.md "$RT/CLAUDE.md"
date '+%Y-%m-%d %H:%M:%S JST' > "$RT/SYNCED_AT"
```

## サイズ目安

約 428KB（軽量・git管理可）。
