import { defineManifest } from '@crxjs/vite-plugin'
import * as packageData from './package.json'

//@ts-ignore
const isDev = process.env.NODE_ENV == 'development'

export default defineManifest({
  name: `Browser Companion${isDev ? ` ➡️ Dev` : ''}`,
  description: packageData.description,
  version: packageData.version,
  manifest_version: 3,
  icons: {
    16: 'icons/icon16.png',
    32: 'icons/icon32.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png',
  },
  action: {
    default_popup: 'popup.html',
    default_icon: 'icons/icon48.png',
  },
  options_page: 'options.html',
  // devtools_page: 'devtools.html',
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/contentScript/index.tsx'],
    },
  ],
  // side_panel: {
  //   default_path: 'sidepanel.html',
  // },
  web_accessible_resources: [
    {
      resources: ['icons/*'],
      matches: ['<all_urls>'],
    },
  ],
  permissions: ['sidePanel', 'storage', 'activeTab'],

  // chrome_url_overrides: {
  //   newtab: 'newtab.html',
  // },
})
