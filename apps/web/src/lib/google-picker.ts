/**
 * Google Picker, the only way a `drive.file`-scoped app gets access to an
 * existing doc: whatever the user picks here becomes readable by FolioNote.
 * Needs a browser API key + the Cloud project number (app id).
 */

const GAPI_SRC = "https://apis.google.com/js/api.js"
const GOOGLE_DOC_MIME = "application/vnd.google-apps.document"

interface PickerDocument {
  id: string
  name: string
  url: string
}

interface PickerResponse {
  action: string
  docs?: PickerDocument[]
}

interface PickerBuilder {
  addView(view: unknown): PickerBuilder
  setOAuthToken(token: string): PickerBuilder
  setDeveloperKey(key: string): PickerBuilder
  setAppId(appId: string): PickerBuilder
  setCallback(callback: (response: PickerResponse) => void): PickerBuilder
  build(): { setVisible(visible: boolean): void }
}

interface GooglePickerNamespace {
  PickerBuilder: new () => PickerBuilder
  DocsView: new (viewId: string) => { setMimeTypes(types: string): unknown }
  ViewId: { DOCUMENTS: string }
  Action: { PICKED: string; CANCEL: string }
}

declare global {
  interface Window {
    gapi?: { load(name: string, callback: () => void): void }
    google?: { picker?: GooglePickerNamespace }
  }
}

export interface GooglePickerConfig {
  apiKey: string
  appId: string
}

export function readGooglePickerConfig(): GooglePickerConfig | null {
  const apiKey = import.meta.env.VITE_GOOGLE_PICKER_API_KEY as
    | string
    | undefined
  const appId = import.meta.env.VITE_GOOGLE_APP_ID as string | undefined
  return apiKey && appId ? { apiKey, appId } : null
}

let pickerLoad: Promise<GooglePickerNamespace> | null = null

function loadPicker(): Promise<GooglePickerNamespace> {
  pickerLoad ??= new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = GAPI_SRC
    script.async = true
    script.onerror = () => {
      pickerLoad = null
      reject(new Error("Could not load Google Picker"))
    }
    script.onload = () => {
      window.gapi?.load("picker", () => {
        const picker = window.google?.picker
        if (picker) {
          resolve(picker)
        } else {
          reject(new Error("Google Picker unavailable"))
        }
      })
    }
    document.head.append(script)
  })
  return pickerLoad
}

/** Resolves with the picked doc, or null when the user cancels. */
export async function pickGoogleDoc(
  config: GooglePickerConfig,
  accessToken: string
): Promise<PickerDocument | null> {
  const picker = await loadPicker()
  return new Promise((resolve) => {
    const view = new picker.DocsView(picker.ViewId.DOCUMENTS)
    view.setMimeTypes(GOOGLE_DOC_MIME)
    new picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(config.apiKey)
      .setAppId(config.appId)
      .setCallback((response) => {
        if (response.action === picker.Action.PICKED) {
          resolve(response.docs?.[0] ?? null)
        } else if (response.action === picker.Action.CANCEL) {
          resolve(null)
        }
      })
      .build()
      .setVisible(true)
  })
}
