# SongArchive

SongArchive 是一個以 React、TypeScript 與 Vite 製作的個人歌曲紀錄工具。資料可以保存在瀏覽器的 `localStorage`，也可以透過 Google 或 GitHub 登入同步到雲端。

## 功能

- 設定目前紀錄天數
- 新增、編輯及刪除歌曲
- 記錄歌名、歌手、連結與備註
- 依歌名或歌手搜尋
- 依日期或天數排序
- 顯示最近新增歌曲
- 匯出及匯入 JSON 備份
- 使用 Google 或 GitHub 帳號登入並同步雲端資料
- 重置初始化設定時保留歌曲資料
- 清除全部本機資料

## 開發環境

- React 19
- TypeScript 6
- Vite 8
- ESLint 10

## 安裝與執行

```bash
npm install
npm run dev
```

Vite 會在終端顯示本機開發網址。

## 檢查與建置

```bash
npm run lint
npm run build
```

建置結果會輸出至 `dist` 目錄。

## 資料保存

歌曲與設定保存在目前瀏覽器的 `localStorage`，儲存鍵為 `songArchive_data`。清除瀏覽器網站資料可能會刪除紀錄，建議定期使用設定頁面的匯出功能備份 JSON 檔案。

登入 Google 或 GitHub 帳號後，資料會同步至該帳號專屬的 Cloud Firestore 文件。初始化頁與設定頁都可以登入同步；未登入時仍可只使用本機資料。同一個電子郵件若已先用 Google 登入，請先用 Google 登入後到設定頁連結 GitHub，之後就能直接用 GitHub 登入同一份資料。

## iOS App 開發（Capacitor + Xcode）

本專案已加入 Capacitor iOS 專案，可在 macOS 的 Xcode 中開發與執行。首次在 MacBook 上操作時，請先安裝 Node.js、Xcode 與 Xcode Command Line Tools，再執行：

```bash
npm install
npm run cap:sync
npm run cap:open:ios
```

`npm run cap:sync` 會先以 Capacitor 相對資源路徑建置 Web App，再把內容同步到 `ios/`。`npm run cap:open:ios` 會開啟 Xcode 專案；在 Xcode 中選擇 `App` target 與你的 MacBook Air M3 或已連接的 iPhone，即可按 Run 執行。若要使用 Google／GitHub OAuth 登入，請在 Firebase Console、Apple Developer／Xcode Signing 與 OAuth provider 設定中加入實際 iOS Bundle ID：`com.songarchive.personal`，並在正式發布前完成原生 OAuth callback 設定。

如果 Xcode 模擬器仍顯示舊版本號，先確認目前程式碼是最新版本，再完整更新內嵌資源：

```bash
git pull --ff-only origin main
npm install
npm run cap:sync
```

接著在 Xcode 執行 **Product → Clean Build Folder**（按住 `Option` 後開啟 Product 選單），再按 `Command + B`、`Command + R`。若仍是舊畫面，停止 App、從模擬器刪除 SongArchive，再重新執行；畫面中的版本號應該要與目前原始碼一致。

GitHub Pages 仍使用原本的 Web 建置指令：

```bash
npm run build
```

iOS App 的建置指令：

```bash
npm run build:ios
npm run cap:sync
```

## 版本

目前版本：`26.15.1b`
