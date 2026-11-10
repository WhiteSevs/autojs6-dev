/**
 * UI 模式入口 (npm run dev:ui / npm run build:ui).
 *
 * 注意:
 * - 产物首行的 `"ui";` 指令由 autojs6-dev 插件写入, 源码里不要手写;
 * - `ui` 是 AutoJs6 的全局对象, 直接使用即可.
 */
ui.layoutFile('res/layout/main.xml')

// 声明文件里 ui.findView() 返回的是 android.view.View, 常用的 setText / on
// 没有体现, 这里做一次断言收口.
interface TextViewLike {
  setText(text: string): void
}

interface ViewLike {
  on(event: string, listener: () => void): void
}

const title = ui.findView('title') as unknown as TextViewLike

const meta = ui.findView('meta') as unknown as TextViewLike
meta.setText(`${device.brand} ${device.model} · Android ${device.release}`)

const button = ui.findView('btnClose') as unknown as ViewLike
button.on('click', () => {
  toast('已退出')
  exit()
})
