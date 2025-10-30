/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {Video} from '@google/genai';
import React, {useCallback, useEffect, useState} from 'react';
import ApiKeyDialog from './components/ApiKeyDialog';
import LoadingIndicator from './components/LoadingIndicator';
import PromptForm from './components/PromptForm';
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
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);

  // A single state to hold the initial values for the prompt form
  const [initialFormValues, setInitialFormValues] =
    useState<GenerateVideoParams | null>(null);

  // Check for API key on initial load
  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio) {
        try {
          if (!(await window.aistudio.hasSelectedApiKey())) {
            setShowApiKeyDialog(true);
          }
        } catch (error) {
          console.warn(
            'aistudio.hasSelectedApiKey check failed, assuming no key selected.',
            error,
          );
          setShowApiKeyDialog(true);
        }
      }
    };
    checkApiKey();
  }, []);

  const showStatusError = (message: string) => {
    setErrorMessage(message);
    setAppState(AppState.ERROR);
  };

  const executeGeneration = useCallback(async (params: GenerateVideoParams) => {
    setAppState(AppState.LOADING);
    setErrorMessage(null);
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
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred.';

      let userFriendlyMessage = `Video generation failed: ${errorMessage}`;
      let shouldOpenDialog = false;

      if (typeof errorMessage === 'string') {
        if (errorMessage.includes('Requested entity was not found.')) {
          userFriendlyMessage =
            'Model not found. This can be caused by an invalid API key or permission issues. Please check your API key.';
          shouldOpenDialog = true;
        } else if (
          errorMessage.includes('API_KEY_INVALID') ||
          errorMessage.includes('API key not valid') ||
          errorMessage.toLowerCase().includes('permission denied')
        ) {
          userFriendlyMessage =
            'Your API key is invalid or lacks permissions. Please select a valid, billing-enabled API key.';
          shouldOpenDialog = true;
        } else if (errorMessage.toLowerCase().includes('invalid argument')) {
            userFriendlyMessage = `The video generation request was invalid. This can happen with unsupported parameters (e.g., extending a 1080p video) or if media files are corrupted. Please check your settings and files. Original error: ${errorMessage}`;
        }
      }

      setErrorMessage(userFriendlyMessage);
      setAppState(AppState.ERROR);

      if (shouldOpenDialog) {
        setShowApiKeyDialog(true);
      }
    }
  }, []);

  const handleGenerate = useCallback(async (params: GenerateVideoParams) => {
    // Store the requested params in case the key check fails
    // and the user needs to select one before we can proceed.
    setLastConfig(params);

    if (window.aistudio) {
      try {
        if (!(await window.aistudio.hasSelectedApiKey())) {
          setShowApiKeyDialog(true);
          return;
        }
      } catch (error) {
        console.warn(
          'aistudio.hasSelectedApiKey check failed, assuming no key selected.',
          error,
        );
        setShowApiKeyDialog(true);
        return;
      }
    }

    await executeGeneration(params);
  }, [executeGeneration]);

  const handleRetry = useCallback(() => {
    if (lastConfig) {
      handleGenerate(lastConfig);
    }
  }, [lastConfig, handleGenerate]);

  const handleApiKeyDialogContinue = async () => {
    setShowApiKeyDialog(false);
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
    }
    // If we have a pending generation config, execute it directly.
    // This bypasses the `handleGenerate` check to avoid a race condition
    // where `hasSelectedApiKey` might still be false immediately after selection.
    if (lastConfig) {
      await executeGeneration(lastConfig);
    }
  };

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
        showStatusError(`Failed to prepare video for extension: ${message}`);
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
      <button
        onClick={handleTryAgainFromError}
        >
        Try Again
      </button>
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
                onClick={() => handleSelectExample(example)}
                >
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
            ) : renderError('Video generated, but URL is missing. Please try again.');
        case AppState.ERROR:
            return errorMessage ? renderError(errorMessage) : renderError('An unknown error occurred.');
        default:
            return null;
    }
  }


  return (
    <div className="app-container">
      {showApiKeyDialog && (
        <ApiKeyDialog onContinue={handleApiKeyDialogContinue} />
      )}
      <header className="app-header">
        <h1>CharChiru</h1>
      </header>
      <main className="app-main">
        {appState === AppState.IDLE ? renderIdleContent() : renderActiveContent()}
      </main>
    </div>
  );
};

export default App;