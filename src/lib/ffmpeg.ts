import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

let ffmpeg: FFmpeg | null = null
let isLoaded = false

export const getFFmpeg = async (): Promise<FFmpeg> => {
  if (ffmpeg && isLoaded) {
    return ffmpeg
  }

  if (typeof window === 'undefined') {
    throw new Error('FFmpeg is only available in the browser')
  }

  try {
    // Use local files from node_modules instead of CDN
    const baseURL = '/ffmpeg'
    ffmpeg = new FFmpeg()

    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })

    isLoaded = true
    return ffmpeg
  } catch (error) {
    console.error('Failed to load FFmpeg:', error)
    throw new Error('Failed to initialize video processing engine')
  }
}

export const isFFmpegLoaded = (): boolean => {
  return isLoaded
}

export const unloadFFmpeg = () => {
  if (ffmpeg) {
    ffmpeg.terminate()
    ffmpeg = null
    isLoaded = false
  }
}