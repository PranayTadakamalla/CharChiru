/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

interface VideoResultProps {
  videoUrl: string;
  onRetry: () => void;
  onNewVideo: () => void;
  onExtend: () => void;
  canExtend: boolean;
  onDownload: () => void;
}

const VideoResult: React.FC<VideoResultProps> = ({
  videoUrl,
  onRetry,
  onNewVideo,
  onExtend,
  canExtend,
  onDownload,
}) => {
  return (
    <div className="video-result">
      <h2>GENERATION COMPLETE!</h2>
      <div className="video-wrapper">
        <video
          src={videoUrl}
          controls
          autoPlay
          loop
        />
      </div>

      <div className="video-actions">
        <button onClick={onRetry}>Retry</button>
        <button onClick={onDownload}>Download</button>
        {canExtend && (
          <button onClick={onExtend}>Extend</button>
        )}
        <button onClick={onNewVideo}>New Video</button>
      </div>
    </div>
  );
};

export default VideoResult;
