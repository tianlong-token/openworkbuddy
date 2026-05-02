import React from 'react';
import { render } from 'ink';
import { App } from './app.js';

export interface TUIConfig {
  runtime: any;
  skillName: string;
}

export async function runTUI(config: TUIConfig): Promise<void> {
  const { waitUntilExit } = render(React.createElement(App, config));
  await waitUntilExit();
}
