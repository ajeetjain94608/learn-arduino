// ?embed: the app as a small window inside another page (the tutorials): only the 3D view of the project in the address, with
// its own Run button and a link to the full 3D lab. Set once, when the page loads.
export const isEmbed = (): boolean => typeof location !== 'undefined' && new URLSearchParams(location.search).has('embed');
