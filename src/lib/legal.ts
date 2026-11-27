/**
 * Must #5 legal page copy and the fields only Dave can fill.
 *
 * Public wording comes from /workspace/meetings/idol/MUST5_隱私條款_草稿_2026-11-24.md
 * sections 1–3, with the site URL taken from getSiteUrl() and unfilled
 * operator facts kept as visible placeholders.
 *
 * TODO(must5): replace every UNFILLED legal field below before merge.
 * Do not invent an operator name, contact email, effective date, minors
 * policy, jurisdiction, or liability cap.
 */
import { getSiteUrl } from './seo/metadata'

/** Marker used in reports and the check script. Do not remove until every field is filled. */
export const LEGAL_TODO = 'TODO(must5): fill before merge — do not invent a value'

export const LEGAL_OPERATOR_NAME = '【待 Dave 填：個人姓名或公司／行號全名】'
export const LEGAL_CONTACT_EMAIL = '【待 Dave 填：聯絡信箱】'
export const LEGAL_OTHER_CONTACT = '【待 Dave 填：若無可刪除此行，例如通訊地址或表單】'
export const LEGAL_EFFECTIVE_DATE = '【待 Dave 填：生效日】'
export const LEGAL_LAST_UPDATED = '【待 Dave 填：最後更新日期】'
export const LEGAL_MINORS_POLICY = '【待 Dave 確認年齡門檻與表述】'
export const LEGAL_JURISDICTION = '【待 Dave 確認管轄法院】'
export const LEGAL_LIABILITY_SCOPE = '【待 Dave 確認損害賠償範圍】'

export const LEGAL_FIELD_VALUES = {
  OPERATOR_NAME: LEGAL_OPERATOR_NAME,
  CONTACT_EMAIL: LEGAL_CONTACT_EMAIL,
  OTHER_CONTACT: LEGAL_OTHER_CONTACT,
  EFFECTIVE_DATE: LEGAL_EFFECTIVE_DATE,
  LAST_UPDATED: LEGAL_LAST_UPDATED,
  MINORS_POLICY: LEGAL_MINORS_POLICY,
  LIABILITY_SCOPE: LEGAL_LIABILITY_SCOPE,
  JURISDICTION: LEGAL_JURISDICTION,
} as const

export type LegalFieldKey = keyof typeof LEGAL_FIELD_VALUES

export const LEGAL_FIELD_LABELS: Record<LegalFieldKey, string> = {
  OPERATOR_NAME: '業者名稱',
  CONTACT_EMAIL: '聯絡信箱',
  OTHER_CONTACT: '其他聯絡方式',
  EFFECTIVE_DATE: '生效日',
  LAST_UPDATED: '最後更新日期',
  MINORS_POLICY: '未成年人表述',
  JURISDICTION: '管轄法院',
  LIABILITY_SCOPE: '損害賠償範圍',
}

export function isLegalPlaceholder(value: string): boolean {
  return value.includes('【待 Dave')
}

/** Fields that still need Dave before this can merge. */
export function listUnfilledLegalFields(): { key: LegalFieldKey; label: string; value: string }[] {
  return (Object.keys(LEGAL_FIELD_VALUES) as LegalFieldKey[])
    .filter((key) => {
      const value = LEGAL_FIELD_VALUES[key]
      if (key === 'OTHER_CONTACT' && value.trim() === '') return false
      return isLegalPlaceholder(value) || value.trim() === ''
    })
    .map((key) => ({ key, label: LEGAL_FIELD_LABELS[key], value: LEGAL_FIELD_VALUES[key] }))
}

export const LEGAL_NAV = [
  { href: '/privacy', label: '隱私權政策' },
  { href: '/terms', label: '服務條款' },
  { href: '/disclaimer', label: '資料來源與免責' },
] as const

export type LegalPath = (typeof LEGAL_NAV)[number]['href']

