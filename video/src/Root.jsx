import React from "react";
import { Composition } from "remotion";
import { Intro } from "./intro";
import { Live, LIVE_TOTAL } from "./live";
import { FPS, W, H } from "./theme";

export const Root = () => (
  <>
    <Composition id="Intro" component={Intro} durationInFrames={10 * FPS} fps={FPS} width={W} height={H} />
    <Composition id="Live" component={Live} durationInFrames={LIVE_TOTAL} fps={FPS} width={W} height={H} />
  </>
);
