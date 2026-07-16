// Makes the current board's live assets (keyed by asset id) available to canvas
// node components. MediaNodeCard uses it to resolve a media node's url/filename
// from the up-to-date asset rather than the copy cached in node content, which
// goes stale when a background re-encode swaps the file (see liveMediaFields).
import { createContext, useContext } from 'react'
import type { Asset } from './types'

export const MediaAssetContext = createContext<Map<string, Asset>>(new Map())
export const useMediaAssets = () => useContext(MediaAssetContext)
