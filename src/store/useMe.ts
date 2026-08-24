import { useStore } from './store'
export const useMe = () => useStore(s => s.me!)
