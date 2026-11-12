import React from "react";
import { Composition } from "remotion";
import { Intro, Live, LIVE_TOTAL } from "./videos";
import { FPS, W, H } from "./theme";

export const Root = () => (
  <>
    <Composition id="Intro" component={Intro} durationInFrames={15 * FPS} fps={FPS} width={W} height={H} />
    <Composition id="Live" component={Live} durationInFrames={LIVE_TOTAL} fps={FPS} width={W} height={H} />
  </>
);
