---
name: configure
description: Set up the WeChat channel — scan QR code to log in, check status. Use when the user asks to configure WeChat, wants to log in, check status, or says "how do I set up WeChat".
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Bash(ls *)
  - Bash(mkdir *)
  - Bash(curl *)
  - Bash(bun *)
---

# /wechat:configure — WeChat Channel Setup

Manages the WeChat login for Claude Code. The server connects to WeChat via
QR code scanning through the ilink API.

Arguments passed: `$ARGUMENTS`

---

## Dispatch on arguments

### No args — status and guidance

Read both state files and give the user a complete picture:

1. **Account** — check `~/.claude/channels/wechat/account.json`.
   Show: logged-in/not-logged-in. If logged in, show the baseUrl.

2. **Access** — read `~/.claude/channels/wechat/access.json` (missing file
   = defaults: `dmPolicy: "open"`, empty allowlist). Show:
   - DM policy and what it means in one line
   - Allowed senders: count, and list IDs if any

3. **What next** — based on state:
   - Not logged in → *"Run `/wechat:configure login` to scan QR code and
     connect your WeChat."*
   - Logged in, policy open → *"Ready. Anyone who messages your WeChat
     account will reach the assistant. Consider locking down with
     `/wechat:access policy allowlist`."*
   - Logged in, allowlist set → *"Ready. Only allowed users can reach the
     assistant."*

### `login` — QR code login

1. Call the WeChat ilink API to get a QR code:
   ```bash
   curl -s 'https://ilinkai.weixin.qq.com/ilink/bot/get_bot_qrcode?bot_type=3'
   ```
2. Parse the JSON response. Extract `qrcode` and `qrcode_img_content`.
3. Display the QR code URL to the user: tell them to open it in a browser
   or scan with WeChat.
4. Poll for login status:
   ```bash
   curl -s -H 'iLink-App-ClientVersion: 1' \
     'https://ilinkai.weixin.qq.com/ilink/bot/get_qrcode_status?qrcode=<qrcode>'
   ```
5. When status is `"confirmed"`, extract `bot_token`, `ilink_bot_id`,
   and `baseurl` from the response.
6. Save to `~/.claude/channels/wechat/account.json`:
   ```json
   {
     "token": "<bot_token>",
     "baseUrl": "<baseurl or https://ilinkai.weixin.qq.com>",
     "userId": "<ilink_user_id>",
     "savedAt": "<ISO timestamp>"
   }
   ```
7. If dmPolicy is "allowlist" and the scanned user's ID is available,
   automatically add it to the allowFrom list.
8. Confirm success. Tell user to restart their Claude session with:
   ```
   claude --channels plugin:wechat@cc-wechat-plugin
   ```

### `logout` — remove credentials

Delete `~/.claude/channels/wechat/account.json`. Confirm.

---

## Implementation notes

- The channels dir might not exist yet. Missing file = not configured, not an error.
- The server reads account.json once at boot. Token changes need a session restart.
- access.json is re-read on every inbound message — policy changes take effect immediately.
- QR code login has a ~5 minute timeout. Poll every 2-3 seconds.
- If polling returns `"expired"`, tell the user to run login again.
