# AI Usage Status v0.1

Cursor / VS CodeのStatus BarにCodex・Claude・Antigravityの各quota残量を表示します。
Usageの取得元はローカルの `codexbar dashboard --identity redacted` のJSON出力のみです。
拡張自身はHTTP server、外部API、認証情報へアクセスしません。実行時の追加npm依存はありません。

本プロジェクトは非公式の拡張です。CodexBarおよび各AIサービスの開発元とは提携していません。
CodexBar CLIは別途インストール・設定が必要です。`codexbar dashboard --identity redacted` が実行できる環境で利用してください。

## 表示

`Codex S92 W80`　`Claude S44 W46`　`AG G0 3P0`

数値は残量のパーセント（Status Barでは整数に丸めます）。S = Session、W = Weekly、G = Gemini Weekly、3P = Claude/GPT Weeklyです。
各Providerをクリックすると全windowのlabel・remaining・used・ローカル日時のresetをQuickPickに表示します。
コマンドパレットの `AI Usage: Show Details` では3 Providerの詳細をまとめて確認できます。

起動時に1回取得し、60秒ごとに更新します。45秒でタイムアウトし、実行中の重複取得は行いません。
取得不能・Provider不在・値欠損は `--`。一部Providerのエラーは他Providerに影響しません。
CLIが見つからない場合は通知を表示します。PATHを設定後、エディターを再起動してください。
失敗時に古い残量を表示し続けることはありません。次の周期で自動再試行します。
identity、accountEmail、コスト、生のエラー出力はUIに渡しません。

## 開発・起動

前提: Node.js 20以降、npm、CursorまたはVS Code 1.85以降、PATH上のCodexBar CLI。

```sh
npm install
npm run build
npm run lint
npm run typecheck
npm test
```

このフォルダをCursor / VS Codeで開き、F5で `Run AI Usage Status` を起動します。
Extension Development HostのStatus Barに3項目が表示されます。
常用インストールする場合は `npx @vscode/vsce package` でVSIXを作り、Extensionsの `Install from VSIX...` でインストールできます。

## 構成

- `src/codexBarClient.ts`: shellを介さないone-shot CLI実行・エラー処理
- `src/usageParser.ts`: 最小フィールドの抽出、Provider/quota定義、表示整形
- `src/statusBarController.ts`: Status BarとQuickPick
- `src/extension.ts`: ライフサイクル・60秒更新・破棄
- `test/*.test.cjs`: 解析・CLI境界・起動時取得・60秒更新・重複抑止・復旧・破棄のテスト

将来のProvider追加は `PROVIDERS` の定義に追加します。未知のwindowも詳細には残します。
主要quotaはkindと限定的なlabelの識別規則で判定します。
複数windowが同じquotaに一致する場合、集約せず `--` とします。

## 動作確認結果

2026-10-15、CursorのF5によるExtension Development Hostで、実CodexBar JSONを使った表示を確認しました。

- Codex: Session/Weeklyの残量・使用率とローカルReset日時
- Claude: Session/Weeklyの残量・使用率、欠損Resetは `--`
- Antigravity: Gemini/Claude・GPTそれぞれの残量・使用率（残量0%を含む）
- install / build / lint / typecheck / 単体テスト6件が成功

Cursorの独立プロファイルに対するCLI自動テスト起動では開発拡張が登録されなかったため、
Host検証は実際のF5起動と画面操作で実施しました。VS Code単体でのGUI起動は未検証です。

## ライセンス

[MIT](LICENSE)
