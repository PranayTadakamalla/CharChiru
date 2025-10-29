/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {Video} from '@google/genai';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {generateVideoPrompt} from '../services/geminiService';
import {
  AspectRatio,
  GenerateVideoParams,
  GenerationMode,
  ImageFile,
  Resolution,
  VeoModel,
  VideoFile,
} from '../types';

const aspectRatioDisplayNames: Record<AspectRatio, string> = {
  [AspectRatio.LANDSCAPE]: 'Landscape (16:9)',
  [AspectRatio.PORTRAIT]: 'Portrait (9:16)',
};

const fileToBase64 = <T extends {file: File; base64: string}>(
  file: File,
): Promise<T> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      if (base64) {
        resolve({file, base64} as T);
      } else {
        reject(new Error('Failed to read file as base64.'));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};
const fileToImageFile = (file: File): Promise<ImageFile> =>
  fileToBase64<ImageFile>(file);
const fileToVideoFile = (file: File): Promise<VideoFile> =>
  fileToBase64<VideoFile>(file);

const CustomSelect: React.FC<{
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
  disabled?: boolean;
}> = ({label, value, onChange, children, disabled = false}) => (
  <div className="custom-select-wrapper">
    <label>
      {label}
    </label>
    <div className="custom-select">
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        >
        {children}
      </select>
      <span className="chevron" aria-hidden="true">▼</span>
    </div>
  </div>
);

const ImageUpload: React.FC<{
  onSelect: (image: ImageFile) => void;
  onRemove?: () => void;
  image?: ImageFile | null;
  label: React.ReactNode;
}> = ({onSelect, onRemove, image, label}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const imageFile = await fileToImageFile(file);
        onSelect(imageFile);
      } catch (error) {
        console.error('Error converting file:', error);
      }
    }
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  if (image) {
    return (
      <div className="image-upload-preview">
        <img
          src={URL.createObjectURL(image.file)}
          alt="preview"
        />
        <button
          type="button"
          onClick={onRemove}
          className="remove-button"
          aria-label="Remove image">
          X
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className="image-upload">
      <span>[+]</span>
      <span>{label}</span>
      <input
        type="file"
        ref={inputRef}
        onChange={handleFileChange}
        accept="image/*"
        style={{display: 'none'}}
      />
    </button>
  );
};

const VideoUpload: React.FC<{
  onSelect: (video: VideoFile) => void;
  onRemove?: () => void;
  video?: VideoFile | null;
  label: React.ReactNode;
  disabled?: boolean;
}> = ({onSelect, onRemove, video, label, disabled = false}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const videoFile = await fileToVideoFile(file);
        onSelect(videoFile);
      } catch (error) {
        console.error('Error converting file:', error);
      }
    }
  };

  if (video) {
    return (
      <div className="video-upload-preview">
        <video
          src={URL.createObjectURL(video.file)}
          muted
          loop
        />
        <button
          type="button"
          onClick={onRemove}
          className="remove-button"
          aria-label="Remove video"
          disabled={disabled}>
          X
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className="video-upload"
      disabled={disabled}>
      <span>[+]</span>
      <span>{label}</span>
      <input
        type="file"
        ref={inputRef}
        onChange={handleFileChange}
        accept="video/*"
        style={{display: 'none'}}
        disabled={disabled}
      />
    </button>
  );
};

interface PromptFormProps {
  onGenerate: (params: GenerateVideoParams) => void;
  initialValues?: GenerateVideoParams | null;
  lastVideoObject?: Video | null;
  lastVideoBlob?: Blob | null;
}

