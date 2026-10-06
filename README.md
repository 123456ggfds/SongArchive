# SongArchive

SongArchive 是一個以 React、TypeScript 與 Vite 製作的個人歌曲紀錄工具。資料可以保存在瀏覽器的 `localStorage`，也可以透過 Google 或 GitHub 登入同步到雲端。

## 功能

- 設定目前紀錄天數
- 新增、編輯及刪除歌曲
- 記錄歌名、歌手、連結與備註
- 貼上 YouTube Music 影片連結時自動帶入歌名與歌手
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

`npm run cap:sync` 會先以 Capacitor 相對資源路徑建置 Web App，再把內容同步到 `ios/`。`npm run cap:open:ios` 會開啟 Xcode 專案；在 Xcode 中選擇 `App` target 與你的 MacBook Air M3 或已連接的 iPhone，即可按 Run 執行。

iOS 版的 Google／GitHub 登入已改用原生 Firebase Authentication，不再依賴 WKWebView 的 `signInWithPopup`。首次設定時，請在 Firebase Console 的 Authentication → Sign-in method 啟用 Google 與 GitHub，並在 Project settings → Your apps 新增 iOS App，Bundle ID 使用 `com.songarchive.personal`，下載 `GoogleService-Info.plist` 後拖入 Xcode 的 `App` target 並勾選 Copy items if needed。接著在 Xcode 的 App → Info → URL Types 加入 `GoogleService-Info.plist` 內的 `REVERSED_CLIENT_ID`，並執行 `npm run cap:sync`。Web 版仍會使用原本的 Firebase popup 登入。

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

## Android App 開發（Capacitor + Android Studio）

Android 專案位於 `android/`，沿用現有介面、歌曲資料格式及 Firebase 雲端同步，套件名稱為 `com.songarchive.personal`。最低支援 Android 7.0（API 24），編譯與目標 SDK 為 API 36。

開發環境需要 Node.js、JDK 21、Android Studio 與 Android SDK Platform 36。請在 Android Studio 的 SDK Manager 安裝 SDK，並由 IDE 設定 SDK 位置（`android/local.properties`，不提交 Git）。

```bash
npm install
npm run cap:sync:android
npm run cap:open:android
```

`cap:sync:android` 會重新建置並同步 Web 資源及原生套件。每次修改 React 程式後都需重新同步，再於 Android Studio 執行 App。

### Firebase 與登入

Firebase 專案 `songarchive-da81e` 的 Android App 已註冊，App ID 為 `1:638884319921:android:773b9344821bcb3c35c890`。新電腦需下載 Android 設定檔並放到 `android/app/google-services.json`；此檔不提交 Git。缺少設定檔時建置會明確提示，避免產生啟動時 Firebase 初始化失敗的 App。

```bash
npx firebase-tools apps:sdkconfig ANDROID 1:638884319921:android:773b9344821bcb3c35c890 --project songarchive-da81e --out android/app/google-services.json
```

在 Firebase Console 的 Authentication 啟用 Google 與 GitHub，並在 Android App 設定加入簽章 SHA-1 與 SHA-256。可在 `android/` 執行 `./gradlew signingReport`（Windows 使用 `.\gradlew.bat signingReport`）取得指紋。加入指紋後重新下載設定檔，確保包含 Google OAuth 用戶端。更換電腦、正式簽章或使用 Google Play App Signing 時，也需註冊對應指紋。

Android 登入使用原生 Firebase 外掛取得憑證，再交由現有 JavaScript Firebase 帳號與 Firestore 同步流程處理。備份匯出使用 Android 分享選單，請選擇檔案儲存或分享目的地；匯入仍可透過檔案選擇器讀取 JSON。

參考：[Google 登入外掛設定](https://github.com/capawesome-team/capacitor-firebase/blob/main/packages/authentication/docs/setup-google.md)、[GitHub 登入外掛設定](https://github.com/capawesome-team/capacitor-firebase/blob/main/packages/authentication/docs/setup-github.md)。

### 產生測試 APK

先在專案根目錄執行 `npm run cap:sync:android`，再於 PowerShell 執行：

```powershell
cd android
.\gradlew.bat assembleDebug
```

測試安裝檔位於 `android/app/build/outputs/apk/debug/app-debug.apk`。可直接安裝到 Android 手機；正式發佈時請在 Android Studio 使用 **Generate Signed App Bundle / APK** 建立自己的簽章，並保管好金鑰。Android 的 `versionName` 與 `versionCode` 在 `android/app/build.gradle`；每次上架需提高 `versionCode`。

建議實機驗證：離線新增／編輯歌曲、重新啟動後資料保存、Google／GitHub 登入與登出、跨裝置同步、JSON 匯出／匯入，以及返回鍵和鍵盤遮擋情形。

## App Icon

SongArchive 的 Liquid Glass App Icon 已整合至 Xcode 專案：`ios/App/App/Assets.xcassets/AppIcon.appiconset/`。若 Xcode 沒有立即顯示新圖示，請執行 `Product → Clean Build Folder`，再重新安裝模擬器或實體 iPhone 上的 App。

## 版本

目前版本：`26.17.1b`

### 26.17.1b

- 新增 YouTube Music 影片連結辨識：貼上連結後會自動帶入尚未填寫的歌名與歌手。
