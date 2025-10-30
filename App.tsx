/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {Video} from '@google/genai';
import React, {useCallback, useEffect, useState} from 'react';
import LoadingIndicator from './components/LoadingIndicator';
import PromptForm from './components/PromptForm';
import StartupAnimation from './components/StartupAnimation';
import VideoResult from './components/VideoResult';
import {generateVideo} from './services/geminiService';
import {
  AppState,
  AspectRatio,
  GenerateVideoParams,
  GenerationMode,
  Resolution,
  VeoModel,
  VideoFile,
} from './types';

const examplePrompts: Array<
  Partial<GenerateVideoParams> & {title: string; prompt: string}
> = [
  {
    title: 'Cinematic Drone Shot',
    prompt:
      'A cinematic drone shot of a car driving on a winding road through a forest in autumn.',
    mode: GenerationMode.TEXT_TO_VIDEO,
  },
  {
    title: 'Surreal Animation',
    prompt:
      'A surreal animation of a giant jellyfish floating through the clouds at sunset.',
    mode: GenerationMode.TEXT_TO_VIDEO,
  },
  {
    title: 'Time-lapse City',
    prompt: 'A time-lapse of a futuristic city with flying vehicles and neon lights.',
    mode: GenerationMode.TEXT_TO_VIDEO,
  },
  {
    title: 'Underwater World',
    prompt:
      'A beautiful underwater shot of a coral reef with colorful fish and a sea turtle.',
    mode: GenerationMode.TEXT_TO_VIDEO,
  },
];

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastConfig, setLastConfig] = useState<GenerateVideoParams | null>(
    null,
  );
  const [lastVideoObject, setLastVideoObject] = useState<Video | null>(null);
  const [lastVideoBlob, setLastVideoBlob] = useState<Blob | null>(null);
  const [isStartingUp, setIsStartingUp] = useState(true);

  // A single state to hold the initial values for the prompt form
  const [initialFormValues, setInitialFormValues] =
    useState<GenerateVideoParams | null>(null);

  useEffect(() => {
    const startupTimer = setTimeout(() => {
      setIsStartingUp(false);
    }, 2800);
    return () => clearTimeout(startupTimer);
  }, []);

  const handleGenerate = useCallback(
    async (params: GenerateVideoParams) => {
      setAppState(AppState.LOADING);
      setErrorMessage(null);
      setLastConfig(params);
      // Reset initial form values for the next fresh start
      setInitialFormValues(null);

      try {
        const {objectUrl, blob, video} = await generateVideo(params);
        setVideoUrl(objectUrl);
        setLastVideoBlob(blob);
        setLastVideoObject(video);
        setAppState(AppState.SUCCESS);
      } catch (error) {
        console.error('Video generation failed:', error);
        // Per user request, show a generic, secure error message for all failures.
        setErrorMessage('Video generation failed. Please try again.');
        setAppState(AppState.ERROR);
      }
    },
    [],
  );

  const handleRetry = useCallback(() => {
    if (lastConfig) {
      handleGenerate(lastConfig);
    }
  }, [lastConfig, handleGenerate]);

  const handleNewVideo = useCallback(() => {
    setAppState(AppState.IDLE);
    setVideoUrl(null);
    setErrorMessage(null);
    setLastConfig(null);
    setLastVideoObject(null);
    setLastVideoBlob(null);
    setInitialFormValues(null); // Clear the form state
  }, []);

  const handleTryAgainFromError = useCallback(() => {
    if (lastConfig) {
      setInitialFormValues(lastConfig);
      setAppState(AppState.IDLE);
      setErrorMessage(null);
    } else {
      // Fallback to a fresh start if there's no last config
      handleNewVideo();
    }
  }, [lastConfig, handleNewVideo]);

  const handleExtend = useCallback(async () => {
    if (lastConfig && lastVideoBlob && lastVideoObject) {
      try {
        const file = new File([lastVideoBlob], 'last_video.mp4', {
          type: lastVideoBlob.type,
        });
        const videoFile: VideoFile = {file, base64: ''};

        setInitialFormValues({
          ...lastConfig, // Carry over model, aspect ratio
          mode: GenerationMode.EXTEND_VIDEO,
          prompt: '', // Start with a blank prompt
          inputVideo: videoFile, // for preview in the form
          inputVideoObject: lastVideoObject, // for the API call
          resolution: Resolution.P720, // Extend requires 720p
          model: VeoModel.VEO, // Extend requires VEO model
          // Reset other media types
          inputImage: null,
          startFrame: null,
          endFrame: null,
          referenceImages: [],
          styleImage: null,
          isLooping: false,
          musicPrompt: '',
        });

        setAppState(AppState.IDLE);
        setVideoUrl(null);
        setErrorMessage(null);
      } catch (error) {
        console.error('Failed to process video for extension:', error);
        const message =
          error instanceof Error ? error.message : 'An unknown error occurred.';
        setErrorMessage(`Failed to prepare video for extension: ${message}`);
        setAppState(AppState.ERROR);
      }
    }
  }, [lastConfig, lastVideoBlob, lastVideoObject]);

  const handleSelectExample = (example: Partial<GenerateVideoParams>) => {
    setInitialFormValues({
      // Set defaults for any missing properties
      prompt: '',
      model: VeoModel.VEO_FAST,
      aspectRatio: AspectRatio.LANDSCAPE,
      resolution: Resolution.P720,
      mode: GenerationMode.TEXT_TO_VIDEO,
      musicPrompt: '',
      ...example,
    });
  };

  const handleDownload = useCallback(() => {
    if (videoUrl && lastVideoBlob) {
      const a = document.createElement('a');
a.href = videoUrl;
      const safePrompt =
        lastConfig?.prompt
          ?.toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .substring(0, 30) || 'video';
      a.download = `charchiru-${safePrompt}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }, [videoUrl, lastVideoBlob, lastConfig]);

  const renderError = (message: string) => (
    <div className="error-container">
      <h2>[ System Error ]</h2>
      <p>{message}</p>
      <button onClick={handleTryAgainFromError}>Try Again</button>
    </div>
  );

  const renderIdleContent = () => (
    <>
      <div className="idle-container">
        <div>
          <h2>SYSTEM.READY AWAITING COMMAND...</h2>
        </div>
        <div>
          <h3>&gt; OR LOAD EXAMPLE:</h3>
          <div className="example-prompts">
            {examplePrompts.map((example) => (
              <button
                key={example.title}
                onClick={() => handleSelectExample(example)}>
                {example.title}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="prompt-form-container">
        <PromptForm
          onGenerate={handleGenerate}
          initialValues={initialFormValues}
          lastVideoObject={lastVideoObject}
          lastVideoBlob={lastVideoBlob}
          lastConfig={lastConfig}
        />
      </div>
    </>
  );

  const renderActiveContent = () => {
    switch (appState) {
      case AppState.LOADING:
        return <LoadingIndicator />;
      case AppState.SUCCESS:
        return videoUrl ? (
          <VideoResult
            videoUrl={videoUrl}
            onRetry={handleRetry}
            onNewVideo={handleNewVideo}
            onExtend={handleExtend}
            canExtend={lastConfig?.resolution === Resolution.P720}
            onDownload={handleDownload}
          />
        ) : (
          renderError('Video generated, but URL is missing. Please try again.')
        );
      case AppState.ERROR:
        return errorMessage
          ? renderError(errorMessage)
          : renderError('An unknown error occurred.');
      default:
        return null;
    }
  };

  if (isStartingUp) {
    return <StartupAnimation />;
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>CharChiru</h1>
      </header>
      <main className="app-main">
        {appState === AppState.IDLE
          ? renderIdleContent()
          : renderActiveContent()}
      </main>
    </div>
  );
};

export default App;