export const LEGAL_PAGE_PATHS: LegalPath[] = LEGAL_NAV.map((item) => item.href)

export type LegalDoc = {
  path: LegalPath
  title: string
  heading: string
  description: string
  markdown: string
}

const PRIVACY_SOURCE = "# 星動時刻隱私權政策\n\n**生效日：{{EFFECTIVE_DATE}}**\n**最後更新日期：{{LAST_UPDATED}}**\n\n歡迎使用「星動時刻 Idol Rhythm」（以下稱「本網站」，目前網址為 {{SITE_URL}}）。\n\n我們重視你的個人資料，也希望用白話跟你說清楚：我們收什麼、為什麼收、放多久、會不會給別人，以及你怎麼查閱或刪除。本政策依照中華民國《個人資料保護法》應告知的事項撰寫。\n\n若你對本政策有任何問題，或要行使下方所述的權利，請聯絡：\n\n- 業者名稱：{{OPERATOR_NAME}}\n- 聯絡信箱：{{CONTACT_EMAIL}}\n- 其他聯絡方式：{{OTHER_CONTACT}}\n\n---\n\n### 一、我們蒐集資料的目的\n\n我們蒐集個人資料，是為了：\n\n1. 讓你註冊、登入、管理帳號，並寄送必要的驗證或重設密碼信件。\n2. 提供你選擇使用的功能：追蹤偶像、收藏活動、設定活動提醒、訂閱行事曆、標記「我想去」或「去過」、許願希望補上的團或城市、回報活動資料錯誤。\n3. 在網站內通知你：已設定的活動即將開始，或你追蹤的偶像有新的公開活動。\n4. 維護網站安全、防止濫用（例如限制短時間內重複送出）。\n5. 了解網站大致的瀏覽情況，據以改善內容與穩定度。這是彙總統計，不是為了認出你是誰。\n6. 處理你向我們提出的權利行使、申訴或其他必要聯繫。\n\n你不一定要註冊才能瀏覽公開的偶像與活動資訊。但若你不提供登入所需的 email，就無法使用需帳號的功能（例如把追蹤清單同步到其他裝置、或訂閱「我追蹤的全部」行事曆）。\n\n---\n\n### 二、我們蒐集哪些資料\n\n我們只收集提供服務所需的資料。依你怎麼使用本網站，可能包括：\n\n**1. 帳號與登入資料**\n\n- Email 地址。\n- 你自行設定的密碼（由認證服務以加密／雜湊方式保存，本網站看不到明文密碼）。\n- 登入與驗證過程中必要的工作階段資料（例如登入 cookie）。\n- 若你選擇「使用 Google 登入」，我們會經由 Google 收到你的 email，以及 Google 在你同意授權時提供的其他基本資料（通常可能包含姓名、頭像網址）。本網站前台目前主要使用 email 來識別帳號。\n\n本網站目前提供的登入方式為：Email 加密碼、Magic Link（到信箱點連結登入），以及 Google 登入。我們沒有使用其他社群帳號登入，也沒有請你填寫真實姓名、電話、地址或身分證字號。\n\n**2. 你在本網站上的使用紀錄（需帳號的部分）**\n\n- 你追蹤了哪些偶像。\n- 你收藏了哪些活動。\n- 你為哪些活動設定了提醒（活動前 1 天、前 1 週）。\n- 站內通知內容，以及你是否已讀。\n- 你登入後標記的「我想去」、許願內容（只有團名或城市名，沒有留言）、以及「去過」蓋章。\n- 若你產生「訂閱我追蹤的全部行程」連結：專用的訂閱 token、提醒設定，以及此連結最近一次被讀取的時間。\n- 你登入後送出的活動錯誤回報（錯誤類型，以及你選擇填寫的簡短說明）。\n\n**3. 未登入時可能留下的資料**\n\n未登入也可以瀏覽公開內容，並在你的瀏覽器裡暫存追蹤、收藏、提醒或蓋章，這些資料留在你的裝置上，不會自動上傳到你的帳號。\n\n若你未登入就使用「我想去」、許願或錯誤回報，本網站會在你的瀏覽器產生一組隨機裝置編號，並只把經過雜湊（無法還原成原編號）的值送到伺服器。我們用它來計算人數、避免同一裝置重複送出，而不會公開「是誰點的」。這組編號存在你的瀏覽器裡，清除網站資料或換裝置後，就會變成新的編號。\n\n**4. 你主動提供的其他內容**\n\n- 許願：僅團名或城市名。\n- 錯誤回報：錯誤類型與選填說明（有字數限制，且不接受網址）。後台工作人員為了修正資料會看到這些內容。\n\n**5. 瀏覽與技術資料**\n\n- 為了讓你保持登入，我們會使用必要的登入 cookie。\n- 本網站使用 Vercel Web Analytics 了解頁面瀏覽情形。依該服務官方說明，它不使用 cookie，也不用來跨網站或跨日追蹤可識別的個人；可能處理的資料包括瀏覽的頁面路徑、來源網址、粗略地區，以及瀏覽器或裝置類型等，並以彙總方式呈現。\n- 網站託管與帳號服務的供應商，為了維運與資安，也可能依其政策在伺服器記錄中留下 IP 位址、時間、瀏覽器等連線資訊。本網站自己的功能資料表並沒有另外儲存你的 IP。\n\n**6. 我們不會為了翻譯而送出你的個人資料**\n\n本網站會把「活動」的公開資料（例如標題、說明、偶像名稱、日期、地點、來源名稱）交給翻譯服務，產生繁體中文的顯示標題、摘要或地點名稱。這份資料不是你的帳號、email、追蹤清單、許願或回報內容。\n\n**7. 我們目前不會蒐集的資料**\n\n我們目前沒有：付款或信用卡資料、行銷電子報訂閱、瀏覽器推播、LINE 或其他即時通訊通知、公開留言板，也沒有使用 Google Analytics 或其他廣告追蹤工具。若日後新增這類功能，我們會先更新本政策。\n\n---\n\n### 三、利用期間、地區、對象與方式\n\n**利用期間**\n\n- 帳號相關資料：在你的帳號存續期間保存。你刪除帳號或請求刪除後，除法令另有規定或為排除爭議所必要而依法保留者外，我們會停止利用並刪除。\n- 未登入的裝置雜湊與相關計數、許願或回報：在該功能仍需防止重複或統計的期間保存。這些資料無法直接對應到你的 email。\n- 登入 cookie：通常在你登出或工作階段結束後失效。\n- 分析資料：依分析服務的保存與彙總方式處理；其用來區分當日訪客的雜湊，依官方說明約 24 小時後即不再使用。\n\n**利用地區**\n\n本網站主要提供給台灣的使用者。為了營運，資料可能在下列地區被處理：\n\n- 台灣（我們營運與聯繫所在地）。\n- 澳洲（資料庫與帳號服務目前所在地）。\n- 網站託管、分析，以及翻譯、Google 登入等服務提供者營運所在的國家或地區。\n\n這些地點可能隨供應商的基礎設施而調整。\n\n**利用對象**\n\n我們不會把你的個人資料賣給任何人，也不會提供給廣告商做行銷名單。可能處理你資料的對象僅限：\n\n- 本網站經營者，以及經我們要求、僅為提供本服務而處理資料的人員。\n- 必要的服務供應商：\n  - Supabase：帳號認證、資料庫與相關必要信件寄送。\n  - Vercel：網站託管與 Web Analytics。\n  - Anthropic：只處理活動資料的自動翻譯，不處理你的帳號資料。\n  - Google：僅在你選擇使用 Google 登入時，依你在 Google 的授權處理登入資料。\n- 依法令、法院或主管機關要求，或為防止詐欺、維護安全所必須提供者。\n\n說明：本網站規劃改以自有網域，並透過專業寄信服務寄送帳號相關信件。在完成設定並更新本政策之前，帳號信件仍由上述帳號服務代為寄送。活動提醒本身不會改成對你寄信，除非我們日後新增功能並再次告知。\n\n**利用方式**\n\n以自動化或非自動化方式，在上述目的範圍內蒐集、處理、儲存、傳輸、顯示與刪除。例如：把你的追蹤清單寫入資料庫、依你的設定寫入站內通知、依你的訂閱連結產出行事曆檔、或依你的請求刪除帳號。\n\n---\n\n### 四、Cookie 與存在你裝置上的資料\n\n**必要的登入 Cookie**\n\n若你登入，本網站會透過帳號服務寫入工作階段 cookie，用來辨識你已登入、保持登入狀態，並保護帳號安全。沒有這類 cookie，登入功能無法運作。你可以在瀏覽器封鎖 cookie，但將無法保持登入。\n\n**存在你瀏覽器中的設定（不是 cookie）**\n\n未登入時，你的追蹤、收藏、提醒、蓋章，以及前述隨機裝置編號，會存在你的瀏覽器（localStorage）。這只留在這臺裝置上。清除網站資料就會一併清除。\n\n**分析**\n\nVercel Web Analytics 依其官方說明不使用 cookie。本網站目前沒有另外設定廣告 cookie 或跨站追蹤 cookie。\n\n---\n\n### 五、行事曆訂閱連結請當成密碼保管\n\n單一偶像的公開行程表可以不用登入訂閱，內容與活動頁相同，不含你的個人資料。\n\n若你登入後產生「訂閱我追蹤的全部行程」連結，這個網址含有專屬於你的秘密代碼。任何取得此連結的人，都可以看到你目前追蹤的偶像行程，但看不到你的 email。請不要把連結公開張貼。若你擔心連結外流，可在網站內重設連結，舊的網址就會失效。刪除帳號後，訂閱連結也會失效。\n\n---\n\n### 六、你的權利\n\n依《個人資料保護法》，你就我們持有的你的個人資料，可以：\n\n1. 查詢或請求閱覽。\n2. 請求製給複製本。\n3. 請求補充或更正。\n4. 請求停止蒐集、處理或利用。\n5. 請求刪除。\n\n請用本政策開頭的聯絡信箱向我們提出，並讓我們能合理確認是你本人。我們可能請你提供必要的說明，以確認身分並找到相關資料。我們會在法令規定的期間內處理；若依法不能接受請求（例如與法定義務衝突，或涉及他人資料），我們會說明原因。\n\n你也可以自行：\n\n- 在「帳號設定」查看或更改 email。\n- 在網站上取消追蹤、收藏、提醒，或重設行事曆訂閱連結。\n- 在「帳號設定」刪除帳號（見下一節）。\n- 若你是用 Google 登入，還可以到 Google 帳戶的安全性或第三方存取設定，撤銷對本網站的授權。刪除本網站帳號，不會自動撤銷 Google 端的授權。\n\n---\n\n### 七、如何刪除帳號，刪了以後還會留下什麼\n\n你可以隨時到「帳號設定」申請刪除帳號。這是不可復原的操作，我們會請你輸入目前的 email 以確認是本人。\n\n刪除帳號後，我們會刪除你的帳號本身，以及綁定此帳號的資料，包括：追蹤的偶像、收藏的活動、個人提醒、站內通知、登入後標記的「我想去」與「去過」蓋章、登入後送出的許願與錯誤回報，以及你的行事曆訂閱連結。\n\n以下資料不會因為刪除帳號而自動消失，請你一併了解：\n\n- 你尚未登入時，用裝置雜湊留下的「我想去」人數、許願或錯誤回報。這些資料對不上你的 email，我們也無法從帳號反查後一併刪除。若你希望盡可能減少裝置上的痕跡，請在該裝置清除本網站的瀏覽器資料。\n- 目前刪除帳號後，不會自動清除你瀏覽器裡尚未同步到帳號的本地追蹤、收藏等資料。你可自行清除瀏覽器的網站資料。\n- 已經寄出的驗證或重設密碼信件，無法從收件匣收回。\n- 公開的活動資訊本身不是你的個人資料，不會因為刪帳號而下架。\n\n---\n\n### 八、未成年人\n\n{{MINORS_POLICY}}\n\n---\n\n### 九、政策更新\n\n若蒐集目的、類別或利用方式有重大變更，我們會更新本政策，並在本頁公布生效日與更新日期。必要時，我們也會在網站內以適當方式提示。建議你偶爾回來查看最新版本。\n\n---\n\n### 十、準據法\n\n本政策之解釋與適用，以及因本政策所生爭議，適用中華民國（臺灣）法律。{{JURISDICTION}}\n\n---\n"
const TERMS_SOURCE = "# 星動時刻服務條款\n\n**生效日：{{EFFECTIVE_DATE}}**\n**最後更新日期：{{LAST_UPDATED}}**\n\n歡迎使用「星動時刻 Idol Rhythm」（{{SITE_URL}}）。請在使用本網站前閱讀本條款。當你使用本網站（含瀏覽公開頁面、註冊或登入），即表示你同意遵守本條款以及《隱私權政策》。若你不同意，請停止使用。\n\n經營者：{{OPERATOR_NAME}}\n聯絡信箱：{{CONTACT_EMAIL}}\n\n---\n\n### 一、本網站提供什麼、不提供什麼\n\n本網站整理 K-pop 偶像與城市活動等公開資訊，方便查閱近期場次、追蹤偶像，並把行程訂閱到你自己的行事曆。\n\n請特別了解：\n\n- 本網站**不是售票平台，也不是活動主辦單位**，不販售門票，不處理退換票，也不能保證你買得到票或能入場。\n- 活動的日期、時間、場地、售票、是否取消或延期，**一律以主辦單位或官方公告為準**。本網站資訊可能有延遲、缺漏、翻譯或整理上的誤差。\n- 我們目前沒有涵蓋所有偶像或所有城市的所有場次。找不到的團或城市，可以使用許願功能告訴我們，但我們不保證一定會補上，也不保證補上的時間。\n\n更完整的說明請見《資料來源與免責》。\n\n---\n\n### 二、帳號\n\n部分功能（例如把追蹤清單存在雲端、訂閱「我追蹤的全部」行事曆、使用站內通知）需要註冊或登入。\n\n你同意：\n\n- 提供正確、可供你接收信件的 email。\n- 妥善保管密碼、Magic Link 信件，以及行事曆訂閱連結。\n- 不把帳號提供給他人使用，也不試圖存取他人帳號。\n- 若發現帳號或訂閱連結可能外流，請儘速重設密碼或重設訂閱連結，並與我們聯繫。\n\n我們可以在合理懷疑帳號被盜用、遭濫用，或違反本條款時，暫停或終止該帳號的使用。你也可以隨時在「帳號設定」刪除自己的帳號。刪除的效果以《隱私權政策》為準。\n\n---\n\n### 三、你可以怎麼使用，以及請不要做的事\n\n在遵守本條款與法令的前提下，你可以為個人、非侵入性的目的使用本網站，例如查場次、追蹤偶像、訂閱行事曆。\n\n你不得：\n\n- 以自動化方式大量索取、干擾或破壞本網站，或規避使用限制。\n- 對「我想去」、許願、錯誤回報等功能進行灌水、重複攻擊或惡意不實回報。\n- 發布違法、侵害他人權利，或含有惡意程式的內容。\n- 未經授權蒐集其他使用者的個人資料。\n- 將本網站的資料大量複製後，偽稱為官方公告或據以從事誤導他人的商業活動。\n- 以任何方式暗示本網站是主辦單位、售票通路，或已為某場活動背書。\n\n---\n\n### 四、智慧財產\n\n- 本網站的名稱、設計、版面與我們自行撰寫的說明文字，其權利歸經營者所有，未經同意請勿作為商業使用。\n- 活動名稱、公告原文、藝人名稱與相關標記、官方或第三方網站的內容，其權利屬於原權利人。本網站僅基於公開資訊進行整理與（必要時）翻譯顯示，並儘量附上來源連結。這不代表原權利人贊助或授權本網站為官方管道。\n- 你在本網站留下的許願名稱或錯誤回報說明，你仍保有你所享有的權利；同時你同意我們為了營運、修正資料與改善服務，可以在必要範圍內使用這些內容。\n\n---\n\n### 五、通知與行事曆\n\n站內通知只顯示在本網站裡，目前不會寄到你的 email，也不會推播到手機系統通知。若你希望在手機行事曆收到提醒，需要自行訂閱 ICS 行程。\n\n訂閱「我追蹤的全部」的連結請依《隱私權政策》妥善保管。單一偶像的公開行程表不含你的個人資料。\n\n---\n\n### 六、免責\n\n在法律允許的最大範圍內：\n\n- 本網站依「現況」提供，我們不保證資料完整、即時、正確，或網站永不中斷、永無錯誤。\n- 因活動資訊錯誤、延遲、售票或入場問題、或你依據本網站資訊所作的行程或購票決定，本網站不負主辦或售票單位應負的責任。請在出發或購票前，自行核對官方或售票頁。\n- 點選來源或售票連結後，你將離開本網站，該網站的內容與其條款由其經營者負責。\n- 對於不可抗力、第三方服務中斷（例如託管、登入或寄信服務），我們會盡力處理，但不保證能立即恢復。\n\n若依法仍須由我們負賠償責任，其範圍{{LIABILITY_SCOPE}}。\n\n---\n\n### 七、條款變更與終止\n\n我們可能因功能調整、法令或營運需要修改本條款，並在本頁公布生效日。若你在變更後繼續使用本網站，視為同意修改後的條款。若你不同意，請停止使用並可刪除帳號。\n\n我們也可能視情況調整、暫停或結束部分或全部服務。若服務結束且涉及你的帳號資料，我們會依《隱私權政策》處理。\n\n---\n\n### 八、準據法與管轄\n\n本條款適用中華民國（臺灣）法律。{{JURISDICTION}}\n\n---\n"
const DISCLAIMER_SOURCE = "# 資料來源與免責\n\n**生效日：{{EFFECTIVE_DATE}}**\n\n星動時刻整理公開可見的偶像活動資訊，方便你查台灣及相關場次。這一頁說明資料從哪裡來、你應該怎麼看待這些資訊。\n\n---\n\n### 一、請以主辦公告為準\n\n活動是否舉辦、何時何地、如何售票或入場，以及是否取消、延期或改場地，**一律以主辦單位、官方或售票通路當時的公告為準**。\n\n本網站不是主辦單位，也不是售票網站。我們提供的日期、時間、場地、分類與中文說明，是整理與翻譯後的參考資訊，可能有時間差或誤差。出發或購票前，請點活動頁的來源連結，自行核對最新公告。\n\n---\n\n### 二、資料從哪裡來\n\n我們主要整理下列類型的公開資訊，並在活動頁標示來源（若有）：\n\n- 經紀公司或藝人官方網站上，公開可讀的行程或公告。\n- 場館公開行事曆（例如高雄巨蛋行事曆）。\n- 其他公開的活動整理資料。若來源不是官方，活動上會標示為「非官方整理」。這類資料特別建議再對一次官方或售票頁。\n\n我們沒有、也不會把本網站當成下列平台的替代品：各售票網站的購票流程、需要登入才能看的粉絲平台，或未公開的內部資料。點來源或售票連結後，你會離開本網站。\n\n收錄範圍會隨時間調整，也可能有尚未收錄的偶像、城市或場次。這不代表該活動不存在，只代表本網站尚未整理到。\n\n---\n\n### 三、翻譯與顯示\n\n部分活動的原文是韓文、英文或其他語文。本網站可能使用自動翻譯，產生繁體中文的標題、摘要或地點名稱，方便閱讀。機器翻譯可能不完整或不準確，正式名稱仍請以來源頁為準。\n\n部分來源我們只整理活動名稱、日期、地點與來源連結，而不轉載公告全文。\n\n---\n\n### 四、更新頻率與錯誤回報\n\n我們會定期自動整理來源，並在活動頁顯示來源與最後更新時間（若有）。自動整理不能保證與官方同步到「同一分鐘」。\n\n若你發現日期、時間、場地、售票或來源有誤，或活動已取消、延期，歡迎使用活動頁的「回報錯誤」。我們會用來檢查與修正，但不保證處理時限，也不代表我們能代替主辦單位發布聲明。\n\n---\n\n### 五、圖片與名稱\n\n活動或偶像相關的名稱、標誌與圖片，其權利屬於原權利人。本網站的使用不代表我們與該經紀公司、主辦或售票單位存在合作或授權代言關係。\n\n---\n\n### 六、相關頁面\n\n- [隱私權政策](/privacy)\n- [服務條款](/terms)\n\n如需聯繫：{{CONTACT_EMAIL}}\n\n---\n"


