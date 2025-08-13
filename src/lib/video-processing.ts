import { getFFmpeg } from './ffmpeg'
import { VideoProcessingOptions, ProcessingProgress } from '@/types/video'

export async function processVideo(
  options: VideoProcessingOptions,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<Blob> {
  const ffmpeg = await getFFmpeg()
  
  // Write input file to memory
  const inputData = new Uint8Array(await options.inputFile.arrayBuffer())
  await ffmpeg.writeFile('input.mp4', inputData)

  // Build FFmpeg command based on segments and effects
  const commands = buildFFmpegCommands(options)
  
  // Set up progress callback
  if (onProgress) {
    ffmpeg.on('progress', ({ progress, time }) => {
      onProgress({
        progress: Math.round(progress * 100),
        status: `Processing... ${Math.round(progress * 100)}%`,
        estimatedTime: time
      })
    })
  }

  // Execute FFmpeg commands
  await ffmpeg.exec(commands)

  // Read output file
  const outputData = await ffmpeg.readFile('output.mp4')
  const data = outputData as Uint8Array
  return new Blob([data.buffer], { type: 'video/mp4' })
}

function buildFFmpegCommands(options: VideoProcessingOptions): string[] {
  let command = ['-i', 'input.mp4']
  
  // Process segments with effects
  if (options.segments.length > 0) {
    const filterComplex = buildFilterComplex(options.segments)
    if (filterComplex) {
      command.push('-filter_complex', filterComplex)
      command.push('-map', '[vout]')
      command.push('-map', '[aout]')
    } else {
      // No filter complex, just process the whole video
      command.push('-movflags', 'faststart', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-c:a', 'aac')
    }
  } else {
    // No segments, just process the whole video
    command.push('-movflags', 'faststart', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-c:a', 'aac')
  }
  
  command.push('output.mp4')
  return command
}

function buildFilterComplex(segments: any[]): string {
  if (segments.length === 0) {
    return ''
  }
  
  let filterParts: string[] = []
  
  segments.forEach((segment, index) => {
    const { startTime, endTime, effects } = segment
    
    // Extract segment
    let videoFilter = `[0:v]trim=start=${startTime}:end=${endTime}`
    let audioFilter = `[0:a]atrim=start=${startTime}:end=${endTime}`
    
    // Apply effects
    effects.forEach((effect: any) => {
      switch (effect.type) {
        case 'speed':
          const speed = effect.parameters.speed || 1
          videoFilter += `,setpts=PTS/${speed}`
          audioFilter += `,atempo=${speed}`
          break
        case 'reverse':
          videoFilter += `,reverse`
          audioFilter += `,areverse`
          break
      }
    })
    
    videoFilter += `[v${index}]`
    audioFilter += `[a${index}]`
    
    filterParts.push(videoFilter, audioFilter)
  })
  
  // Concatenate all segments
  if (segments.length > 1) {
    const videoInputs = segments.map((_, i) => `[v${i}]`).join('')
    const audioInputs = segments.map((_, i) => `[a${i}]`).join('')
    filterParts.push(`${videoInputs}${audioInputs}concat=n=${segments.length}:v=1:a=1[vout][aout]`)
  } else if (segments.length === 1) {
    // Single segment, use the last filter outputs
    const lastIndex = segments.length - 1
    filterParts.push(`[v${lastIndex}][a${lastIndex}]null[vout][aout]`)
  } else {
    // No segments, just passthrough
    return ''
  }
  
  return filterParts.join(';')
}

export async function getVideoDuration(file: File): Promise<number> {
  const ffmpeg = await getFFmpeg()
  const data = new Uint8Array(await file.arrayBuffer())
  await ffmpeg.writeFile('temp.mp4', data)
  
  // Get video info
  const result = await ffmpeg.exec(['-i', 'temp.mp4', '-f', 'null', '-'])
  
  // Parse duration from output (simplified)
  // In a real implementation, you'd parse the FFmpeg output
  return 60 // Placeholder
}

export async function extractFrame(file: File, time: number): Promise<string> {
  const ffmpeg = await getFFmpeg()
  const data = new Uint8Array(await file.arrayBuffer())
  await ffmpeg.writeFile('input.mp4', data)
  
  // Extract frame as JPEG
  await ffmpeg.exec([
    '-i', 'input.mp4',
    '-ss', time.toString(),
    '-vframes', '1',
    '-f', 'image2',
    'frame.jpg'
  ])
  
  const frameData = await ffmpeg.readFile('frame.jpg')
  const blob = new Blob([frameData as Uint8Array], { type: 'image/jpeg' })
  return URL.createObjectURL(blob)
}