export interface VideoSegment {
  id: string
  startTime: number
  endTime: number
  duration: number
  effects: VideoEffect[]
}

export interface VideoEffect {
  type: 'cut' | 'speed' | 'reverse'
  parameters: Record<string, any>
}

export interface VideoProcessingOptions {
  inputFile: File
  segments: VideoSegment[]
  outputFormat?: string
}

export interface ProcessingProgress {
  progress: number
  status: string
  estimatedTime?: number
}

export interface TimelineState {
  duration: number
  currentTime: number
  zoom: number
  segments: VideoSegment[]
}

export interface VideoUploadState {
  file: File | null
  url: string
  duration: number
  metadata: {
    width: number
    height: number
    fps: number
    bitrate: number
  } | null
}

export interface ConversionConfig {
  video: {
    format: 'mp4' | 'webm' | 'avi' | 'mov'
    resolution?: '720p' | '1080p' | '4k' | 'original'
    quality?: 'low' | 'medium' | 'high'
    codec?: 'h264' | 'h265' | 'vp9'
  }
  audio: {
    format: 'mp3' | 'wav' | 'aac' | 'ogg'
    bitrate?: '128k' | '256k' | '320k'
    sampleRate?: 44100 | 48000
  }
  image: {
    format: 'jpeg' | 'png' | 'webp' | 'gif'
    quality?: number // 1-100
    width?: number
    height?: number
  }
}

export interface ConversionOptions {
  inputFile: File | Blob
  targetFormat?: string
  config?: Partial<ConversionConfig>
  autoDetect?: boolean
}

export interface ConversionResult {
  file: Blob
  filename: string
  originalSize: number
  convertedSize: number
  format: string
}