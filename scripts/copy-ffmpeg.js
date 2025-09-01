const fs = require('fs')
const path = require('path')

// Copy FFmpeg core files from node_modules to public directory
const sourceDir = path.join(__dirname, '../node_modules/@ffmpeg/core-mt/dist/umd')
const targetDir = path.join(__dirname, '../public/ffmpeg')

// Ensure target directory exists
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true })
}

// Files to copy
const filesToCopy = [
  'ffmpeg-core.js',
  'ffmpeg-core.wasm'
]

filesToCopy.forEach(file => {
  const sourcePath = path.join(sourceDir, file)
  const targetPath = path.join(targetDir, file)
  
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, targetPath)
    console.log(`Copied ${file} to public/ffmpeg/`)
  } else {
    console.error(`Source file not found: ${sourcePath}`)
  }
})

console.log('FFmpeg core files copied successfully!')
