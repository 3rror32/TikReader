// The test calls Chrome's native per-tab zoom API, never CSS zoom or CDP scale.
globalThis.operatorZoom = async (url, factor) => {
  const tab = (await chrome.tabs.query({})).find(candidate => candidate.url === url);
  if (!tab) throw new Error('Operator fixture tab not found.');
  await chrome.tabs.setZoomSettings(tab.id, { mode: 'automatic', scope: 'per-tab' });
  await chrome.tabs.setZoom(tab.id, factor);
  return { factor: await chrome.tabs.getZoom(tab.id), settings: await chrome.tabs.getZoomSettings(tab.id) };
};