const PromptForm: React.FC<PromptFormProps> = ({
  onGenerate,
  initialValues,
  lastVideoObject,
  lastVideoBlob,
}) => {
  const [prompt, setPrompt] = useState(initialValues?.prompt ?? '');
  const [model, setModel] = useState<VeoModel>(
    initialValues?.model ?? VeoModel.VEO_FAST,
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(
    initialValues?.aspectRatio ?? AspectRatio.LANDSCAPE,
  );
  const [resolution, setResolution] = useState<Resolution>(
    initialValues?.resolution ?? Resolution.P720,
  );
  const [generationMode, setGenerationMode] = useState<GenerationMode>(
    initialValues?.mode ?? GenerationMode.TEXT_TO_VIDEO,
  );
  const [inputImage, setInputImage] = useState<ImageFile | null>(
    initialValues?.inputImage ?? null,
  );
  const [startFrame, setStartFrame] = useState<ImageFile | null>(
    initialValues?.startFrame ?? null,
  );
  const [endFrame, setEndFrame] = useState<ImageFile | null>(
    initialValues?.endFrame ?? null,
  );
  const [referenceImages, setReferenceImages] = useState<ImageFile[]>(
    initialValues?.referenceImages ?? [],
  );
  const [styleImage, setStyleImage] = useState<ImageFile | null>(
    initialValues?.styleImage ?? null,
  );
  const [inputVideo, setInputVideo] = useState<VideoFile | null>(
    initialValues?.inputVideo ?? null,
  );
  const [inputVideoObject, setInputVideoObject] = useState<Video | null>(
    initialValues?.inputVideoObject ?? null,
  );
  const [isLooping, setIsLooping] = useState(initialValues?.isLooping ?? false);
  const [musicPrompt, setMusicPrompt] = useState(
    initialValues?.musicPrompt ?? '',
  );

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isModeSelectorOpen, setIsModeSelectorOpen] = useState(false);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modeSelectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialValues) {
      setPrompt(initialValues.prompt ?? '');
      setModel(initialValues.model ?? VeoModel.VEO_FAST);
      setAspectRatio(initialValues.aspectRatio ?? AspectRatio.LANDSCAPE);
      setResolution(initialValues.resolution ?? Resolution.P720);
      setGenerationMode(initialValues.mode ?? GenerationMode.TEXT_TO_VIDEO);
      setInputImage(initialValues.inputImage ?? null);
      setStartFrame(initialValues.startFrame ?? null);
      setEndFrame(initialValues.endFrame ?? null);
      setReferenceImages(initialValues.referenceImages ?? []);
      setStyleImage(initialValues.styleImage ?? null);
      setInputVideo(initialValues.inputVideo ?? null);
      setInputVideoObject(initialValues.inputVideoObject ?? null);
      setIsLooping(initialValues.isLooping ?? false);
      setMusicPrompt(initialValues.musicPrompt ?? '');
    }
  }, [initialValues]);

  useEffect(() => {
    if (generationMode === GenerationMode.REFERENCES_TO_VIDEO) {
      setModel(VeoModel.VEO);
      setAspectRatio(AspectRatio.LANDSCAPE);
      setResolution(Resolution.P720);
    } else if (generationMode === GenerationMode.EXTEND_VIDEO) {
      setResolution(Resolution.P720);
      setModel(VeoModel.VEO);
    }
  }, [generationMode]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [prompt]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modeSelectorRef.current &&
        !modeSelectorRef.current.contains(event.target as Node)
      ) {
        setIsModeSelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGeneratePrompt = async () => {
    setIsGeneratingPrompt(true);
    try {
      const newPrompt = await generateVideoPrompt();
      setPrompt(newPrompt);
    } catch (error) {
      console.error(error);
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onGenerate({
        prompt,
        model,
        aspectRatio,
        resolution,
        mode: generationMode,
        inputImage,
        startFrame,
        endFrame,
        referenceImages,
        styleImage,
        inputVideo,
        inputVideoObject,
        isLooping,
        musicPrompt,
      });
    },
    [
      prompt,
      model,
      aspectRatio,
      resolution,
      generationMode,
      inputImage,
      startFrame,
      endFrame,
      referenceImages,
      styleImage,
      inputVideo,
      inputVideoObject,
      onGenerate,
      isLooping,
      musicPrompt,
    ],
  );

  const handleSelectMode = (mode: GenerationMode) => {
    setGenerationMode(mode);
    setIsModeSelectorOpen(false);
    // Reset media inputs
    setInputImage(null);
    setStartFrame(null);
    setEndFrame(null);
    setReferenceImages([]);
    setStyleImage(null);
    setInputVideo(null);
    setInputVideoObject(null);
    setIsLooping(false);
    setMusicPrompt('');

    if (mode === GenerationMode.EXTEND_VIDEO) {
      setModel(VeoModel.VEO); // Extend requires the VEO model
      if (lastVideoBlob && lastVideoObject) {
        const file = new File([lastVideoBlob], 'last_video.mp4', {
          type: lastVideoBlob.type,
        });
        const videoFile: VideoFile = {file, base64: ''};
        setInputVideo(videoFile);
        setInputVideoObject(lastVideoObject);
        // The API for extend requires the aspect ratio to match.
        if (lastVideoObject.aspectRatio) {
          setAspectRatio(lastVideoObject.aspectRatio as AspectRatio);
        }
      }
    }
  };

  const promptPlaceholder = {
    [GenerationMode.TEXT_TO_VIDEO]: 'C:\\> Describe the video you want to create...',
    [GenerationMode.IMAGE_TO_VIDEO]:
      'C:\\> Describe how to animate the image (optional)...',
    [GenerationMode.FRAMES_TO_VIDEO]:
      'C:\\> Describe motion between frames (optional)...',
    [GenerationMode.REFERENCES_TO_VIDEO]:
      'C:\\> Describe video using references...',
    [GenerationMode.EXTEND_VIDEO]: 'C:\\> Describe what happens next (optional)...',
  }[generationMode];

  const selectableModes = [
    GenerationMode.TEXT_TO_VIDEO,
    GenerationMode.IMAGE_TO_VIDEO,
    GenerationMode.FRAMES_TO_VIDEO,
    GenerationMode.REFERENCES_TO_VIDEO,
  ];
  if (lastVideoObject) {
    selectableModes.push(GenerationMode.EXTEND_VIDEO);
  }
  
  const getModeShortName = (mode: GenerationMode) => {
    const nameMap = {
      [GenerationMode.TEXT_TO_VIDEO]: 'T2V',
      [GenerationMode.IMAGE_TO_VIDEO]: 'I2V',
      [GenerationMode.FRAMES_TO_VIDEO]: 'F2V',
      [GenerationMode.REFERENCES_TO_VIDEO]: 'REF',
      [GenerationMode.EXTEND_VIDEO]: 'EXT',
    };
    return nameMap[mode];
  }

  const renderMediaUploads = () => {
    if (generationMode === GenerationMode.IMAGE_TO_VIDEO) {
      return (
        <div className="media-uploads">
          <ImageUpload
            label="Input Photo"
            image={inputImage}
            onSelect={setInputImage}
            onRemove={() => setInputImage(null)}
          />
        </div>
      );
    }
    if (generationMode === GenerationMode.FRAMES_TO_VIDEO) {
      return (
        <div className="media-uploads">
            <ImageUpload
              label="Start Frame"
              image={startFrame}
              onSelect={setStartFrame}
              onRemove={() => {
                setStartFrame(null);
                setIsLooping(false);
              }}
            />
            {!isLooping && (
              <ImageUpload
                label="End Frame"
                image={endFrame}
                onSelect={setEndFrame}
                onRemove={() => setEndFrame(null)}
              />
            )}
          {startFrame && !endFrame && (
            <div style={{width: '100%', textAlign: 'center', marginTop: '1rem'}}>
              <input
                id="loop-video-checkbox"
                type="checkbox"
                checked={isLooping}
                onChange={(e) => setIsLooping(e.target.checked)}
              />
              <label
                htmlFor="loop-video-checkbox"
                style={{marginLeft: '0.5rem'}}
                >
                Create a looping video
              </label>
            </div>
          )}
        </div>
      );
    }
    if (generationMode === GenerationMode.REFERENCES_TO_VIDEO) {
      return (
        <div className="media-uploads">
          {referenceImages.map((img, index) => (
            <ImageUpload
              key={index}
              image={img}
              label=""
              onSelect={() => {}}
              onRemove={() =>
                setReferenceImages((imgs) => imgs.filter((_, i) => i !== index))
              }
            />
          ))}
          {referenceImages.length < 3 && (
            <ImageUpload
              label="Add Reference"
              onSelect={(img) => setReferenceImages((imgs) => [...imgs, img])}
            />
          )}
        </div>
      );
    }
    if (generationMode === GenerationMode.EXTEND_VIDEO) {
      return (
        <div className="media-uploads">
          <VideoUpload
            label="Input Video"
            video={inputVideo}
            onSelect={setInputVideo}
            onRemove={() => {
              setInputVideo(null);
              setInputVideoObject(null);
            }}
            disabled={true}
          />
        </div>
      );
    }
    return null;
  };

  const isRefMode = generationMode === GenerationMode.REFERENCES_TO_VIDEO;
  const isExtendMode = generationMode === GenerationMode.EXTEND_VIDEO;

  let isSubmitDisabled = false;
  let tooltipText = '';

  switch (generationMode) {
    case GenerationMode.TEXT_TO_VIDEO:
      isSubmitDisabled = !prompt.trim() && !musicPrompt.trim();
      if (isSubmitDisabled) {
        tooltipText = 'Please enter a prompt.';
      }
      break;
    case GenerationMode.IMAGE_TO_VIDEO:
      isSubmitDisabled = !inputImage;
      if (isSubmitDisabled) {
        tooltipText = 'An input image is required.';
      }
      break;
    case GenerationMode.FRAMES_TO_VIDEO:
      isSubmitDisabled = !startFrame;
      if (isSubmitDisabled) {
        tooltipText = 'A start frame is required.';
      }
      break;
    case GenerationMode.REFERENCES_TO_VIDEO:
      const hasNoRefs = referenceImages.length === 0;
      const hasNoPrompt = !prompt.trim() && !musicPrompt.trim();
      isSubmitDisabled = hasNoRefs || hasNoPrompt;
      if (hasNoRefs && hasNoPrompt) {
        tooltipText = 'Please add reference image(s) and enter a prompt.';
      } else if (hasNoRefs) {
        tooltipText = 'At least one reference image is required.';
      } else if (hasNoPrompt) {
        tooltipText = 'Please enter a prompt.';
      }
      break;
    case GenerationMode.EXTEND_VIDEO:
      isSubmitDisabled = !inputVideoObject;
      if (isSubmitDisabled) {
        tooltipText =
          'An input video from a previous generation is required to extend.';
      }
      break;
  }

  return (
    <div style={{position: 'relative', width: '100%'}}>
      {isSettingsOpen && (
        <div className="settings-panel">
          <div className="settings-grid">
            <CustomSelect
              label="Model"
              value={model}
              onChange={(e) => setModel(e.target.value as VeoModel)}
              disabled={isRefMode || isExtendMode}>
              {Object.values(VeoModel).map((modelValue) => (
                <option key={modelValue} value={modelValue}>
                  {modelValue}
                </option>
              ))}
            </CustomSelect>
            <CustomSelect
              label="Aspect Ratio"
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
              disabled={isRefMode || isExtendMode}>
              {Object.entries(aspectRatioDisplayNames).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </CustomSelect>
            <div>
              <CustomSelect
                label="Resolution"
                value={resolution}
                onChange={(e) => setResolution(e.target.value as Resolution)}
                disabled={isRefMode || isExtendMode}>
                <option value={Resolution.P720}>720p</option>
                <option value={Resolution.P1080}>1080p</option>
              </CustomSelect>
              {resolution === Resolution.P1080 && (
                <p style={{fontSize: '14px', color: '#ffcc00', marginTop: '4px'}}>
                  1080p videos cannot be extended.
                </p>
              )}
            </div>
          </div>
          <div className="music-prompt-container">
            <label htmlFor="music-prompt-input">
              Music Prompt (Experimental)
            </label>
            <input
              id="music-prompt-input"
              type="text"
              className="text-input"
              value={musicPrompt}
              onChange={(e) => setMusicPrompt(e.target.value)}
              placeholder="e.g., 'upbeat synthwave track'"
            />
            <p>
              Describe background music to be generated with the video. This is
              an experimental feature and may not produce audio.
            </p>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="prompt-form">
        {renderMediaUploads()}
        <div className="prompt-input-wrapper">
          <div style={{ position: 'relative' }} ref={modeSelectorRef}>
            <button
              type="button"
              onClick={() => setIsModeSelectorOpen((prev) => !prev)}
              aria-label="Select generation mode">
              {getModeShortName(generationMode)}
            </button>
            {isModeSelectorOpen && (
              <div className="mode-selector-popup">
                {selectableModes.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleSelectMode(mode)}
                    className={generationMode === mode ? 'active' : ''}>
                    {mode}
                  </button>
                ))}
              </div>
            )}
          </div>
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={promptPlaceholder}
            rows={1}
          />
          <div className="prompt-actions">
             <div className="tooltip-wrapper">
                <button
                  type="button"
                  onClick={handleGeneratePrompt}
                  disabled={isGeneratingPrompt}
                  aria-label="Generate prompt suggestion">
                  {isGeneratingPrompt ? (
                    <div className="spinner"></div>
                  ) : (
                    'Inspire'
                  )}
                </button>
                <span className="tooltip">Inspire Me</span>
            </div>
            <div className="tooltip-wrapper">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen((prev) => !prev)}
                  aria-label="Toggle settings">
                  Settings
                </button>
                <span className="tooltip">Settings</span>
            </div>
            <div className="tooltip-wrapper">
              <button
                type="submit"
                aria-label="Generate video"
                disabled={isSubmitDisabled}>
                &gt;&gt;
              </button>
              {isSubmitDisabled && tooltipText && (
                <span className="tooltip" style={{visibility: 'visible', opacity: 1}}>{tooltipText}</span>
              )}
            </div>
          </div>
        </div>
        <p style={{ fontSize: '14px', textAlign: 'center', marginTop: '8px', opacity: 0.7 }}>
          Veo is a paid-only model. You will be charged on your Cloud project. See{' '}
          <a
            href="https://ai.google.dev/gemini-api/docs/pricing#veo-3"
            target="_blank"
            rel="noopener noreferrer"
            >
            pricing details
          </a>
          .
        </p>
      </form>
    </div>
  );
};

export default PromptForm;