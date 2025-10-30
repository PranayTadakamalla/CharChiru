/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {
  GoogleGenAI,
  Video,
  VideoGenerationReferenceImage,
  VideoGenerationReferenceType,
} from '@google/genai';
import {GenerateVideoParams, GenerationMode} from '../types';

export const generateVideoPrompt = async (): Promise<string> => {
  try {
    const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents:
        'Generate a short, creative, and visually descriptive prompt for a video generation model. The prompt should be a single sentence and not be enclosed in quotes.',
    });
    return response.text.trim();
  } catch (error) {
    console.error('Failed to generate prompt:', error);
    throw new Error('Could not generate a prompt. Please try again.');
  }
};

export const generateVideo = async (
  params: GenerateVideoParams,
): Promise<{objectUrl: string; blob: Blob; uri: string; video: Video}> => {
  console.log('Starting video generation with params:', params);

  const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

  const config: any = {
    numberOfVideos: 1,
    resolution: params.resolution,
  };

  // Conditionally add aspect ratio. It's not used for extending videos.
  if (params.mode !== GenerationMode.EXTEND_VIDEO) {
    config.aspectRatio = params.aspectRatio;
  }

  const promptParts = [];
  if (params.prompt && params.prompt.trim()) {
    promptParts.push(params.prompt.trim());
  }
  if (params.musicPrompt && params.musicPrompt.trim()) {
    promptParts.push(`Audio: ${params.musicPrompt.trim()}`);
  }
  const finalPrompt = promptParts.join('. ');

  const generateVideoPayload: any = {
    model: params.model,
    config: config,
  };

  if (finalPrompt) {
    generateVideoPayload.prompt = finalPrompt;
  }

  if (params.mode === GenerationMode.IMAGE_TO_VIDEO) {
    if (params.inputImage) {
      generateVideoPayload.image = {
        imageBytes: params.inputImage.base64,
        mimeType: params.inputImage.file.type,
      };
      console.log(
        `Generating with input image: ${params.inputImage.file.name}`,
      );
    } else {
      throw new Error('An input image is required for Image to Video mode.');
    }
  } else if (params.mode === GenerationMode.FRAMES_TO_VIDEO) {
    if (params.startFrame) {
      generateVideoPayload.image = {
        imageBytes: params.startFrame.base64,
        mimeType: params.startFrame.file.type,
      };
      console.log(
        `Generating with start frame: ${params.startFrame.file.name}`,
      );
    }

    const finalEndFrame = params.isLooping
      ? params.startFrame
      : params.endFrame;
    if (finalEndFrame) {
      generateVideoPayload.config.lastFrame = {
        imageBytes: finalEndFrame.base64,
        mimeType: finalEndFrame.file.type,
      };
      if (params.isLooping) {
        console.log(
          `Generating a looping video using start frame as end frame: ${finalEndFrame.file.name}`,
        );
      } else {
        console.log(`Generating with end frame: ${finalEndFrame.file.name}`);
      }
    }
  } else if (params.mode === GenerationMode.REFERENCES_TO_VIDEO) {
    const referenceImagesPayload: VideoGenerationReferenceImage[] = [];

    if (params.referenceImages) {
      for (const img of params.referenceImages) {
        console.log(`Adding reference image: ${img.file.name}`);
        referenceImagesPayload.push({
          image: {
            imageBytes: img.base64,
            mimeType: img.file.type,
          },
          referenceType: VideoGenerationReferenceType.ASSET,
        });
      }
    }

    if (params.styleImage) {
      console.log(
        `Adding style image as a reference: ${params.styleImage.file.name}`,
      );
      referenceImagesPayload.push({
        image: {
          imageBytes: params.styleImage.base64,
          mimeType: params.styleImage.file.type,
        },
        referenceType: VideoGenerationReferenceType.STYLE,
      });
    }

    if (referenceImagesPayload.length > 0) {
      generateVideoPayload.config.referenceImages = referenceImagesPayload;
    }
  } else if (params.mode === GenerationMode.EXTEND_VIDEO) {
    if (params.inputVideoObject) {
      generateVideoPayload.video = params.inputVideoObject;
      console.log(`Generating extension from input video object.`);
    } else {
      throw new Error('An input video object is required to extend a video.');
    }
  }

  console.log('Submitting video generation request...', generateVideoPayload);
  let operation = await ai.models.generateVideos(generateVideoPayload);
  console.log('Video generation operation started:', operation);

  while (!operation.done) {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    console.log('...Generating...');
    operation = await ai.operations.getVideosOperation({operation: operation});
  }

  if (operation?.response) {
    const videos = operation.response.generatedVideos;

    if (!videos || videos.length === 0) {
      throw new Error('No videos were generated.');
    }

    const firstVideo = videos[0];
    if (!firstVideo?.video?.uri) {
      throw new Error('Generated video is missing a URI.');
    }
    const videoObject = firstVideo.video;

    const url = videoObject.uri;
    console.log('Fetching video from base URI:', url);

    // Use URL and URLSearchParams for robust URL construction.
    // This is safer than manual string concatenation.
    const fetchUrl = new URL(url);
    fetchUrl.searchParams.set('key', process.env.API_KEY!);
    console.log('Constructed fetch URL:', fetchUrl.href);

    const res = await fetch(fetchUrl.href);

    if (!res.ok) {
      let errorBody = '';
      try {
        // Attempt to read the response body for more detailed error info.
        errorBody = await res.text();
      } catch (e) {
        errorBody = 'Could not read error response body.';
      }
      console.error(
        'Fetch failed. Status:',
        res.status,
        'Response Body:',
        errorBody,
      );
      throw new Error(
        `Failed to fetch video: ${res.status} ${res.statusText}. Server said: "${errorBody}"`,
      );
    }

    const videoBlob = await res.blob();
    const objectUrl = URL.createObjectURL(videoBlob);

    return {objectUrl, blob: videoBlob, uri: url, video: videoObject};
  } else {
    console.error('Operation failed:', operation);
    throw new Error('No videos generated.');
  }
};
