import { connectWebTools } from './sdk/index.mjs'
const connection = connectWebTools()
const $ = id => document.getElementById(id)
let browserId, inputPath, conversion
const messages = { USER_CANCELLED: '请先召回插件，再点击此按钮执行', PERMISSION_DENIED: '请在插件管理中授予对应能力，并重新打开插件', TIMEOUT: '操作超时，已停止；可重试较小的文件或重新打开网页', INVALID_REQUEST: '输入文件、格式或参数无效', RUNTIME_CLOSED: '浏览器已关闭，请重新运行示例', CANCELLED: '转换已取消', INTERNAL_ERROR: '处理失败，请检查文件是否受支持；网页操作请重新运行示例' }
function report(id, error) { $(id).textContent = messages[error.code] ?? `${error.message ?? String(error)} (${error.code ?? 'PLUGIN_ERROR'})` }
$('workflow-browser').onclick = async () => {
  $('workflow-browser').disabled = true
  try {
    await connection.ready
    if (browserId) await connection.system.browser.close(browserId)
    const url = await window.workflowDemo.start()
    $('workflow-browser-status').textContent = '正在运行网页操作…'
    browserId = (await connection.system.browser.open(url)).id
    await connection.system.browser.step({ id: browserId, action: 'input', selector: '#note', value: $('workflow-text').value })
    await connection.system.browser.step({ id: browserId, action: 'click', selector: '#apply' })
    const text = await connection.system.browser.step({ id: browserId, action: 'text', selector: '#result' })
    $('workflow-browser-status').textContent = text
    $('workflow-browser-image').src = await connection.system.browser.step({ id: browserId, action: 'screenshot' })
    $('workflow-browser-image').hidden = false
  } catch (error) { report('workflow-browser-status', error) }
  finally { $('workflow-browser').disabled = false }
}
$('workflow-close').onclick = async () => {
  try { if (browserId) await connection.system.browser.close(browserId); browserId = null; $('workflow-browser-status').textContent = '浏览器已关闭' }
  catch (error) { report('workflow-browser-status', error) }
}
$('workflow-image-run').onclick = async () => {
  try {
    const file = $('workflow-image-file').files[0]
    if (!file) throw Error('请先选择图片')
    if (file.size > 8 * 1024 * 1024) throw Error('示例支持最多 8 MiB 的图片')
    const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file) })
    const format = $('workflow-image-format').value
    const result = await connection.system.image.transform({ dataUrl, width: Number($('workflow-image-width').value), format })
    $('workflow-image-result').src = result.dataUrl; $('workflow-image-result').hidden = false
    const download = $('workflow-image-download'); download.href = result.dataUrl; download.download = 'converted.' + format; download.hidden = false
    $('workflow-image-status').textContent = `${result.width} × ${result.height}，${result.bytes} 字节，${format.toUpperCase()}`
  } catch (error) { report('workflow-image-status', error) }
}
$('workflow-media-select').onclick = async () => {
  try { const paths = await connection.files.select({ kind: 'file', multiple: false }); if (paths[0]) { inputPath = paths[0]; $('workflow-media-path').textContent = inputPath } }
  catch (error) { report('workflow-media-status', error) }
}
$('workflow-media-sample').onclick = async () => {
  try { inputPath = await window.workflowDemo.sampleAudio(); $('workflow-media-path').textContent = inputPath }
  catch (error) { report('workflow-media-status', error) }
}
$('workflow-media-run').onclick = async () => {
  if (conversion) return
  try {
    if (!inputPath) throw Error('请先选择音视频或生成示例 WAV')
    conversion = new AbortController(); $('workflow-media-run').disabled = true; $('workflow-media-cancel').disabled = false
    $('workflow-media-status').textContent = '请选择保存位置，随后开始转换…'
    const result = await connection.system.media.transcode({ inputPath, format: $('workflow-media-format').value }, { signal: conversion.signal })
    $('workflow-media-status').textContent = result ? '转换完成：' + result.path : '已取消选择保存位置'
  } catch (error) { report('workflow-media-status', error) }
  finally { conversion = null; $('workflow-media-run').disabled = false; $('workflow-media-cancel').disabled = true }
}
$('workflow-media-cancel').onclick = () => conversion?.abort()
