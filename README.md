# Studyplanner

**Studyplanner** は、日々の学習計画と教材の進捗状況を管理できる、シンプルで軽量な PWA 対応の学習管理 Web アプリです。

インストールは不要です。ブラウザからアクセスするだけで利用を開始できます。

### [今すぐ Web アプリを開く](https://haryag.github.io/Studyplanner/)

---

## 主な機能

- 今日の予定管理: 教材ごとに「今日は○○の p.10～20 を進める」といった計画を登録し、達成したらチェックできます。
- 教材の進捗管理:
    - 教科別（英語、数学など）の色分け表示に対応しています。
    - 進捗バーで達成度をひと目で確認できます。
    - タグを付けることで、教材を分類できます。
- 直感的な操作: タップするだけでカードが開閉します。並び替えも直感的です。
- PWA 対応 (アプリとして使える):
    - スマホ（iPhone/Android）のホーム画面に追加して、全画面表示のアプリ感覚で使えます。
    - 完全にオフラインでも利用できます。地下鉄や機内でも予定の確認・変更が可能です。
- バックアップ: Google ログインすることで、学習データをクラウド（Firebase）にバックアップできます。（任意）

---

## 使い方

### 1. アプリを始める
https://haryag.github.io/Studyplanner/ にアクセスします。

### 2. 教材を登録する
右下のメニューから「教材一覧」画面を開き、「教材追加」ボタンを押します。  
使っている参考書や問題集を登録できます。タグ付けも可能です。

### 3. 今日の予定を立てる
「予定を追加」ボタンから、登録した教材を選び、今日やる範囲を入力します。

### 4. アプリとしてインストールする方法（推奨）
- iOS (iPhone/iPad): Safari の共有ボタンから「ホーム画面に追加」を選択。
- Android / PC (Chrome): メニューから「アプリをインストール」を選択。

---

## 技術スタック

- フロントエンド: HTML5, CSS3, Vanilla JavaScript (ES Modules)
- PWA: Service Worker (Cache / Offline 対応)
- データベース:
    - ローカル: IndexedDB（端末内保存、オフライン用）
    - クラウド連携: Firebase Firestore（バックアップ用、任意）
- クラウド認証: Firebase Authentication（Google ログイン）

---

## ディレクトリ構成

```text
Studyplanner/
├── index.html        # アプリのエントリーポイント
├── manifest.json     # PWA 設定ファイル
├── sw.js             # オフライン動作・更新管理
├── static/
│   ├── style.css     # UI デザイン
│   ├── script.js     # アプリの主要ロジック
│   └── login.js      # Firebase 認証
└── icon/             # アイコンリソース
```

---

## 開発者向け情報

ローカル環境で開発する場合、sw.js や import が正しく動作するよう簡易 Web サーバーを立ててください。

```bash
python3 -m http.server 8000
```

---

## ライセンス
MIT License  
Created by haryag
