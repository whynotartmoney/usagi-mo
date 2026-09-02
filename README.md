# Usagi X Carya

橫版過關小遊戲。測試用 · 非商業。

## 怎麼玩

用瀏覽器打開 `index.html`，或在專案資料夾執行：

```bash
python3 -m http.server 5180
```

然後開 http://127.0.0.1:5180/

- 鍵盤：← → ↑ ↓ 移動，空白鍵跳躍，J 攻擊
- 手機：用畫面下方按鍵

## 關卡

1-1 草原 · 1-2 火山 · 1-3 遊樂場 · 1-4 康丁斯基 · 1-5 天空之城  
1-6 海洋之旅 · 1-7 上樓梯 · 1-8 彩虹天堂 · 1-9 露營打怪 · 1-10 摩天輪城

過關後會顯示時間、金幣、分數，按「下一關」才進入下一關。

## 檔案

```
usagi/
  index.html
  README.md
  .gitignore
  css/style.css
  js/game.js
  assets/
    sprites/     角色圖（站、跑、跳、過關、開心）與棍子參考圖
    sfx/         跳躍音效 yaha.m4a
```
