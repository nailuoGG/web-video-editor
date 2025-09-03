import { ConversionOptions, ConversionResult, ConversionConfig } from '@/types/video'

// Debug logging utility
const DEBUG_PREFIX = '[WebCodecs]'
const debugLog = (message: string, ...args: any[]) => {
  console.log(`${DEBUG_PREFIX} ${message}`, ...args)
}

const debugError = (message: string, error?: any) => {
  console.error(`${DEBUG_PREFIX} ERROR: ${message}`, error)
}

const debugWarn = (message: string, ...args: any[]) => {
  console.warn(`${DEBUG_PREFIX} WARN: ${message}`, ...args)
}

// Performance timing utility
class PerformanceTimer {
  private startTime: number = 0
  private label: string

  constructor(label: string) {
    this.label = label
  }

  start() {
    this.startTime = performance.now()
    debugLog(`⏱️ Started: ${this.label}`)
  }

  end() {
    const duration = performance.now() - this.startTime
    debugLog(`✅ Completed: ${this.label} (${duration.toFixed(2)}ms)`)
    return duration
  }
}

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

// Check WebCodecs support
export function isWebCodecsSupported(): boolean {
  const supported = typeof window !== 'undefined' && 
         'VideoDecoder' in window && 
         'VideoEncoder' in window &&
         'AudioDecoder' in window && 
         'AudioEncoder' in window
  
  debugLog(`🔍 WebCodecs support check: ${supported ? '✅ Supported' : '❌ Not supported'}`)
  
  if (supported) {
    debugLog(`🎯 Available APIs:`, {
      VideoDecoder: 'VideoDecoder' in window,
      VideoEncoder: 'VideoEncoder' in window,
      AudioDecoder: 'AudioDecoder' in window,
      AudioEncoder: 'AudioEncoder' in window
    })
  }
  
  return supported
}

// Check codec support
async function isCodecSupported(config: VideoEncoderConfig | AudioEncoderConfig): Promise<boolean> {
  try {
    debugLog(`🧪 Testing codec support for:`, config)
    
    if ('codec' in config && config.codec) {
      if (config.codec.startsWith('avc1') || config.codec.startsWith('mp4a')) {
        const result = 'VideoEncoder' in window ? 
          await VideoEncoder.isConfigSupported(config as VideoEncoderConfig) :
          await AudioEncoder.isConfigSupported(config as AudioEncoderConfig)
        
        debugLog(`📊 Codec ${config.codec}: ${result.supported ? '✅ Supported' : '❌ Not supported'}`)
        return result.supported ?? false
      }
    }
    
    debugWarn(`⚠️ Unsupported codec format: ${(config as any).codec}`)
    return false
  } catch (error) {
    debugError(`Codec support check failed for ${(config as any).codec}`, error)
    return false
  }
}

/**
 * Detect file type based on MIME type and extension
 */
