# SongArchive

SongArchive 是一個以 React、TypeScript 與 Vite 製作的個人歌曲紀錄工具。資料保存在瀏覽器的 `localStorage`，不需要後端服務即可使用。

## 功能

- 設定目前紀錄天數
- 新增、編輯及刪除歌曲
- 記錄歌名、歌手、連結與備註
- 依歌名或歌手搜尋
- 依日期或天數排序
- 顯示最近新增歌曲
- 匯出及匯入 JSON 備份
- 使用 Google 帳號登入並同步雲端資料
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

登入 Google 帳號後，資料會同步至該帳號專屬的 Cloud Firestore 文件。未登入時仍可只使用本機資料。

## 版本

目前版本：`26.1.0`