function fillMarkdown(source: string, siteUrl: string): string {
  const values: Record<string, string> = {
    ...LEGAL_FIELD_VALUES,
    SITE_URL: siteUrl,
  }
  const filled = source.replace(/\{\{([A-Z_]+)\}\}/g, (match, key: string) => {
    if (!(key in values)) return match
    return values[key]
  })
  // Hide the optional "other contact" list item once Dave clears it.
  return filled.replace(/^- 其他聯絡方式：\s*$/m, '')
}

export function getLegalSiteUrl(): string {
  return getSiteUrl()
}

export function getPrivacyDocument(siteUrl: string = getSiteUrl()): LegalDoc {
  return {
    path: '/privacy',
    title: '隱私權政策',
    heading: '星動時刻隱私權政策',
    description: '說明星動時刻如何蒐集、使用與刪除個人資料，以及你依台灣個人資料保護法可行使的權利。',
    markdown: fillMarkdown(PRIVACY_SOURCE, siteUrl),
  }
}

export function getTermsDocument(siteUrl: string = getSiteUrl()): LegalDoc {
  return {
    path: '/terms',
    title: '服務條款',
    heading: '星動時刻服務條款',
    description: '星動時刻的使用規則，包含帳號、禁止事項，以及活動資料以主辦公告為準的說明。',
    markdown: fillMarkdown(TERMS_SOURCE, siteUrl),
  }
}

export function getDisclaimerDocument(siteUrl: string = getSiteUrl()): LegalDoc {
  return {
    path: '/disclaimer',
    title: '資料來源與免責',
    heading: '資料來源與免責',
    description: '說明星動時刻的活動資料來源、以主辦公告為準，以及翻譯與錯誤回報方式。',
    markdown: fillMarkdown(DISCLAIMER_SOURCE, siteUrl),
  }
}

export function getLegalDocument(path: LegalPath, siteUrl: string = getSiteUrl()): LegalDoc {
  if (path === '/privacy') return getPrivacyDocument(siteUrl)
  if (path === '/terms') return getTermsDocument(siteUrl)
  return getDisclaimerDocument(siteUrl)
}

export function getAllLegalDocuments(siteUrl: string = getSiteUrl()): LegalDoc[] {
  return LEGAL_PAGE_PATHS.map((path) => getLegalDocument(path, siteUrl))
}
