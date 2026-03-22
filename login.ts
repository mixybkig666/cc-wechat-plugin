#!/usr/bin/env bun
/**
 * Standalone WeChat QR login script.
 * Run: bun login.ts
 * Scans QR → saves token → done. Then start Claude Code with --channels flag.
 */

import { mkdirSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const STATE_DIR = join(homedir(), '.claude', 'channels', 'wechat')
const ACCOUNT_FILE = join(STATE_DIR, 'account.json')
const BASE_URL = 'https://ilinkai.weixin.qq.com'
const BOT_TYPE = '3'

async function main() {
  console.log('🔗 正在获取微信登录二维码...\n')

  // 1. Get QR code
  const qrRes = await fetch(`${BASE_URL}/ilink/bot/get_bot_qrcode?bot_type=${BOT_TYPE}`)
  if (!qrRes.ok) {
    console.error(`❌ 获取二维码失败: ${qrRes.status}`)
    process.exit(1)
  }
  const qrData = await qrRes.json() as { qrcode: string; qrcode_img_content: string }

  // 2. Display QR code
  console.log('📱 请用微信扫描以下二维码:\n')
  try {
    const qrterm = await import('qrcode-terminal')
    qrterm.default.generate(qrData.qrcode_img_content, { small: true }, (qr: string) => {
      console.log(qr)
    })
  } catch {
    console.log(`二维码链接: ${qrData.qrcode_img_content}`)
    console.log('(安装 qrcode-terminal 可在终端直接显示二维码)\n')
  }

  console.log('\n⏳ 等待扫码...\n')

  // 3. Poll for status
  const deadline = Date.now() + 5 * 60 * 1000 // 5 min timeout
  let qrcode = qrData.qrcode
  let scannedPrinted = false

  while (Date.now() < deadline) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 35000)

      const statusRes = await fetch(
        `${BASE_URL}/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcode)}`,
        { headers: { 'iLink-App-ClientVersion': '1' }, signal: controller.signal },
      )
      clearTimeout(timer)

      if (!statusRes.ok) {
        await sleep(2000)
        continue
      }

      const status = await statusRes.json() as {
        status: string
        bot_token?: string
        ilink_bot_id?: string
        baseurl?: string
        ilink_user_id?: string
      }

      switch (status.status) {
        case 'wait':
          break

        case 'scaned':
          if (!scannedPrinted) {
            console.log('👀 已扫码，请在微信上确认...')
            scannedPrinted = true
          }
          break

        case 'expired':
          console.log('\n⏳ 二维码已过期，正在刷新...')
          const newQr = await fetch(`${BASE_URL}/ilink/bot/get_bot_qrcode?bot_type=${BOT_TYPE}`)
          if (newQr.ok) {
            const newData = await newQr.json() as { qrcode: string; qrcode_img_content: string }
            qrcode = newData.qrcode
            scannedPrinted = false
            try {
              const qrterm = await import('qrcode-terminal')
              qrterm.default.generate(newData.qrcode_img_content, { small: true }, (qr: string) => {
                console.log(qr)
              })
            } catch {
              console.log(`新二维码链接: ${newData.qrcode_img_content}`)
            }
            console.log('\n⏳ 等待扫码...\n')
          }
          break

        case 'confirmed':
          if (!status.bot_token || !status.ilink_bot_id) {
            console.error('❌ 登录失败：服务器未返回必要信息')
            process.exit(1)
          }

          // Save account
          mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 })
          const accountData = {
            token: status.bot_token,
            baseUrl: status.baseurl || BASE_URL,
            userId: status.ilink_user_id,
            savedAt: new Date().toISOString(),
          }
          writeFileSync(ACCOUNT_FILE, JSON.stringify(accountData, null, 2), { mode: 0o600 })

          console.log('\n✅ 微信登录成功！')
          console.log(`   账号 ID: ${status.ilink_bot_id}`)
          console.log(`   凭证已保存到: ${ACCOUNT_FILE}`)
          console.log('')
          console.log('现在可以启动 Claude Code：')
          console.log(`   claude --channels plugin:wechat@${process.cwd()}`)
          process.exit(0)
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') continue
      // retry on network error
    }

    await sleep(1000)
  }

  console.error('❌ 登录超时，请重试')
  process.exit(1)
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

main().catch(err => {
  console.error(`❌ ${err}`)
  process.exit(1)
})
