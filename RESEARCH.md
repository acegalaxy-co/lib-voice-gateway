# lib-voice-gateway research — nguồn, phát hiện, hướng cải tiến

Snapshot 2026-09-24. Cách research: đọc lại git log đầy đủ của repo
`lib-voice-gateway` (12 commit, từ `chore: initial commit — split from
framework monorepo`), README/CHANGELOG/CLAUDE.md tại root, code gốc
(`identity/`, `authz/`, `rate-limit/`, `adapters/`, `sources/`, `index.ts`),
consumer thật `voice-stt.ts` trong Nexus, và 2 lượt web search prior-art (STT
API pricing + LLM gateway pattern). Các fact dưới là snapshot tại thời điểm
research — code/pricing/library ecosystem có thể đổi sau.

## Nguồn research

**Nội bộ:**
- Repo GH gốc `acegalaxy-co/ace_commons-voice-gateway-nodejs` (nay
  `lib-voice-gateway`), commit đầu `e236142` "chore: initial commit — split
  from framework monorepo", tag gần nhất chuẩn bị `v0.2.0`.
- File cấu trúc chính: `index.ts` (orchestrator L1-L4), `identity/resolver.ts`,
  `authz/engine.ts`, `rate-limit/limiter.ts`, `audit/logger.ts` (bị xoá khỏi
  repo cũ, thay bằng `@acegalaxy/lib-security-utils/audit-log` — xem dưới),
  `adapters/whisper.ts`, `sources/telegram.ts`, `queue/in-memory.ts`.
- Consumer duy nhất trong Nexus:
  `Nexus: src/app/llm/voice-stt.ts`
  — thin wrapper require `@acegalaxy/voice-gateway` (tên cũ, chưa cập nhật
  sang `lib-voice-gateway` tại thời điểm research), bind `VOICE_GW_*` env
  sang naming `NEXUS_*`, gate `VOICE_STT_ENABLED` opt-in mặc định tắt.
  `package.json` Nexus vẫn khai `"@acegalaxy/voice-gateway": "^0.1.2"` — chưa
  bump theo rename (nằm trong sweep consumer riêng, ngoài scope RESEARCH.md
  này).
- Sibling lib đã tách trước: `lib-security-utils` (README tại
  `lib-security-utils/README.md`)
  — cung cấp `createAuditLogger`, `createCallerValidator`,
  `createSlidingWindow`, `createReplayGuard` dùng chung cho mọi gateway họ
  ACE Galaxy (voice-gateway, db-gateway, ott-gateway).

**Ngoài (URL đã verify qua WebSearch, không bịa):**
- futureagi.substack.com — "Speech-to-Text APIs in 2026: Benchmarks,
  Pricing, and a Developer's Decision Guide" (so sánh Whisper/Deepgram/Google).
- diyai.io — "OpenAI Whisper API Pricing 2026: $0.006/Min, $0.36/Hour".
- truefoundry.com — "Rate Limiting in AI Gateway: The Ultimate Guide".
- apisix.apache.org — trang "AI Gateway" của Apache APISIX (open-source
  gateway pattern: rate limit + token control + allow/deny plugin).

## Đã tham khảo gì

### Bài toán gốc trong Nexus (vì sao tách lib)

Nexus có bot Telegram nhận voice message, cần chuyển thành text qua OpenAI
Whisper. Gọi thẳng Whisper từ handler bot là rủi ro kép: (1) không có trần
chi tiêu — một loop lỗi hoặc user spam voice message có thể đốt ngân sách
OpenAI trong vài phút; (2) không có audit — không biết ai gọi bao nhiêu,
lúc nào. README nêu thẳng lý do: "one runaway loop away from a $200 OpenAI
bill". `voice-stt.ts` phía Nexus xác nhận pattern thin-wrapper: mọi logic
an toàn (cost cap, rate limit, audit, default-deny) sống trong gateway, side
Nexus chỉ bind env naming và giữ nguyên API cho `telegram-bot.js` không phải
sửa call site khi gateway đổi nội bộ.

### Ý tưởng thiết kế chính — 5 layer (6 nếu tính Queue riêng)

`index.ts::transcribe()` chạy tuần tự và **không bao giờ throw** — luôn trả
`{ outcome: 'ok'|'denied'|'error', denyReason, ... }` để bot không crash:

1. **L2 Identity** (`identity/resolver.ts`) — `resolveCaller()` default-deny:
   thiếu `service`/`scope` → `null` → từ chối ngay. Dùng lại
   `createCallerValidator` từ `lib-security-utils`, không tự viết.
2. **L3 Authz** (`authz/engine.ts`) — allowlist tĩnh 2 tập (`ALLOWED_SOURCES`,
   `ALLOWED_PROVIDERS`); comment ghi rõ "Phase 2: per-service policy YAML"
   là hướng mở rộng chưa làm — mọi caller hợp lệ được allow như nhau.
3. **L4 Rate limit + cost cap** (`rate-limit/limiter.ts`) — QPS theo sliding
   window (`createSlidingWindow` từ `lib-security-utils`, mặc định 30
   req/phút) cộng cost-cap USD/ngày track riêng trong `_costToday` Map
   (extra-check chạy sau QPS check, không tái dùng sliding-window cho cost).
4. **L1 Source/Adapter resolve** — lazy-load theo `Map` cache
   (`_getAdapter`/`_getSource`), chỉ hỗ trợ `telegram` source +
   `whisper` provider dù `types.ts` khai union rộng hơn (`whatsapp`,
   `wechat`, `http`, `gemini`, `local` — type placeholder cho tương lai).
5. **Queue** (`queue/in-memory.ts`) — bounded concurrency, `QUEUE_FULL` map
   sang `L4_rate_limit` deny reason (không có deny reason riêng cho full
   queue).
