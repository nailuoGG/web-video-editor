import { getFFmpeg } from './ffmpeg'
import { ConversionOptions, ConversionResult, ConversionConfig } from '@/types/video'

// Default conversion configurations
const DEFAULT_CONFIG: ConversionConfig = {
  video: {
    format: 'mp4',
    resolution: 'original',
    quality: 'medium',
    codec: 'h264'
  },
  audio: {
    format: 'mp3',
    bitrate: '256k',
    sampleRate: 44100
  },
  image: {
    format: 'jpeg',
    quality: 85
  }
}

/**
 * Detect file type based on MIME type and extension
 */
function detectFileType(file: File | Blob): 'video' | 'audio' | 'image' | 'unknown' {
  let mimeType = ''
  
  if (file instanceof File) {
    mimeType = file.type
    // Also check file extension as fallback
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!mimeType && extension) {
      const videoExts = ['mp4', 'webm', 'avi', 'mov', 'mkv', 'flv']
      const audioExts = ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a']
      const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']
      
      if (videoExts.includes(extension)) return 'video'
      if (audioExts.includes(extension)) return 'audio'
      if (imageExts.includes(extension)) return 'image'
    }
  } else {
    mimeType = file.type
  }
  
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType.startsWith('image/')) return 'image'
  
  return 'unknown'
}

/**
 * Generate output filename based on input and target format
 */
function generateOutputFilename(inputFile: File | Blob, targetFormat: string): string {
  const originalName = inputFile instanceof File ? inputFile.name : 'converted_file'
  const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '')
  return `${nameWithoutExt}.${targetFormat}`
}

/**
 * Build FFmpeg command based on file type and configuration
 */
function buildConversionCommand(
  fileType: string,
  config: ConversionConfig,
  targetFormat?: string
): string[] {
  const command = ['-i', 'input']
  
  switch (fileType) {
    case 'video':
      const videoConfig = config.video
      const format = targetFormat || videoConfig.format
      
      // Video codec
      if (videoConfig.codec === 'h265') {
        command.push('-c:v', 'libx265')
      } else if (videoConfig.codec === 'vp9') {
        command.push('-c:v', 'libvpx-vp9')
      } else {
        command.push('-c:v', 'libx264')
      }
      
      // Audio codec
      command.push('-c:a', 'aac')
      
      // Resolution
      if (videoConfig.resolution && videoConfig.resolution !== 'original') {
        const resolutionMap = {
          '720p': '1280:720',
          '1080p': '1920:1080',
          '4k': '3840:2160'
        }
        command.push('-s', resolutionMap[videoConfig.resolution])
      }
      
      // Quality
      const qualityMap = {
        'low': '28',
        'medium': '23',
        'high': '18'
      }
      command.push('-crf', qualityMap[videoConfig.quality || 'medium'])
      
      // Format-specific options
      if (format === 'mp4') {
        command.push('-movflags', 'faststart', '-pix_fmt', 'yuv420p')
      }
      
      break
      
    case 'audio':
      const audioConfig = config.audio
      const audioFormat = targetFormat || audioConfig.format
      
      if (audioFormat === 'mp3') {
        command.push('-c:a', 'libmp3lame')
      } else if (audioFormat === 'aac') {
        command.push('-c:a', 'aac')
      } else if (audioFormat === 'ogg') {
        command.push('-c:a', 'libvorbis')
      } else {
        command.push('-c:a', 'pcm_s16le') // WAV
      }
      
      // Bitrate
      if (audioConfig.bitrate) {
        command.push('-b:a', audioConfig.bitrate)
      }
      
      // Sample rate
      if (audioConfig.sampleRate) {
        command.push('-ar', audioConfig.sampleRate.toString())
      }
      
      break
      
    case 'image':
      const imageConfig = config.image
      const imageFormat = targetFormat || imageConfig.format
      
      // Quality for JPEG/WebP
      if ((imageFormat === 'jpeg' || imageFormat === 'jpg') && imageConfig.quality) {
        command.push('-q:v', Math.round((100 - imageConfig.quality) / 3).toString())
      }
      
      // Size
      if (imageConfig.width && imageConfig.height) {
        command.push('-s', `${imageConfig.width}x${imageConfig.height}`)
      }
      
      break
  }
  
  command.push('output')
  return command
}

/**
 * Main conversion function
 */
export async function convertFile(options: ConversionOptions): Promise<ConversionResult> {
  const {
    inputFile,
    targetFormat,
    config = {},
    autoDetect = true
  } = options
  
  // Merge with default config
  const mergedConfig: ConversionConfig = {
    video: { ...DEFAULT_CONFIG.video, ...config.video },
    audio: { ...DEFAULT_CONFIG.audio, ...config.audio },
    image: { ...DEFAULT_CONFIG.image, ...config.image }
  }
  
  // Detect file type
  const fileType = autoDetect ? detectFileType(inputFile) : 'video'
  
  if (fileType === 'unknown') {
    throw new Error('Unsupported file type')
  }
  
  // Get FFmpeg instance
  const ffmpeg = await getFFmpeg()
  
  // Prepare input file
  const inputData = new Uint8Array(await inputFile.arrayBuffer())
  const inputExt = inputFile instanceof File 
    ? inputFile.name.split('.').pop() || 'mp4'
    : 'mp4'
  await ffmpeg.writeFile(`input.${inputExt}`, inputData)
  
  // Determine output format
  let outputFormat = targetFormat
  if (!outputFormat) {
    outputFormat = mergedConfig[fileType as keyof ConversionConfig].format as string
  }
  
  // Build and execute command
  const command = buildConversionCommand(fileType, mergedConfig, outputFormat)
  // Update command to use proper input/output filenames
  const finalCommand = command.map(arg => {
    if (arg === 'input') return `input.${inputExt}`
    if (arg === 'output') return `output.${outputFormat}`
    return arg
  })
  
  await ffmpeg.exec(finalCommand)
  
  // Read output file
  const outputData = await ffmpeg.readFile(`output.${outputFormat}`)
  const data = outputData as Uint8Array
  
  // Determine MIME type
  const mimeTypeMap: Record<string, string> = {
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'avi': 'video/avi',
    'mov': 'video/quicktime',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'aac': 'audio/aac',
    'ogg': 'audio/ogg',
    'jpeg': 'image/jpeg',
    'jpg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
    'gif': 'image/gif'
  }
  
  const mimeType = mimeTypeMap[outputFormat] || 'application/octet-stream'
  const resultBlob = new Blob([data.buffer], { type: mimeType })
  
  return {
    file: resultBlob,
    filename: generateOutputFilename(inputFile, outputFormat),
    originalSize: inputFile.size,
    convertedSize: resultBlob.size,
    format: outputFormat
  }
}

/**
 * Get supported formats for a file type
 */
export function getSupportedFormats(fileType: 'video' | 'audio' | 'image'): string[] {
  const formatMap = {
    video: ['mp4', 'webm', 'avi', 'mov'],
    audio: ['mp3', 'wav', 'aac', 'ogg'],
    image: ['jpeg', 'png', 'webp', 'gif']
  }
  
  return formatMap[fileType] || []
}