function detectFileType(file: File | Blob): 'video' | 'audio' | 'image' | 'unknown' {
  let mimeType = ''
  let extension = ''
  
  if (file instanceof File) {
    mimeType = file.type
    extension = file.name.split('.').pop()?.toLowerCase() || ''
    debugLog(`📁 File detection - Name: ${file.name}, MIME: ${mimeType}, Extension: ${extension}`)
    
    if (!mimeType && extension) {
      const videoExts = ['mp4', 'webm', 'avi', 'mov', 'mkv', 'flv']
      const audioExts = ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a']
      const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']
      
      if (videoExts.includes(extension)) {
        debugLog(`🎥 Detected as video by extension: ${extension}`)
        return 'video'
      }
      if (audioExts.includes(extension)) {
        debugLog(`🎵 Detected as audio by extension: ${extension}`)
        return 'audio'
      }
      if (imageExts.includes(extension)) {
        debugLog(`🖼️ Detected as image by extension: ${extension}`)
        return 'image'
      }
    }
  } else {
    mimeType = file.type
    debugLog(`📁 Blob detection - MIME: ${mimeType}`)
  }
  
  if (mimeType.startsWith('video/')) {
    debugLog(`🎥 Detected as video by MIME type: ${mimeType}`)
    return 'video'
  }
  if (mimeType.startsWith('audio/')) {
    debugLog(`🎵 Detected as audio by MIME type: ${mimeType}`)
    return 'audio'
  }
  if (mimeType.startsWith('image/')) {
    debugLog(`🖼️ Detected as image by MIME type: ${mimeType}`)
    return 'image'
  }
  
  debugWarn(`❓ Unknown file type - MIME: ${mimeType}, Extension: ${extension}`)
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
 * Convert video using WebCodecs API
 */
async function convertVideo(
  file: File | Blob, 
  targetFormat: string, 
  config: ConversionConfig['video']
): Promise<Blob> {
  const timer = new PerformanceTimer(`Video conversion to ${targetFormat}`)
  timer.start()
  
  debugLog(`🎬 Starting video conversion`, {
    targetFormat,
    config,
    fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`
  })
  
  if (!isWebCodecsSupported()) {
    debugError('WebCodecs is not supported in this browser')
    throw new Error('WebCodecs is not supported in this browser')
  }

  return new Promise(async (resolve, reject) => {
    try {
      // Create video element to load source
      debugLog(`📹 Creating video element and loading source`)
      const video = document.createElement('video')
      video.src = URL.createObjectURL(file)
      video.muted = true
      
      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          debugLog(`📊 Video metadata loaded:`, {
            duration: `${video.duration.toFixed(2)}s`,
            dimensions: `${video.videoWidth}x${video.videoHeight}`,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight
          })
          resolve(undefined)
        }
      })

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      
      // Set canvas dimensions based on resolution config
      let width = video.videoWidth
      let height = video.videoHeight
      const originalDimensions = `${width}x${height}`
      
      if (config.resolution && config.resolution !== 'original') {
        const resolutionMap = {
          '720p': { width: 1280, height: 720 },
          '1080p': { width: 1920, height: 1080 },
          '4k': { width: 3840, height: 2160 }
        }
        const targetRes = resolutionMap[config.resolution]
        // Maintain aspect ratio
        const aspectRatio = width / height
        if (aspectRatio > targetRes.width / targetRes.height) {
          width = targetRes.width
          height = Math.round(targetRes.width / aspectRatio)
        } else {
          height = targetRes.height
          width = Math.round(targetRes.height * aspectRatio)
        }
        
        debugLog(`🔄 Resolution scaling: ${originalDimensions} → ${width}x${height} (${config.resolution})`)
      } else {
        debugLog(`📐 Using original resolution: ${originalDimensions}`)
      }
      
      canvas.width = width
      canvas.height = height

      // Prepare video encoder
      const chunks: ArrayBuffer[] = []
      const bitrate = getBitrate(config.quality || 'medium', width, height)
      
      const encoderConfig: VideoEncoderConfig = {
        codec: getVideoCodec(config.codec || 'h264'),
        width,
        height,
        bitrate,
        framerate: 30
      }

      debugLog(`⚙️ Video encoder configuration:`, {
        codec: encoderConfig.codec,
        dimensions: `${width}x${height}`,
        bitrate: `${(bitrate / 1000).toFixed(0)}kbps`,
        quality: config.quality,
        framerate: encoderConfig.framerate
      })

      // Check if codec is supported
      const codecSupport = await VideoEncoder.isConfigSupported(encoderConfig)
      if (!codecSupport.supported) {
        debugError(`Video codec ${encoderConfig.codec} is not supported`)
        throw new Error(`Video codec ${encoderConfig.codec} is not supported`)
      }
      
      debugLog(`✅ Video codec ${encoderConfig.codec} is supported`)

      const encoder = new VideoEncoder({
        output: (chunk) => {
          const buffer = new ArrayBuffer(chunk.byteLength)
          chunk.copyTo(new Uint8Array(buffer))
          chunks.push(buffer)
          
          // Log progress every 30 frames (1 second)
          if (chunks.length % 30 === 0) {
            debugLog(`📦 Encoded ${chunks.length} chunks so far`)
          }
        },
        error: (error) => {
          debugError('Video encoder error', error)
          reject(error)
        }
      })

      encoder.configure(encoderConfig)
      debugLog(`🎬 Video encoder configured and ready`)

      // Process video frames
      video.currentTime = 0
      const frameRate = 30
      const frameDuration = 1000000 / frameRate // microseconds
      let frameCount = 0
      const totalFrames = Math.floor(video.duration * frameRate)
      
      debugLog(`🎞️ Starting frame processing:`, {
        totalFrames,
        duration: `${video.duration.toFixed(2)}s`,
        frameRate: `${frameRate}fps`
      })

      const processFrame = () => {
        if (frameCount >= totalFrames) {
          debugLog(`🏁 All frames processed, flushing encoder...`)
          encoder.flush().then(() => {
            URL.revokeObjectURL(video.src)
            
            // Create output blob
            const mimeType = getMimeType(targetFormat)
            const outputBlob = new Blob(chunks.map(chunk => new Uint8Array(chunk)), { type: mimeType })
            
            const duration = timer.end()
            debugLog(`🎉 Video conversion completed!`, {
              totalChunks: chunks.length,
              outputSize: `${(outputBlob.size / 1024 / 1024).toFixed(2)}MB`,
              compressionRatio: `${((file.size - outputBlob.size) / file.size * 100).toFixed(1)}%`,
              duration: `${duration.toFixed(2)}ms`,
              framesPerSecond: `${(totalFrames / (duration / 1000)).toFixed(1)} fps processing`
            })
            
            resolve(outputBlob)
          }).catch(reject)
          return
        }

        // Log progress every 10% of frames
        if (frameCount % Math.max(1, Math.floor(totalFrames / 10)) === 0) {
          const progress = (frameCount / totalFrames * 100).toFixed(1)
          debugLog(`📊 Processing progress: ${progress}% (frame ${frameCount}/${totalFrames})`)
        }

        video.currentTime = frameCount / frameRate
        
        video.onseeked = () => {
          ctx.drawImage(video, 0, 0, width, height)
          
          // Create VideoFrame from canvas instead of ImageData
          const videoFrame = new VideoFrame(canvas, {
            timestamp: frameCount * frameDuration
          })
          
          encoder.encode(videoFrame)
          videoFrame.close()
          
          frameCount++
          setTimeout(processFrame, 1000 / frameRate)
        }
      }

      processFrame()

    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Convert audio using WebCodecs API
 */
async function convertAudio(
  file: File | Blob, 
  targetFormat: string, 
  config: ConversionConfig['audio']
): Promise<Blob> {
  const timer = new PerformanceTimer(`Audio conversion to ${targetFormat}`)
  timer.start()
  
  debugLog(`🎵 Starting audio conversion`, {
    targetFormat,
    config,
    fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`
  })
  
  if (!isWebCodecsSupported()) {
    debugError('WebCodecs is not supported in this browser')
    throw new Error('WebCodecs is not supported in this browser')
  }

  return new Promise(async (resolve, reject) => {
    try {
      debugLog(`🎧 Loading and decoding audio data...`)
      const arrayBuffer = await file.arrayBuffer()
      const audioContext = new AudioContext()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

      debugLog(`📊 Audio metadata:`, {
        duration: `${audioBuffer.duration.toFixed(2)}s`,
        sampleRate: `${audioBuffer.sampleRate}Hz`,
        channels: audioBuffer.numberOfChannels,
        length: audioBuffer.length
      })

      const chunks: ArrayBuffer[] = []
      const bitrate = parseBitrate(config.bitrate || '256k')
      
      const encoderConfig: AudioEncoderConfig = {
        codec: getAudioCodec(targetFormat),
        sampleRate: config.sampleRate || 44100,
        numberOfChannels: audioBuffer.numberOfChannels,
        bitrate
      }

      debugLog(`⚙️ Audio encoder configuration:`, {
        codec: encoderConfig.codec,
        sampleRate: `${encoderConfig.sampleRate}Hz`,
        channels: encoderConfig.numberOfChannels,
        bitrate: `${(bitrate / 1000).toFixed(0)}kbps`
      })

      // Check if codec is supported
      const codecSupport = await AudioEncoder.isConfigSupported(encoderConfig)
      if (!codecSupport.supported) {
        debugError(`Audio codec ${encoderConfig.codec} is not supported`)
        throw new Error(`Audio codec ${encoderConfig.codec} is not supported`)
      }
      
      debugLog(`✅ Audio codec ${encoderConfig.codec} is supported`)

      const encoder = new AudioEncoder({
        output: (chunk) => {
          const buffer = new ArrayBuffer(chunk.byteLength)
          chunk.copyTo(new Uint8Array(buffer))
          chunks.push(buffer)
          
          // Log progress every 50 chunks
          if (chunks.length % 50 === 0) {
            debugLog(`📦 Encoded ${chunks.length} audio chunks so far`)
          }
        },
        error: (error) => {
          debugError('Audio encoder error', error)
          reject(error)
        }
      })

      encoder.configure(encoderConfig)
      debugLog(`🎵 Audio encoder configured and ready`)

      // Process audio data
      const frameSize = 1024 // samples per frame
      const totalSamples = audioBuffer.length
      const totalFrames = Math.ceil(totalSamples / frameSize)
      
      debugLog(`🎞️ Starting audio frame processing:`, {
        totalSamples,
        totalFrames,
        frameSize,
        duration: `${audioBuffer.duration.toFixed(2)}s`
      })
      
      for (let offset = 0; offset < totalSamples; offset += frameSize) {
        const currentFrameSize = Math.min(frameSize, totalSamples - offset)
        const frameIndex = offset / frameSize
        
        // Log progress every 10% of frames
        if (frameIndex % Math.max(1, Math.floor(totalFrames / 10)) === 0) {
          const progress = (offset / totalSamples * 100).toFixed(1)
          debugLog(`📊 Audio processing progress: ${progress}% (frame ${Math.floor(frameIndex)}/${totalFrames})`)
        }
        
        // Create AudioData frame
        const channels: Float32Array[] = []
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
          const channelData = audioBuffer.getChannelData(channel)
          channels.push(channelData.slice(offset, offset + currentFrameSize))
        }
        
        // Combine all channels into interleaved format
        const interleavedData = new Float32Array(currentFrameSize * encoderConfig.numberOfChannels)
        for (let frame = 0; frame < currentFrameSize; frame++) {
          for (let channel = 0; channel < encoderConfig.numberOfChannels; channel++) {
            interleavedData[frame * encoderConfig.numberOfChannels + channel] = channels[channel][frame]
          }
        }
        
        const audioData = new AudioData({
          format: 'f32',
          sampleRate: encoderConfig.sampleRate,
          numberOfChannels: encoderConfig.numberOfChannels,
          numberOfFrames: currentFrameSize,
          timestamp: (offset / audioBuffer.sampleRate) * 1000000, // microseconds
          data: interleavedData.buffer
        })
        
        encoder.encode(audioData)
        audioData.close()
      }

      debugLog(`🏁 All audio frames processed, flushing encoder...`)
      await encoder.flush()
      audioContext.close()

      // Create output blob
      const mimeType = getMimeType(targetFormat)
      const outputBlob = new Blob(chunks.map(chunk => new Uint8Array(chunk)), { type: mimeType })
      
      const duration = timer.end()
      debugLog(`🎉 Audio conversion completed!`, {
        totalChunks: chunks.length,
        outputSize: `${(outputBlob.size / 1024 / 1024).toFixed(2)}MB`,
        compressionRatio: `${((file.size - outputBlob.size) / file.size * 100).toFixed(1)}%`,
        duration: `${duration.toFixed(2)}ms`,
        samplesPerSecond: `${(totalSamples / (duration / 1000)).toFixed(0)} samples/s processing`
      })
      
      resolve(outputBlob)

    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Convert image using Canvas API
 */
async function convertImage(
  file: File | Blob, 
  targetFormat: string, 
  config: ConversionConfig['image']
): Promise<Blob> {
  const timer = new PerformanceTimer(`Image conversion to ${targetFormat}`)
  timer.start()
  
  debugLog(`🖼️ Starting image conversion`, {
    targetFormat,
    config,
    fileSize: `${(file.size / 1024).toFixed(2)}KB`
  })
  
  return new Promise((resolve, reject) => {
    const img = new Image()
    
    img.onload = () => {
      debugLog(`📊 Image metadata:`, {
        originalDimensions: `${img.naturalWidth}x${img.naturalHeight}`,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight
      })
      
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      
      // Set canvas dimensions
      const width = config.width || img.naturalWidth
      const height = config.height || img.naturalHeight
      
      if (config.width || config.height) {
        debugLog(`🔄 Image resizing: ${img.naturalWidth}x${img.naturalHeight} → ${width}x${height}`)
      } else {
        debugLog(`📐 Using original image dimensions: ${width}x${height}`)
      }
      
      canvas.width = width
      canvas.height = height
      
      // Draw and convert
      debugLog(`🎨 Drawing image to canvas and converting...`)
      ctx.drawImage(img, 0, 0, width, height)
      
      const quality = (config.quality || 85) / 100
      const mimeType = getMimeType(targetFormat)
      
      debugLog(`⚙️ Canvas conversion settings:`, {
        targetFormat,
        mimeType,
        quality: `${(quality * 100).toFixed(0)}%`,
        dimensions: `${width}x${height}`
      })
      
      canvas.toBlob((blob) => {
        if (blob) {
          const duration = timer.end()
          debugLog(`🎉 Image conversion completed!`, {
            outputSize: `${(blob.size / 1024).toFixed(2)}KB`,
            compressionRatio: `${((file.size - blob.size) / file.size * 100).toFixed(1)}%`,
            duration: `${duration.toFixed(2)}ms`
          })
          resolve(blob)
        } else {
          debugError('Failed to convert image - canvas.toBlob returned null')
          reject(new Error('Failed to convert image'))
        }
        URL.revokeObjectURL(img.src)
      }, mimeType, quality)
    }
    
    img.onerror = () => {
      reject(new Error('Failed to load image'))
      URL.revokeObjectURL(img.src)
    }
    
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Helper functions
 */
function getVideoCodec(codec: string): string {
  const codecMap: Record<string, string> = {
    'h264': 'avc1.42E01E',
    'h265': 'hev1.1.6.L93.B0',
    'vp9': 'vp09.00.10.08'
  }
  return codecMap[codec] || codecMap['h264']
}

function getAudioCodec(format: string): string {
  const codecMap: Record<string, string> = {
    'mp3': 'mp3',
    'aac': 'mp4a.40.2',
    'ogg': 'vorbis',
    'wav': 'pcm'
  }
  return codecMap[format] || codecMap['aac']
}

function getBitrate(quality: string, width: number, height: number): number {
  const pixels = width * height
  const qualityMap: Record<string, number> = {
    'low': 0.1,
    'medium': 0.2,
    'high': 0.4
  }
  
  const factor = qualityMap[quality] || qualityMap['medium']
  return Math.round(pixels * factor * 30 / 1000) * 1000 // Convert to bps
}

function parseBitrate(bitrate: string): number {
  const match = bitrate.match(/(\d+)k?/)
  if (match) {
    const value = parseInt(match[1])
    return bitrate.includes('k') ? value * 1000 : value
  }
  return 256000 // Default 256kbps
}

function getMimeType(format: string): string {
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
  return mimeTypeMap[format] || 'application/octet-stream'
}

/**
 * Main conversion function using WebCodecs
 */
export async function convertFileWithWebCodecs(options: ConversionOptions): Promise<ConversionResult> {
  const overallTimer = new PerformanceTimer('WebCodecs File Conversion')
  overallTimer.start()
  
  debugLog(`🚀 Starting WebCodecs conversion process`)
  debugLog(`📋 Conversion options:`, {
    targetFormat: options.targetFormat,
    autoDetect: options.autoDetect,
    config: options.config,
    inputSize: `${(options.inputFile.size / 1024 / 1024).toFixed(2)}MB`
  })
  
  const {
    inputFile,
    targetFormat,
    config = {},
    autoDetect = true
  } = options
  
  // Check WebCodecs support
  if (!isWebCodecsSupported()) {
    debugError('WebCodecs is not supported in this browser')
    throw new Error('WebCodecs is not supported in this browser. Please use a modern browser or enable experimental features.')
  }
  
  // Merge with default config
  const mergedConfig: ConversionConfig = {
    video: { ...DEFAULT_CONFIG.video, ...config.video },
    audio: { ...DEFAULT_CONFIG.audio, ...config.audio },
    image: { ...DEFAULT_CONFIG.image, ...config.image }
  }
  
  debugLog(`⚙️ Merged configuration:`, mergedConfig)
  
  // Detect file type
  const fileType = autoDetect ? detectFileType(inputFile) : 'video'
  
  if (fileType === 'unknown') {
    debugError('File type could not be detected')
    throw new Error('Unsupported file type')
  }
  
  debugLog(`🎯 File type detected: ${fileType}`)
  
  // Determine output format
  let outputFormat = targetFormat
  if (!outputFormat) {
    outputFormat = mergedConfig[fileType as keyof ConversionConfig].format as string
    debugLog(`📝 Using default output format: ${outputFormat}`)
  } else {
    debugLog(`📝 Using specified output format: ${outputFormat}`)
  }
  
  let resultBlob: Blob
  
  // Convert based on file type
  debugLog(`🔄 Starting ${fileType} conversion using WebCodecs API`)
  
  try {
    switch (fileType) {
      case 'video':
        debugLog(`🎬 Initiating video conversion`)
        resultBlob = await convertVideo(inputFile, outputFormat, mergedConfig.video)
        break
      case 'audio':
        debugLog(`🎵 Initiating audio conversion`)
        resultBlob = await convertAudio(inputFile, outputFormat, mergedConfig.audio)
        break
      case 'image':
        debugLog(`🖼️ Initiating image conversion`)
        resultBlob = await convertImage(inputFile, outputFormat, mergedConfig.image)
        break
      default:
        debugError(`Unsupported file type: ${fileType}`)
        throw new Error(`Unsupported file type: ${fileType}`)
    }
  } catch (error) {
    debugError('Conversion process failed', error)
    throw new Error(`Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
  
  const finalResult = {
    file: resultBlob,
    filename: generateOutputFilename(inputFile, outputFormat),
    originalSize: inputFile.size,
    convertedSize: resultBlob.size,
    format: outputFormat
  }
  
  const overallDuration = overallTimer.end()
  debugLog(`🎊 WebCodecs conversion process completed successfully!`, {
    ...finalResult,
    filename: finalResult.filename,
    originalSize: `${(finalResult.originalSize / 1024 / 1024).toFixed(2)}MB`,
    convertedSize: `${(finalResult.convertedSize / 1024 / 1024).toFixed(2)}MB`,
    compressionRatio: `${((finalResult.originalSize - finalResult.convertedSize) / finalResult.originalSize * 100).toFixed(1)}%`,
    totalDuration: `${overallDuration.toFixed(2)}ms`,
    conversionMethod: 'WebCodecs API'
  })
  
  return finalResult
}

/**
 * Get supported formats for WebCodecs (subset of FFmpeg capabilities)
 */
export function getWebCodecsSupportedFormats(fileType: 'video' | 'audio' | 'image'): string[] {
  const formatMap = {
    video: ['mp4', 'webm'], // Limited to well-supported formats
    audio: ['aac', 'wav'], // MP3 encoding not widely supported in WebCodecs
    image: ['jpeg', 'png', 'webp'] // Canvas API supported formats
  }
  
  return formatMap[fileType] || []
}
