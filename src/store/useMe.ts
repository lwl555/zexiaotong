import { useStore } from './store'
export const useMe = () => useStore(s => s.users.find(u => u.id === s.session.userId)!)