6. **Audit** (`audit/logger.ts`, proxy sang `lib-security-utils/audit-log`)
   — append-only JSONL, ghi kể cả nhánh lỗi (`_finalize()` luôn gọi
   `audit.record()`, swallow lỗi ghi log để audit không hỏng luồng chính).

Design này lặp lại nguyên khối 5-layer default-deny đã dùng cho
`db-gateway`/`ott-gateway` (cùng tác giả, cùng thời điểm tách — xem README
mục "Related"), chỉ thay tầng adapter cuối (Whisper thay vì DB
driver/messaging provider). `lib-security-utils` là phần dùng chung thật sự
(không copy-paste) — đúng lý do rename lần này gộp dep sang git-dep private
thay vì để mỗi gateway tự triển khai lại rate-limit/audit.

### Prior art & vì sao tự viết

Tra web 2 lượt (pricing STT + pattern gateway LLM open-source):

- **Giá STT 2026**: Whisper API $0.006/phút (batch only, không streaming),
  Deepgram Nova-3 rẻ hơn (khoảng $0.0043-0.0218/phút tuỳ mode), Google Cloud
  STT đắt hơn nhiều (khoảng $16/1000 phút chuẩn). Whisper vẫn là lựa chọn
  mặc định hợp lý cho use-case Telegram voice message tiếng Việt, không cần
  streaming — khớp với việc adapter hiện tại chỉ có `whisper.ts`.
- **Gateway pattern có sẵn**: LiteLLM (unified OpenAI-compatible interface,
  100+ provider), Apache APISIX AI Gateway (rate limit + token control +
  allow/deny plugin), Bifrost (control-plane Go). Các lib này nhắm multi-LLM
  routing/failover ở quy mô lớn, cấu hình qua config file/plugin, chạy như
  service riêng (proxy) — nặng hơn nhiều so với nhu cầu thật: 1 provider
  (Whisper), 1 nguồn (Telegram voice), chạy in-process trong bot Node.js
  hiện có. Không có lib nào trong nhóm này ưu tiên "cost cap USD cứng theo
  service + audit JSONL local" như một primitive hạng nhất — họ thiên về
  token-based rate limit đa provider.
- **Kết luận tự viết**: bài toán đủ hẹp (1 provider, 1 nguồn, chạy in-process
  cạnh bot có sẵn) để 1 file `index.ts` orchestrator + vài module nhỏ đủ
  dùng, tái sử dụng `lib-security-utils` cho phần hạ tầng chung (audit,
  rate-limit, caller-validator) thay vì kéo cả 1 gateway service ngoài
  (APISIX/LiteLLM) vào một stack vốn đã chạy Node.js thuần trong container.

## Hướng cải tiến

**Đã áp dụng:**
- Rename `@acegalaxy/voice-gateway` → `@acegalaxy/lib-voice-gateway`,
  version `0.2.0` (2026-09-24), `package.json` set `"private": true`, xoá
  `publishConfig`/`prepublishOnly` — chuẩn bị chuyển repo GitHub từ public
  sang private theo chủ trương chung "ALL @acegalaxy libs get lib- prefix +
  private git-dep" (xem `CHANGELOG.md` mục `[0.2.0]`).
  `@acegalaxy/security-utils` dep chuyển sang
  `@acegalaxy/lib-security-utils` (`github:acegalaxy-co/lib-security-utils#v0.3.0`),
  không còn npm registry — git-dep trực tiếp tới repo private.
- Trước đó (0.1.0 → pre-0.2.0, còn trong git log): thêm `VOICE_STT_DAILY_USD_CAP`
  làm alias env consumer-facing cho cost cap (giữ backward-compat với
  `VOICE_GW_DAILY_COST_USD` cũ), sửa `index.ts` destructure `resolveCaller`
  đúng shape export của `identity/resolver`, build pipeline `tsc` + `dist/`
  cho npm publish (nay không còn cần publish nhưng build step vẫn giữ vì
  `main`/`exports` trỏ `dist/`).

**Deferred / chưa implement:**
- `smoke.test.js` ở root `require("./index")` — trỏ thẳng file TypeScript
  nguồn, không phải `dist/index.js` đã build → `node smoke.test.js` sẽ fail
  (Node không tự transpile `.ts`). Test thật chạy qua npm là
  `test/*.test.js` (dùng `dist/index.js`, có `pretest: npm run build`) —
  file root là tàn dư trước khi tách thư mục `test/` riêng, cần xoá/sửa.
- Test coverage mỏng: `test/` chỉ có 1 smoke-test kiểm tra `transcribe` là
  function tồn tại (không assert behavior L1-L4). Bộ test hành vi thật (7
  case L2/L3/L4/queue) chỉ nằm ở `smoke.test.js` gốc đang broken nêu trên —
  hiện không có test nào verify default-deny/rate-limit/cost-cap qua CI xanh.
- `authz/engine.ts` còn nguyên comment "Phase 2: per-service policy YAML" —
  chưa phân biệt caller theo `service`, L3 hiện chỉ chặn theo tên
  nguồn/provider chứ chưa thật sự theo caller.
- `types.ts` khai union rộng (`whatsapp`, `wechat`, `http`, provider
  `gemini`, `local`) nhưng `_getSource`/`_getAdapter` chỉ có case
  `telegram`/`whisper` — nhánh còn lại luôn rơi vào `L1_source`/`L1_adapter`
  deny, type surface hứa hẹn nhưng chưa implement thật.
- `.github/workflows/` cũ còn nhắm publish npm — cần dọn cho khớp mô hình
  git-dep private mới (ngoài scope RESEARCH.md này, để bước commit riêng).
