/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';

const loadingMessages = [
  "Warming up the digital director...",
  "Gathering pixels and photons...",
  "Storyboarding your vision...",
  "Consulting with the AI muse...",
  "Rendering the first scene...",
  "Applying cinematic lighting...",
  "This can take a few minutes, hang tight!",
  "Adding a touch of movie magic...",
  "Composing the final cut...",
  "Polishing the masterpiece...",
  "Teaching the AI to say 'I'll be back'...",
  "Checking for digital dust bunnies...",
  "Calibrating the irony sensors...",
  "Untangling the timelines...",
  "Enhancing to ludicrous speed...",
  "Don't worry, the pixels are friendly.",
  "Harvesting nano banana stems...",
  "Praying to the Gemini star...",
  "Starting a draft for your oscar speech..."
];

const spinnerFrames = ['[    ]', '[=   ]', '[==  ]', '[=== ]', '[ ===]', '[  ==]', '[   =]'];

const LoadingIndicator: React.FC = () => {
  const [messageIndex, setMessageIndex] = useState(0);
  const [spinnerIndex, setSpinnerIndex] = useState(0);

  useEffect(() => {
    const messageIntervalId = setInterval(() => {
      setMessageIndex((prevIndex) => (prevIndex + 1) % loadingMessages.length);
    }, 3000); // Change message every 3 seconds

    const spinnerIntervalId = setInterval(() => {
      setSpinnerIndex((prevIndex) => (prevIndex + 1) % spinnerFrames.length);
    }, 100);

    return () => {
      clearInterval(messageIntervalId);
      clearInterval(spinnerIntervalId);
    };
  }, []);

  return (
    <div className="loading-indicator">
      <div className="spinner-text" aria-hidden="true">{spinnerFrames[spinnerIndex]}</div>
      <h2>GENERATING VIDEO...</h2>
      <p>{loadingMessages[messageIndex]}</p>
    </div>
  );
};

export default LoadingIndicator;
