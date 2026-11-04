/** What the install card should do. Pure, so it can be tested without a browser. */
export type InstallInputs = {
  installedFlag: boolean; // we saw the app installed or running as an installed app on this device
  standalone: boolean;    // this very window is the installed app
  snoozed: boolean;       // the person tapped "Not now" recently
  hasDeferredPrompt: boolean; // Chrome gave us a one-tap install
  ios: boolean;
};

export function decideInstall(i: InstallInputs): "hide" | "prompt" | "ios" {
  if (i.installedFlag || i.standalone || i.snoozed) return "hide"; // installed means never ask again
  if (i.hasDeferredPrompt) return "prompt";
  return i.ios ? "ios" : "hide";
}
