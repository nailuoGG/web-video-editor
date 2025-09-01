let ffmpeg: any = null
let isLoaded = false

export const getFFmpeg = async (): Promise<any> => {
  if (ffmpeg && isLoaded) {
    return ffmpeg
  }

  if (typeof window === 'undefined') {
    throw new Error('FFmpeg is only available in the browser')
  }

  try {
    // Dynamic import to avoid SSR issues
    const { FFmpeg } = await import('@ffmpeg/ffmpeg')
    const { toBlobURL } = await import('@ffmpeg/util')
    
    // Use local files from node_modules instead of CDN
    const baseURL = '/ffmpeg'
    ffmpeg = new FFmpeg()

    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
    })

    isLoaded = true
      console.log('ffmpeg loaded')
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
