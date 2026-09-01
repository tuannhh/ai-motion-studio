import React from "react";
import { CalculateMetadataFunction, Composition } from "remotion";
import { Video } from "./Video";
import {
  FPS,
  HEIGHT,
  VideoSpec,
  WIDTH,
  totalDurationInFrames,
  videoSpecSchema,
} from "./schema/spec";
import demoSpec from "../examples/demo-ai-workflow.json";

type Props = { spec: VideoSpec };

const calculateMetadata: CalculateMetadataFunction<Props> = ({ props }) => {
  const spec = videoSpecSchema.parse(props.spec);
  return {
    durationInFrames: totalDurationInFrames(spec),
    props: { spec },
  };
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Video"
      component={Video}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      defaultProps={{ spec: demoSpec as VideoSpec }}
      calculateMetadata={calculateMetadata}
    />
  );
};
