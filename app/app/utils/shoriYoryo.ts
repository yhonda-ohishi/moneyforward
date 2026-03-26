/**
 * 電子帳簿保存法 電子取引データの訂正及び削除の防止に関する事務処理規程
 * HTML文書を生成してbase64で返す
 */
export function buildShoriYoryoHtml(driveFolderName: string): { base64: string; filename: string } {
  const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>電子取引データの訂正及び削除の防止に関する事務処理規程</title>
<style>
  body { font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.8; color: #333; }
  h1 { text-align: center; font-size: 1.3em; border-bottom: 2px solid #333; padding-bottom: 10px; }
  h2 { font-size: 1.1em; margin-top: 2em; border-left: 4px solid #2563eb; padding-left: 8px; }
  p, li { font-size: 0.95em; }
  .meta { text-align: right; margin-bottom: 2em; font-size: 0.9em; color: #666; }
  ol > li { margin-bottom: 0.5em; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; font-size: 0.9em; }
  th { background: #f5f5f5; }
  .blank { color: #999; border-bottom: 1px dashed #999; padding: 0 2em; }
</style>
</head>
<body>

<h1>電子取引データの訂正及び削除の防止に関する事務処理規程</h1>

<div class="meta">
  <p>制定日: ${today}</p>
  <p>管理責任者: <span class="blank">（氏名を記入）</span></p>
</div>

<h2>第1条（目的）</h2>
<p>この規程は、電子帳簿保存法第7条に基づき、電子取引の取引情報に係る電磁的記録の適正な保存を確保するために必要な事項を定めることを目的とする。</p>

<h2>第2条（適用範囲）</h2>
<p>この規程は、当社（個人事業主を含む）における電子取引の取引情報に係る電磁的記録の保存に適用する。対象となる書類種別は以下のとおり。</p>
<table>
  <tr><th>書類種別</th><th>具体例</th></tr>
  <tr><td>請求書</td><td>メール添付PDF、クラウドサービス発行の請求書</td></tr>
  <tr><td>領収書</td><td>ECサイト発行の電子領収書、キャッシュレス決済明細</td></tr>
  <tr><td>見積書</td><td>メール添付の見積書PDF</td></tr>
  <tr><td>納品書</td><td>電子納品書</td></tr>
  <tr><td>契約書</td><td>電子契約サービスの契約書</td></tr>
  <tr><td>その他</td><td>注文書、注文請書等</td></tr>
</table>

<h2>第3条（管理責任者）</h2>
<p>電子取引データの保存に関する管理責任者は、<span class="blank">（氏名・役職を記入）</span>とする。管理責任者は本規程の運用状況を監督し、必要に応じて規程の見直しを行う。</p>

<h2>第4条（電子取引データの受領方法）</h2>
<p>当社が受領する電子取引データの主な受領方法は以下のとおり。</p>
<ol>
  <li>電子メールに添付された請求書等のPDFファイル</li>
  <li>ウェブサイトからダウンロードした請求書等</li>
  <li>クラウドサービスにて発行・受領した電子書類</li>
  <li>スキャナーで電子化した紙の書類（電子取引に該当するもの）</li>
</ol>

<h2>第5条（保存方法）</h2>
<p>電子取引データは、以下の方法で保存する。</p>
<ol>
  <li>受領した電子取引データは、本システム（電帳法インボイス管理アプリ）を使用して Google Drive の「<strong>${escapeHtml(driveFolderName)}</strong>」フォルダに保存する。</li>
  <li>保存時に以下のメタデータを記録する。
    <ul>
      <li>取引年月日</li>
      <li>取引金額（税込）</li>
      <li>取引先名</li>
      <li>書類種別</li>
    </ul>
  </li>
  <li>保存されたファイルは年度別サブフォルダ（例: 2025、2026）に整理する。</li>
  <li>ファイル名は「取引日_取引先名.拡張子」の形式で統一する。</li>
</ol>

<h2>第6条（検索要件の確保）</h2>
<p>本システムにおいて、以下の条件での検索を可能とする。</p>
<ol>
  <li>取引年月日（範囲指定による検索が可能）</li>
  <li>取引金額（範囲指定による検索が可能）</li>
  <li>取引先名</li>
</ol>
<p>これらの検索条件を組み合わせた検索も可能とする。</p>

<h2>第7条（訂正及び削除の防止措置）</h2>
<p>電子取引データの真実性を確保するため、以下の措置を講じる。</p>
<ol>
  <li>保存されたデータの訂正・削除は、管理責任者の承認を得た場合に限り行うものとする。</li>
  <li>やむを得ず訂正・削除を行う場合は、以下の事項を記録する。
    <ul>
      <li>訂正・削除の日時</li>
      <li>訂正・削除の理由</li>
      <li>訂正・削除を行った者の氏名</li>
      <li>訂正前のデータの内容</li>
    </ul>
  </li>
  <li>本規程に反する訂正・削除は行わないものとする。</li>
</ol>

<h2>第8条（バックアップ）</h2>
<p>データの滅失を防止するため、以下のバックアップ措置を講じる。</p>
<ol>
  <li>本システムの設定画面より、全データを SQLite ファイルとしてエクスポートし、Google Drive に保存する。</li>
  <li>バックアップは定期的（少なくとも月次）に実施する。</li>
</ol>

<h2>第9条（保存期間）</h2>
<p>電子取引データの保存期間は、法人税法及び所得税法の規定に基づき、<strong>7年間</strong>（欠損金の繰越控除の適用を受ける場合は10年間）とする。保存期間の起算日は、当該取引に係る確定申告書の提出期限の翌日とする。</p>

<h2>第10条（定期点検）</h2>
<p>管理責任者は、少なくとも年1回、以下の事項について点検を行う。</p>
<ol>
  <li>電子取引データが本規程に従い適正に保存されていること</li>
  <li>検索機能が正常に動作すること</li>
  <li>バックアップが適切に実施されていること</li>
  <li>不正な訂正・削除が行われていないこと</li>
</ol>

<h2>第11条（規程の改廃）</h2>
<p>本規程の改廃は、管理責任者が起案し、決裁を経て行うものとする。</p>

<p style="margin-top: 3em; text-align: right; font-size: 0.9em; color: #666;">以上</p>

</body>
</html>`

  const encoder = new TextEncoder()
  const bytes = encoder.encode(html)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  const base64 = btoa(binary)
  const filename = '電子取引データの訂正及び削除の防止に関する事務処理規程.html'

  return { base64, filename }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
