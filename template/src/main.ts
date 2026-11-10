/**
 * 入口脚本.
 *
 * `device` / `app` / `ocr` / `images` / `toast` ... 都是 AutoJs6 的全局对象,
 * 直接用即可, 不需要 import; 类型提示来自 @sm003/autojs6-dts.
 */
async function main(): Promise<void> {
  log(`${device.brand} ${device.model}`)
  log(`Android ${device.release} (API ${device.sdkInt})`)
  log(`屏幕 ${device.width} x ${device.height} @ ${device.density}dpi`)
  toast(`${device.model} · AutoJs6 已就绪`)
  // 文字识别: 需要「屏幕截图」权限 + 已安装 OCR 插件
  try {
    const lines = ocr.recognizeText() // string[]
    log(`识别到 ${lines.length} 行`)
    log(lines.slice(0, 5).join('\n'))
  } catch (error) {
    log('OCR 不可用: 请在 AutoJs6 中授予截图权限, 并安装 OCR 插件')
    log(error)
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, 1000)
  })
  log('完成')
}

main().catch((error: unknown) => {
  console.error(error)
})
