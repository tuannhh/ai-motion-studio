import {Composition} from 'remotion';
import type React from 'react';
import rawSpec from '../public/diagram-video.json';
import {DiagramVideo, durationInFramesFor, type DiagramVideoSpec, FPS} from './DiagramVideo';

const spec = rawSpec as unknown as DiagramVideoSpec;

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="DiagramVideo"
      component={DiagramVideo}
      durationInFrames={durationInFramesFor(spec)}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={spec}
    />
  );
};
