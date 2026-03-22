# WeChat Channel for Claude Code

Connect your WeChat account to Claude Code via an MCP server.

When your WeChat receives a message, the MCP server forwards it to Claude and provides tools to reply, send files, and fetch message history.

## How it works

This plugin uses the WeChat ilink API (the same API used by the official Tencent OpenClaw WeChat plugin) to:

1. **Login** via QR code scan — authenticates your WeChat account
2. **Long-poll** for incoming messages — no public server needed
3. **Send replies** back through WeChat — text, images, and files

The architecture mirrors the official Discord channel plugin:

```
WeChat ilink API ←→ cc-wechat-plugin (MCP server) ←→ Claude Code
```

## Prerequisites

- [Bun](https://bun.sh) — the MCP server runs on Bun. Install with `curl -fsSL https://bun.sh/install | bash`.

## Quick Setup

**1. Clone and install.**

```bash
git clone git@github.com:mixybkig666/cc-wechat-plugin.git
cd cc-wechat-plugin
bun install
```

**2. Log in with WeChat.**

Start a Claude Code session and run:

```
/wechat:configure login
```

This calls the WeChat ilink API to generate a QR code. Scan it with your WeChat app to authenticate. The bot token is saved to `~/.claude/channels/wechat/account.json`.

**3. Launch with the channel flag.**

```bash
claude --channels plugin:wechat@/path/to/cc-wechat-plugin
```

**4. Send a WeChat message.**

Message your WeChat account — the message arrives in your Claude Code session. Claude replies through the `reply` tool.

**5. (Optional) Lock down access.**

By default, anyone who messages you will reach Claude. To restrict:

```
/wechat:access allow <userId@im.wechat>
/wechat:access policy allowlist
```

## Tools exposed to the assistant

| Tool | Purpose |
| --- | --- |
| `reply` | Send to a WeChat user. Takes `chat_id` + `text`, optionally `files` (absolute paths) for image/file attachments. Markdown is auto-stripped for WeChat. |
| `fetch_messages` | Cached recent messages (oldest-first). Optional `chat_id` filter and `limit`. Each line includes message ID for reference. |
| `download_attachment` | Download media (image/video/file/voice) from a message by ID to `~/.claude/channels/wechat/inbox/`. Returns file paths. |

## State files

| File | Purpose |
| --- | --- |
| `~/.claude/channels/wechat/account.json` | Bot token and login credentials (read at boot) |
| `~/.claude/channels/wechat/access.json` | Access control policy (re-read per message) |
| `~/.claude/channels/wechat/sync_buf.dat` | Long-poll checkpoint (survives restarts) |
| `~/.claude/channels/wechat/inbox/` | Downloaded media files |

## Skills

| Skill | Purpose |
| --- | --- |
| `/wechat:configure` | Login (QR code), check status, logout |
| `/wechat:access` | Manage allowlist and DM policy |

## Differences from the Tencent OpenClaw plugin

| | This plugin | Tencent plugin |
| --- | --- | --- |
| Architecture | Claude Code MCP plugin (direct) | OpenClaw gateway plugin (indirect) |
| Dependencies | Bun + MCP SDK only | Node 22 + OpenClaw runtime |
| Setup | `git clone` + scan QR | Install OpenClaw + plugin + scan QR |
| Integration | Native Claude Code channels | Requires OpenClaw gateway process |

## Credits

- WeChat API protocol derived from `@tencent-weixin/openclaw-weixin` (MIT, Tencent Inc.)
- Plugin structure modelled after the official Claude Code Discord channel plugin
