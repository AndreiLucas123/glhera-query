import { focusManager, GLHeraManager, onlineManager } from './managers';

//
//

export type GLHeraClient = {
  onlineManager: GLHeraManager;
  focusManager: GLHeraManager;
};

//
//

export type GLHeraClientOptions = {
  onlineManager?: GLHeraManager;
  focusManager?: GLHeraManager;
};

//
//

export function glheraClient(
  opts: GLHeraClientOptions = {},
): GLHeraClient {
  //

  const _onlineManager = opts.onlineManager || onlineManager();
  const _focusManager = opts.focusManager || focusManager();

  //
  //

  return {
    onlineManager: _onlineManager,
    focusManager: _focusManager,
  };
}
