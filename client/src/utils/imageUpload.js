/** Compress image file to JPEG data URL for upload (max edge ~1000px). */
export function fileToCompressedDataUrl(file, { maxEdge = 1000, quality = 0.72 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file selected'))
      return
    }
    if (!String(file.type || '').startsWith('image/')) {
      reject(new Error('Please select an image file'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read image'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Invalid image file'))
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
        const width = Math.max(1, Math.round(img.width * scale))
        const height = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = String(reader.result || '')
    }
    reader.readAsDataURL(file)
  })
}
